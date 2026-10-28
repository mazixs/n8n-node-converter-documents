import { XMLParser } from "fast-xml-parser";
// mammoth и hucre грузятся при первом файле своего формата, а не вместе с нодой:
// n8n загружает ноды при старте, а эти парсеры тяжёлые.
import type { CellValue, ReadWarning, Sheet, Workbook } from "hucre";
import { parse as parseHtml } from 'node-html-parser-modern';
import chardet from "chardet";
import Papa from "papaparse";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { extractViaOfficeParser, type OfficeExtraction } from "../helpers";
import {
  UnsupportedFormatError,
  ProcessingError,
} from "../errors";
import { numberToColumn } from "../utils/columns";
import { flattenJsonObject } from "../utils/flatten";
import { processYandexMarketYml } from "../processors/yml";
import type { StrategyFn, StrategyOptions, StrategyResult } from "../types";

// Единственный переиспользуемый инстанс — избегаем пересоздания на каждый вызов translate()
const nodeHtmlMarkdown = new NodeHtmlMarkdown();

// Константы
const CSV_ROW_LIMIT = 100000;
const TXT_CHAR_LIMIT = 1_000_000; // 1 млн символов
const CFB_SIGNATURE = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
const MS_PER_DAY = 86_400_000;
const EXCEL_DAY_ONE = Date.UTC(1900, 0, 1);
// Предупреждения hucre о потерянных или искажённых ячейках. Гиперссылки, условное
// форматирование и параметры печати в вывод не попадают, их потеря пользователя не касается.
const SPREADSHEET_LOSS_WARNINGS = new Set<ReadWarning['code']>([
  'unresolved-shared-string',
  'unresolved-style',
  'malformed-cell-ref',
]);
const XML_OPTIONS = {
  ignoreAttributes: false,
  processEntities: {
    enabled: true,
    maxEntitySize: 10_000,
    maxExpansionDepth: 10,
    maxTotalExpansions: 10_000,
    maxExpandedLength: 1_000_000,
    maxEntityCount: 1_000,
  },
} as const;

// --- Вспомогательные функции ---

const ENCODING_SAMPLE_SIZE = 64 * 1024; // 64 КБ достаточно для надёжного определения кодировки

