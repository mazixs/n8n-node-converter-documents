import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import { parse as parseHtml } from "node-html-parser";
import chardet from "chardet";
import Papa from "papaparse";
import * as readline from "readline";
import { Readable } from "stream";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { extractViaOfficeParser, limitExcelSheet } from "../helpers";
import {
  UnsupportedFormatError,
  ProcessingError,
} from "../errors";
import { numberToColumn } from "../utils/columns";
import { flattenJsonObject } from "../utils/flatten";
import { processYandexMarketYml } from "../processors/yml";
import type { JsonResult, StrategyFn } from "../types";

// Константы
const CSV_STREAM_ROW_LIMIT = 100000;
const TXT_STREAM_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB
const TXT_STREAM_CHAR_LIMIT = 1_000_000; // 1 млн символов

// --- Вспомогательные функции ---

async function streamTxtStrategy(buf: Buffer): Promise<Partial<JsonResult>> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: Readable.from(buf.toString("utf8")),
      crlfDelay: Infinity,
    });
    let text = "";
    let truncated = false;
    rl.on("line", (line: string) => {
      if (text.length < TXT_STREAM_CHAR_LIMIT) {
        text += line + "\n";
      } else {
        truncated = true;
      }
    });
    rl.on("close", () => {
      resolve({
        text: truncated ? text.slice(0, TXT_STREAM_CHAR_LIMIT) : text,
        warning: truncated ? `Текст обрезан до ${TXT_STREAM_CHAR_LIMIT} символов` : undefined,
      });
    });
    rl.on("error", (err: Error) => reject(err));
  });
}

async function streamCsvStrategy(data: string): Promise<Partial<JsonResult>> {
  return new Promise((resolve, reject) => {
    const rows: unknown[] = [];
    let rowCount = 0;
    Papa.parse(data, {
      header: true,
      skipEmptyLines: true,
      step: (result: { data: unknown }) => {
        if (rowCount < CSV_STREAM_ROW_LIMIT) {
          rows.push(result.data);
          rowCount++;
        }
      },
      complete: () => {
        const warning = rowCount >= CSV_STREAM_ROW_LIMIT
          ? `CSV truncated to ${CSV_STREAM_ROW_LIMIT} rows`
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

async function processHtml(buf: Buffer): Promise<Partial<JsonResult>> {
  try {
    const root = parseHtml(buf.toString("utf8"));
    const body = root.querySelector("body");
    const cleanText = body ? body.textContent.replace(/\s+/g, " ").trim() : "";
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
      
      if (signature.equals(cfbSignature)) {
        throw new UnsupportedFormatError(
          `Старые ${format.toUpperCase()} файлы не поддерживаются. ` +
          `Пожалуйста, сохраните файл в формате ${modernFormat.toUpperCase()} и попробуйте снова.`
        );
      }
      
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('cfb files')) {
        throw new UnsupportedFormatError(
          `Старые ${format.toUpperCase()} файлы не поддерживаются. ` +
          `Пожалуйста, сохраните файл в формате ${modernFormat.toUpperCase()} и попробуйте снова.`
        );
      }
      
      throw new ProcessingError(`${format.toUpperCase()} processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

/**
 * Общая стратегия для ODF форматов (ODT, ODP, ODS)
 */
function odfStrategy(format: string): StrategyFn {
  return async (buf) => {
    try {
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      if (error instanceof UnsupportedFormatError || error instanceof ProcessingError) {
        throw error;
      }
      throw new ProcessingError(`${format.toUpperCase()} processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

// --- Стратегии ---

export const strategies: Record<string, StrategyFn> = {
  doc: cfbLegacyStrategy('doc', 'docx'),
  
  docx: async (buf, _ext, options) => {
    const outputFormat = options?.outputFormat || 'text';
    
    if (outputFormat === 'html' || outputFormat === 'markdown') {
      try {
        const result = await mammoth.convertToHtml({ buffer: buf });
        if (result.value && result.value.trim().length > 0) {
          if (outputFormat === 'markdown') {
            return { text: NodeHtmlMarkdown.translate(result.value) };
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

  xml: async (buf) => {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(buf.toString("utf8"));
    return { text: JSON.stringify(parsed, null, 2) };
  },

  yml: async (buf) => {
    try {
      const xmlContent = buf.toString("utf8");
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlContent);
      
      if (parsed.yml_catalog && parsed.yml_catalog.shop) {
        return processYandexMarketYml(parsed);
      }
      
      return { text: JSON.stringify(parsed, null, 2) };
    } catch (error) {
      throw new ProcessingError(`YML processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  json: async (buf) => {
    try {
      const detected = chardet.detect(buf);
      const encoding = (detected || 'utf-8') as BufferEncoding;
      const jsonString = buf.toString(encoding);
      const parsed = JSON.parse(jsonString);
      
      if (typeof parsed === 'object' && parsed !== null) {
        const flattened = flattenJsonObject(parsed);
        return { 
          text: JSON.stringify(flattened, null, 2),
          warning: Object.keys(flattened).length > Object.keys(parsed).length ? 
            "Многоуровневая структура JSON была преобразована в плоский объект" : undefined
        };
      }
      
      return { text: JSON.stringify(parsed, null, 2) };
    } catch (error) {
      throw new ProcessingError(`JSON parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  odt: odfStrategy('odt'),
  odp: odfStrategy('odp'),
  ods: odfStrategy('ods'),

  xlsx: async (buf) => {
    const { readSheetNames } = await import("read-excel-file/node");
    const sheetNames = await readSheetNames(buf);
    const sheets: Record<string, unknown[]> = {};
    for (const sheetName of sheetNames) {
      const rows = await readXlsxFile(buf, { sheet: sheetName, dateFormat: 'YYYY-MM-DD' });
      const jsonData: unknown[] = [];
      for (const row of rows) {
        const rowData: Record<string, unknown> = {};
        row.forEach((cell: unknown, colIndex: number) => {
          if (cell !== null && cell !== undefined) {
            const columnLetter = numberToColumn(colIndex + 1);
            rowData[columnLetter] = cell instanceof Date ? cell.toISOString() : cell;
          }
        });
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData);
        }
      }
      sheets[sheetName] = limitExcelSheet(jsonData, 0);
    }
    return { sheets };
  },

  csv: async (buf) => {
    const detected = chardet.detect(buf);
    const encoding = (detected || 'utf-8') as BufferEncoding;
    const decoded = buf.toString(encoding);
    return streamCsvStrategy(decoded);
  },

  pdf: async (buf) => {
    try {
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      throw new ProcessingError(
        `PDF processing error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  txt: async (buf) => {
    if (buf.length > TXT_STREAM_SIZE_LIMIT) {
      return streamTxtStrategy(buf);
    }
    const detected = chardet.detect(buf);
    const encoding = (detected || 'utf-8') as BufferEncoding;
    return { text: buf.toString(encoding) };
  },

  ppt: cfbLegacyStrategy('ppt', 'pptx'),

  pptx: async (buf) => ({
    text: await extractViaOfficeParser(buf),
  }),

  html: async (buf) => processHtml(buf),
  htm: async (buf) => processHtml(buf),
};
