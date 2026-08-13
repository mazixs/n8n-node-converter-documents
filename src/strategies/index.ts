import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import { parse as parseHtml } from 'node-html-parser-modern';
import chardet from "chardet";
import Papa from "papaparse";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { extractViaOfficeParser } from "../helpers";
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

/**
 * Cheap non-emptiness check for a spreadsheet row: true if at least one cell
 * holds a real value. Used past the row limit to decide whether a row would
 * actually have contributed data (and is therefore real truncation) without
 * paying the cost of building the full `rowData` object for it.
 */
function rowHasValue(row: { forEach: (callback: (cell: unknown) => void) => void }): boolean {
  let hasValue = false;
  row.forEach((cell) => {
    if (!hasValue && cell !== null && cell !== undefined) hasValue = true;
  });
  return hasValue;
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

/**
 * Общая стратегия для legacy CFB форматов (DOC, PPT)
 */
function cfbLegacyStrategy(format: string, modernFormat: string): StrategyFn {
  return async (buf) => {
    try {
      const signature = buf.slice(0, 8);
      const cfbSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      
      if (signature.equals(cfbSignature)) throw legacyFormatError(format, modernFormat);
      
      return { text: await extractViaOfficeParser(buf) };
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
      return { text: await extractViaOfficeParser(buf, format === 'pdf') };
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
      const text = await extractViaOfficeParser(buf);
      if (text && text.trim().length > 0) {
        return { text };
      }
    } catch {
      // Ошибка officeparser - пробуем дальше
    }
    
    // Попытка 2: mammoth (text)
    try {
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

  xlsx: async (buf, _ext = undefined, options = undefined) => {
    const workbook = await readXlsxFile(buf, { dateFormat: 'YYYY-MM-DD' });
    const sheets: Record<string, unknown[]> = {};
    const maxRows = options?.maxRows ?? CSV_ROW_LIMIT;
    let truncated = false;
    for (const { sheet: sheetName, data: rows } of workbook) {
      const jsonData: unknown[] = [];
      for (const row of rows) {
        if (maxRows !== 0 && jsonData.length >= maxRows) {
          // Limit already reached: only a genuinely non-empty row counts as truncated
          // data. Check cheaply (no rowData object) and stop as soon as we know either way.
          if (rowHasValue(row)) {
            truncated = true;
            break;
          }
          continue;
        }
        const rowData: Record<string, unknown> = {};
        row.forEach((cell: unknown, colIndex: number) => {
          if (cell !== null && cell !== undefined) {
            const columnLetter = numberToColumn(colIndex + 1);
            rowData[columnLetter] = cell instanceof Date ? cell.toISOString() : cell;
          }
        });
        if (Object.keys(rowData).length > 0) jsonData.push(rowData);
      }
      sheets[sheetName] = jsonData;
    }
    return {
      sheets,
      warning: truncated ? `XLSX sheets truncated to ${maxRows} row(s)` : undefined,
    };
  },

  csv: async (buf, _ext = undefined, options = undefined) => {
    return streamCsvStrategy(decodeBuffer(buf), options?.maxRows ?? CSV_ROW_LIMIT);
  },

  pdf: officeParserStrategy('pdf'),

  txt: plainTextStrategy,
  md: plainTextStrategy,
  markdown: plainTextStrategy,

  ppt: cfbLegacyStrategy('ppt', 'pptx'),

  pptx: officeParserStrategy('pptx'),

  html: processHtml,
  htm: processHtml,
} satisfies Record<string, StrategyFn>;