function decodeBuffer(buf: Buffer): string {
  const sample = buf.subarray(0, ENCODING_SAMPLE_SIZE);
  const detected = chardet.detect(sample) || 'utf-8';
  try {
    return new TextDecoder(detected).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/**
 * Structured `data` (parsed JSON/XML/YML) is a v6-only addition to the output
 * contract; the legacy v5 execute path in `ConvertFileToJson.node.ts` must keep
 * returning exactly what it always has. Gated on the explicit
 * `options.includeParsedData` flag — only the v6 pipeline sets it — rather than
 * on whether `options` itself is defined, so v5 stays safe even if it starts
 * passing other options (e.g. `maxRows`) to a strategy in the future.
 */
function dataField(options: StrategyOptions | undefined, value: unknown): { data?: unknown } {
  return options?.includeParsedData ? { data: value } : {};
}

async function txtStrategy(buf: Buffer, maxCharacters: number): Promise<StrategyResult> {
  const text = decodeBuffer(buf);
  const truncated = maxCharacters > 0 && text.length > maxCharacters;
  return {
    text: truncated ? text.slice(0, maxCharacters) : text,
    warning: truncated ? `Текст обрезан до ${maxCharacters} символов` : undefined,
  };
}

// Общая стратегия для txt/md/markdown — все три расширения читаются одинаково,
// как обычный текст с одним и тем же лимитом символов.
const plainTextStrategy: StrategyFn = async (buf, _ext = undefined, options = undefined) => {
  return txtStrategy(buf, options?.maxTextChars ?? TXT_CHAR_LIMIT);
};

async function streamCsvStrategy(data: string, maxRows: number): Promise<StrategyResult> {
  return new Promise((resolve, reject) => {
    const rows: unknown[] = [];
    let truncated = false;
    Papa.parse(data, {
      header: true,
      skipEmptyLines: true,
      step: (result: { data: unknown }, parser) => {
        if (maxRows === 0 || rows.length < maxRows) {
          rows.push(result.data);
        } else {
          truncated = true;
          parser.abort();
        }
      },
      complete: () => {
        const warning = truncated
          ? `CSV truncated to ${maxRows} rows`
          : undefined;
        resolve({
          sheets: { Sheet1: rows },
          warning,
        });
      },
      error: (err: Error) => reject(err),
    });
  });
}

// --- Таблицы (hucre) ---
//
// Правила ячеек повторяют read-excel-file 9.3.10, на котором XLSX читался до перехода на hucre:
// строки обрезаны по краям, пустые строки и ошибки формул пропущены.

/** Ячейки-ошибки листа: строка → столбцы. hucre помечает их типом только в XLSX. */
function errorCells(sheet: Sheet): Map<number, Set<number>> {
  const errors = new Map<number, Set<number>>();
  for (const [key, cell] of sheet.cells ?? []) {
    if (cell.type !== 'error' && cell.formulaResultType !== 'error') continue;
    const [row, column] = key.split(',').map(Number);
    const columns = errors.get(row) ?? new Set<number>();
    columns.add(column);
    errors.set(row, columns);
  }
  return errors;
}

function keepsCell(value: CellValue, isError: boolean): value is Exclude<CellValue, null> {
  if (value === null || isError) return false;
  return typeof value !== 'string' || value.trim() !== '';
}

function cellOutput(value: Exclude<CellValue, null>): string | number | boolean {
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) {
    // Время без даты (serial < 1) hucre ставит на 1899-12-31, read-excel-file ставил на 1899-12-30.
    const time = value.getTime();
    return new Date(time < EXCEL_DAY_ONE ? time - MS_PER_DAY : time).toISOString();
  }
  return value;
}

/**
 * Cheap non-emptiness check for a spreadsheet row: true if at least one cell
 * would reach the output. Used past the row limit to decide whether a row would
 * actually have contributed data (and is therefore real truncation) without
 * paying the cost of building the full `rowData` object for it.
 */
function rowHasValue(row: CellValue[], errorColumns: Set<number> | undefined): boolean {
  return row.some((cell, colIndex) => keepsCell(cell, errorColumns?.has(colIndex) ?? false));
}

function rowOutput(row: CellValue[], errorColumns: Set<number> | undefined): Record<string, unknown> {
  const rowData: Record<string, unknown> = {};
  row.forEach((cell, colIndex) => {
    if (keepsCell(cell, errorColumns?.has(colIndex) ?? false)) {
      rowData[numberToColumn(colIndex + 1)] = cellOutput(cell);
    }
  });
  return rowData;
}

function workbookSheets(workbook: Workbook, maxRows: number): { sheets: Record<string, unknown[]>; truncated: boolean } {
  const sheets: Record<string, unknown[]> = {};
  let truncated = false;
  for (const sheet of workbook.sheets) {
    // Лист-диаграмма и прочие не-рабочие листы hucre отдаёт пустыми: таблицы в них нет.
    if (sheet.kind !== undefined && sheet.kind !== 'worksheet') continue;
    const errors = errorCells(sheet);
    const jsonData: unknown[] = [];
    for (const [rowIndex, row] of sheet.rows.entries()) {
      const errorColumns = errors.get(rowIndex);
      if (maxRows !== 0 && jsonData.length >= maxRows) {
        // Limit already reached: only a genuinely non-empty row counts as truncated
        // data. Check cheaply (no rowData object) and stop as soon as we know either way.
        if (rowHasValue(row, errorColumns)) {
          truncated = true;
          break;
        }
        continue;
      }
      const rowData = rowOutput(row, errorColumns);
      if (Object.keys(rowData).length > 0) jsonData.push(rowData);
    }
    sheets[sheet.name] = jsonData;
  }
  return { sheets, truncated };
}

function isSpreadsheetContainer(buf: Buffer): boolean {
  const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4B; // "PK"
  return isZip || buf.subarray(0, CFB_SIGNATURE.length).equals(CFB_SIGNATURE);
}

/**
 * XLSX, XLSB и XLS читает один и тот же разбор: hucre различает их по содержимому,
 * поэтому книга с чужим расширением тоже читается. Формат из имени нужен только для
 * текста ошибок и предупреждений.
 */
function spreadsheetStrategy(format: string): StrategyFn {
  return async (buf, _ext = undefined, options = undefined) => {
    const lost = new Map<string, { message: string; count: number }>();
    let workbook: Workbook;
    try {
      // Иначе hucre прочитал бы любой текст как CSV.
      if (!isSpreadsheetContainer(buf)) throw new Error('the file is not an XLSX, XLSB or XLS workbook');
      const { read: readSpreadsheet } = await import("hucre");
      workbook = await readSpreadsheet(buf, {
        onWarning: (warning) => {
          if (!SPREADSHEET_LOSS_WARNINGS.has(warning.code)) return;
          const seen = lost.get(warning.code);
          if (seen) seen.count += 1;
          else lost.set(warning.code, { message: warning.message, count: 1 });
        },
      });
    } catch (error) {
      throwProcessingError(format, error);
    }

    const maxRows = options?.maxRows ?? CSV_ROW_LIMIT;
    const { sheets, truncated } = workbookSheets(workbook, maxRows);
    const warnings = truncated ? [`${format.toUpperCase()} sheets truncated to ${maxRows} row(s)`] : [];
    for (const [code, { message, count }] of lost) {
      warnings.push(`${code}: ${message}${count > 1 ? ` (+${count - 1} more)` : ''}`);
    }
    return {
      sheets,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    };
  };
}

async function processHtml(buf: Buffer): Promise<StrategyResult> {
  try {
    const root = parseHtml(decodeBuffer(buf));
    const contentRoot = root.querySelector("body") || root;
    const cleanText = contentRoot.textContent.replace(/\s+/g, " ").trim();
    return { text: cleanText };
  } catch (error) {
    throw new ProcessingError(`HTML processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// `warning` только при наличии: v5 разворачивает результат стратегии в свой вывод как есть.
function officeTextResult({ text, warnings }: OfficeExtraction): StrategyResult {
  return warnings.length > 0 ? { text, warning: warnings.join('; ') } : { text };
}

/**
 * Общая стратегия для legacy CFB форматов (DOC, PPT)
 */
function cfbLegacyStrategy(format: string, modernFormat: string): StrategyFn {
  return async (buf) => {
    try {
      const signature = buf.slice(0, 8);

      if (signature.equals(CFB_SIGNATURE)) throw legacyFormatError(format, modernFormat);
      
      return officeTextResult(await extractViaOfficeParser(buf));
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('cfb files')) {
        throw legacyFormatError(format, modernFormat);
      }

      throwProcessingError(format, error);
    }
  };
}

function legacyFormatError(format: string, modernFormat: string): UnsupportedFormatError {
  return new UnsupportedFormatError(
    `Старые ${format.toUpperCase()} файлы не поддерживаются. ` +
    `Пожалуйста, сохраните файл в формате ${modernFormat.toUpperCase()} и попробуйте снова.`,
  );
}

function throwProcessingError(format: string, error: unknown): never {
  if (error instanceof UnsupportedFormatError || error instanceof ProcessingError) throw error;
  throw new ProcessingError(
    `${format.toUpperCase()} processing error: ${error instanceof Error ? error.message : String(error)}`,
  );
}

function officeParserStrategy(format: string): StrategyFn {
  return async (buf) => {
    try {
      return officeTextResult(await extractViaOfficeParser(buf, format === 'pdf'));
    } catch (error) {
      throwProcessingError(format, error);
    }
  };
}

// --- Стратегии ---

export const strategies = {
  doc: cfbLegacyStrategy('doc', 'docx'),
  
  docx: async (buf, _ext, options) => {
    const outputFormat = options?.outputFormat || 'text';
    
    if (outputFormat === 'html' || outputFormat === 'markdown') {
      try {
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.convertToHtml({ buffer: buf });
        if (result.value && result.value.trim().length > 0) {
          if (outputFormat === 'markdown') {
            return { text: nodeHtmlMarkdown.translate(result.value) };
          }
          return { text: result.value };
        }
      } catch {
        // Ошибка mammoth HTML - пробуем fallback
      }
    }
    
    // Попытка 1: officeparser
    try {
      const extraction = await extractViaOfficeParser(buf);
      if (extraction.text.trim().length > 0) {
        return officeTextResult(extraction);
      }
    } catch {
      // Ошибка officeparser - пробуем дальше
    }
    
    // Попытка 2: mammoth (text)
    try {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      if (result.value && result.value.trim().length > 0) {
        return { text: result.value };
      }
    } catch {
      // Ошибка mammoth
    }
    
    throw new ProcessingError(
      `DOCX processing error: All parsers failed. ` +
      `This may be a corrupted, password-protected, or non-standard DOCX file.`
    );
  },

  xml: async (buf, _ext = undefined, options = undefined) => {
    const parser = new XMLParser(XML_OPTIONS);
    const parsed = parser.parse(decodeBuffer(buf));
    return { text: JSON.stringify(parsed, null, 2), ...dataField(options, parsed) };
  },

  yml: async (buf, _ext = undefined, options = undefined) => {
    try {
      const xmlContent = decodeBuffer(buf);
      const parser = new XMLParser(XML_OPTIONS);
      const parsed = parser.parse(xmlContent);

      if (parsed.yml_catalog && parsed.yml_catalog.shop) {
        return processYandexMarketYml(parsed, Boolean(options?.includeParsedData));
      }

      return { text: JSON.stringify(parsed, null, 2), ...dataField(options, parsed) };
    } catch (error) {
      throw new ProcessingError(`YML processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  json: async (buf, _ext = undefined, options = undefined) => {
    try {
      const jsonString = decodeBuffer(buf);
      const parsed = JSON.parse(jsonString);

      if (typeof parsed === 'object' && parsed !== null) {
        if (options?.jsonMode === 'preserve') {
          return { text: JSON.stringify(parsed, null, 2), ...dataField(options, parsed) };
        }
        const flattened = flattenJsonObject(parsed);
        return {
          text: JSON.stringify(flattened, null, 2),
          ...dataField(options, flattened),
          warning: Object.keys(flattened).length > Object.keys(parsed).length ?
            "Многоуровневая структура JSON была преобразована в плоский объект" : undefined
        };
      }

      return { text: JSON.stringify(parsed, null, 2), ...dataField(options, parsed) };
    } catch (error) {
      throw new ProcessingError(`JSON parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  odt: officeParserStrategy('odt'),
  odp: officeParserStrategy('odp'),
  ods: officeParserStrategy('ods'),

  xlsx: spreadsheetStrategy('xlsx'),
  xlsb: spreadsheetStrategy('xlsb'),
  xls: spreadsheetStrategy('xls'),

  csv: async (buf, _ext = undefined, options = undefined) => {
    return streamCsvStrategy(decodeBuffer(buf), options?.maxRows ?? CSV_ROW_LIMIT);
  },

  pdf: officeParserStrategy('pdf'),

  txt: plainTextStrategy,
  md: plainTextStrategy,
  markdown: plainTextStrategy,

  ppt: cfbLegacyStrategy('ppt', 'pptx'),

  pptx: officeParserStrategy('pptx'),
  rtf: officeParserStrategy('rtf'),

  html: processHtml,
  htm: processHtml,
} satisfies Record<string, StrategyFn>;
