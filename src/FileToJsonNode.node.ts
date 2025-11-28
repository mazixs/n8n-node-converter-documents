/*
 * Convert File to JSON v7
 * ─────────────────────────────────────────────────────────
 * Универсальный кастом-нод для n8n.
 * Поддерживает: DOC, DOCX, XML, XLS, XLSX, CSV, PDF, TXT,
 *               PPT, PPTX, HTML / HTM, ODT, ODP, ODS, JSON.
 * Выход: { text: "..."} либо { sheets: {...} } + metadata.
 */

import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import * as ExcelJS from "exceljs";
import { parse as parseHtml } from 'node-html-parser';
import fileType from "file-type";
import jschardet from "jschardet";
import iconv from "iconv-lite";
import path from "path";
import { extractViaOfficeParser, limitExcelSheet } from "./helpers";
import {
  FileTypeError,
  FileTooLargeError,
  UnsupportedFormatError,
  EmptyFileError,
  ProcessingError,
} from "./errors";
import Papa from "papaparse";
import * as readline from "readline";
import { Readable } from "stream";
import sanitizeHtml from "sanitize-html";
import JSZip from "jszip";

import { 
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
} from 'n8n-workflow';

interface JsonTextResult {
  text: string;
  warning?: string;
  metadata: Record<string, unknown>;
}
interface JsonSheetResult {
  sheets: Record<string, unknown>;
  warning?: string;
  metadata: Record<string, unknown>;
}

type JsonResult = JsonTextResult | JsonSheetResult;

function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'unknown_file';
  }
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new FileTypeError('Invalid file name: contains path traversal characters');
  }
  const dangerousChars = /[<>:"|?*]/g;
  const controlChars = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + '-' + String.fromCharCode(159) + ']', 'g');
  const sanitized = fileName.replace(dangerousChars, '_').replace(controlChars, '_');
  return sanitized.length > 255 ? sanitized.substring(0, 255) : sanitized;
}

function checkCFBFormat(buf: Buffer, formatName: string, modernFormat: string): void {
  const signature = buf.slice(0, 8);
  const cfbSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  if (signature.equals(cfbSignature)) {
    throw new UnsupportedFormatError(
      `Старые ${formatName} файлы не поддерживаются. ` +
      `Пожалуйста, сохраните файл в формате ${modernFormat} и попробуйте снова.`
    );
  }
}

async function getOfficeMetadata(buf: Buffer): Promise<Record<string, unknown>> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const coreXml = await zip.file("docProps/core.xml")?.async("text");
    if (!coreXml) return {};
    
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(coreXml);
    const coreProps = parsed.coreProperties || {};
    
    const metadata: Record<string, unknown> = {};
    // Extract common Dublin Core properties
    if (coreProps.creator && typeof coreProps.creator === 'string') metadata.author = coreProps.creator;
    else if (coreProps.creator?.['#text']) metadata.author = coreProps.creator['#text'];

    if (coreProps.created && typeof coreProps.created === 'string') metadata.created = coreProps.created;
    else if (coreProps.created?.['#text']) metadata.created = coreProps.created['#text'];

    if (coreProps.modified && typeof coreProps.modified === 'string') metadata.modified = coreProps.modified;
    else if (coreProps.modified?.['#text']) metadata.modified = coreProps.modified['#text'];

    if (coreProps.title && typeof coreProps.title === 'string') metadata.title = coreProps.title;
    else if (coreProps.title?.['#text']) metadata.title = coreProps.title['#text'];
    
    return metadata;
  } catch {
    return {};
  }
}

interface ProcessingOptions {
  outputFormat?: string;
  maxExcelRows?: number;
  csvDelimiter?: string;
  preserveTables?: boolean;
}

async function processViaOfficeParser(buf: Buffer, formatName: string): Promise<Partial<JsonResult>> {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    if (error instanceof UnsupportedFormatError || error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`${formatName} processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface PromisePoolResult<R> {
  status: 'fulfilled' | 'rejected';
  value?: R;
  reason?: any;
}

async function promisePool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<PromisePoolResult<R>[]> {
  const results: PromisePoolResult<R>[] = new Array(items.length);
  let i = 0;
  const executing: Promise<void>[] = [];

  async function enqueue() {
    if (i >= items.length) return;
    const currentIndex = i++;
    const p = worker(items[currentIndex], currentIndex)
      .then((res) => {
        results[currentIndex] = { status: 'fulfilled', value: res };
      })
      .catch((err) => {
        results[currentIndex] = { status: 'rejected', reason: err };
      });
    
    const wrapped = p.then(() => {
      executing.splice(executing.indexOf(wrapped), 1);
    });
    
    executing.push(wrapped);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
    await enqueue();
  }
  await enqueue();
  await Promise.all(executing);
  return results;
}

const CSV_STREAM_ROW_LIMIT = 100000;
const CSV_STREAM_SIZE_LIMIT = 10 * 1024 * 1024;
const TXT_STREAM_SIZE_LIMIT = 10 * 1024 * 1024;
const TXT_STREAM_CHAR_LIMIT = 1_000_000;

async function streamTxtStrategy(buf: Buffer): Promise<Partial<JsonResult>> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: Readable.from(buf.toString("utf8")),
      crlfDelay: Infinity,
    });
    let text = "";
    let truncated = false;
    rl.on("line", (line) => {
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

function numberToColumn(num: number): string {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

function flattenJsonObject(obj: unknown, prefix: string = '', result: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== 'object' || obj instanceof Date || obj instanceof Buffer) {
    result[prefix || 'value'] = obj;
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const key = prefix ? `${prefix}[${index}]` : `item_${index}`;
      flattenJsonObject(item, key, result);
    });
    return result;
  }
  Object.keys(obj).forEach(key => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    flattenJsonObject((obj as Record<string, unknown>)[key], newKey, result);
  });
  return result;
}

function processYandexMarketYml(parsed: any): Partial<JsonResult> {
  try {
    const catalog = parsed.yml_catalog;
    const shop = Array.isArray(catalog.shop) ? catalog.shop[0] : catalog.shop;
    
    const shopInfo = {
      name: shop.name || 'Unknown Shop',
      company: shop.company || '',
      url: shop.url || '',
      date: catalog['@_date'] || catalog.date || ''
    };
    
    const currencies = [];
    if (shop.currencies?.currency) {
      const currencyList = Array.isArray(shop.currencies.currency) ? shop.currencies.currency : [shop.currencies.currency];
      currencies.push(...currencyList.map((curr: any) => ({
        id: curr['@_id'] || curr.id,
        rate: curr['@_rate'] || curr.rate || '1'
      })));
    }
    
    const categories = [];
    if (shop.categories?.category) {
      const categoryList = Array.isArray(shop.categories.category) ? shop.categories.category : [shop.categories.category];
      categories.push(...categoryList.map((cat: any) => ({
        id: cat['@_id'] || cat.id,
        name: cat['#text'] || cat.name || String(cat),
        parentId: cat['@_parentId'] || cat.parentId || null
      })));
    }
    
    const offers = [];
    if (shop.offers?.offer) {
      const offerList = Array.isArray(shop.offers.offer) ? shop.offers.offer : [shop.offers.offer];
      offers.push(...offerList.map((offer: any) => {
        const offerData: Record<string, unknown> = {
          id: offer['@_id'] || offer.id,
          available: offer['@_available'] || offer.available || 'true',
          name: offer.name || '',
          url: offer.url || '',
          price: offer.price || '',
          currencyId: offer.currencyId || '',
          categoryId: offer.categoryId || '',
          vendor: offer.vendor || '',
          description: offer.description || ''
        };
        
        const optionalFields = ['oldprice', 'vendorCode', 'barcode', 'sales_notes', 'delivery', 'pickup'];
        optionalFields.forEach(field => {
            if (offer[field]) offerData[field] = offer[field];
        });
        
        if (offer.picture) {
          const pictures = Array.isArray(offer.picture) ? offer.picture : [offer.picture];
          offerData.pictures = pictures.map((pic: string) => pic || '');
        }
        
        if (offer.param) {
          const params = Array.isArray(offer.param) ? offer.param : [offer.param];
          offerData.parameters = params.map((param: any) => ({
            name: param['@_name'] || param.name,
            value: param['#text'] || param.value || String(param),
            unit: param['@_unit'] || param.unit || null
          }));
        }
        return offerData;
      }));
    }
    
    const result = {
      yandex_market_catalog: {
        shop_info: shopInfo,
        currencies: currencies,
        categories: categories,
        offers: offers,
        statistics: {
          total_categories: categories.length,
          total_offers: offers.length,
          available_offers: offers.filter((o: any) => o.available === 'true' || o.available === true).length,
          unavailable_offers: offers.filter((o: any) => o.available === 'false' || o.available === false).length
        }
      }
    };
    
    return { 
      text: JSON.stringify(result, null, 2),
      warning: offers.length > 1000 ? `Большой каталог: ${offers.length} товаров` : undefined
    };
  } catch (error) {
    throw new ProcessingError(`YML catalog processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const strategies: Record<string, (buf: Buffer, ext?: string, options?: ProcessingOptions) => Promise<Partial<JsonResult>>> = {
  doc: async (buf) => {
    try {
      checkCFBFormat(buf, 'DOC (Word 97-2003)', 'DOCX (Word 2007+)');
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      if (error instanceof UnsupportedFormatError) throw error;
      if (error instanceof Error && error.message.includes('cfb files')) {
        throw new UnsupportedFormatError(
          "Старые DOC файлы (Word 97-2003) не поддерживаются. " +
          "Пожалуйста, сохраните файл в формате DOCX (Word 2007+) и попробуйте снова."
        );
      }
      throw new ProcessingError(`DOC processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  docx: async (buf, _ext, options) => {
    const outputFormat = options?.outputFormat || 'text';
    const metadata = await getOfficeMetadata(buf);

    if (outputFormat === 'html') {
      try {
        const result = await mammoth.convertToHtml({ buffer: buf });
        if (result.value && result.value.trim().length > 0) {
          return { text: result.value, metadata };
        }
      } catch {}
    }
    try {
      const text = await extractViaOfficeParser(buf);
      if (text && text.trim().length > 0) return { text, metadata };
    } catch {}
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      if (result.value && result.value.trim().length > 0) return { text: result.value, metadata };
    } catch {}
    
    // Custom XML parsing
    try {
      const zip = await JSZip.loadAsync(buf);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      if (documentXml) {
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(documentXml);
        const textParts: string[] = [];
        
        const extractText = (obj: any) => {
            if (!obj) return;
            if (typeof obj === 'string') return;
            if (Array.isArray(obj)) {
                obj.forEach(item => extractText(item));
                return;
            }
            if (typeof obj === 'object') {
                if (obj['w:t'] || obj['a:t']) {
                    const t = obj['w:t'] || obj['a:t'];
                    if (typeof t === 'string') textParts.push(t);
                    else if (t['#text']) textParts.push(t['#text']);
                    return;
                }
                Object.keys(obj).forEach(key => {
                    if ((key.startsWith('w:') || key.startsWith('a:') || key.startsWith('wp:') || key.startsWith('pic:') || key.startsWith('wps:')) 
                        && !key.startsWith('w:rsid') && !key.startsWith('@_')) {
                        extractText(obj[key]);
                    }
                });
            }
        };
        extractText(parsed);
        const extractedText = textParts.join(' ').trim();
        if (extractedText.length > 0) return { text: extractedText, metadata };
      }
    } catch {}
    
    return { text: '', metadata };
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
      const encoding = jschardet.detect(buf).encoding || "utf-8";
      const jsonString = iconv.decode(buf, encoding);
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
  odt: async (buf) => processViaOfficeParser(buf, 'ODT'),
  odp: async (buf) => processViaOfficeParser(buf, 'ODP'),
  ods: async (buf) => processViaOfficeParser(buf, 'ODS'),
  xlsx: async (buf, _ext, options) => {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buf as any);
    const sheets: Record<string, unknown[]> = {};
    const maxRows = options?.maxExcelRows || 0;
    
    const metadata: Record<string, unknown> = {};
    if (workbook.creator) metadata.author = workbook.creator;
    if (workbook.lastModifiedBy) metadata.lastModifiedBy = workbook.lastModifiedBy;
    if (workbook.created) metadata.created = workbook.created;
    if (workbook.modified) metadata.modified = workbook.modified;

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      const jsonData: unknown[] = [];
      worksheet.eachRow((row) => {
        const rowData: Record<string, unknown> = {};
        row.eachCell((cell, colNumber) => {
          const columnLetter = numberToColumn(colNumber);
          rowData[columnLetter] = cell.value;
        });
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData);
        }
      });
      sheets[sheetName] = limitExcelSheet(jsonData, maxRows);
    });
    return { sheets, metadata };
  },
  csv: async (buf, _ext, options) => {
    const encoding = jschardet.detect(buf).encoding || "utf-8";
    const decoded = iconv.decode(buf, encoding);
    if (buf.length > CSV_STREAM_SIZE_LIMIT) {
      return streamCsvStrategy(decoded, options?.csvDelimiter);
    }
    return processExcel(decoded, "csv", options?.csvDelimiter);
  },
  pdf: async (buf) => {
    try {
      const text = await extractViaOfficeParser(buf);
      const warning = (text.trim().length < 100 && buf.length > 50 * 1024) 
        ? "Предупреждение: Файл PDF большой, но текста найдено мало. Возможно, это скан-копия (изображение), требующая OCR." 
        : undefined;
      return { text, warning };
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
    const encoding = jschardet.detect(buf).encoding || "utf-8";
    return { text: iconv.decode(buf, encoding) };
  },
  ppt: async (buf) => {
    try {
      checkCFBFormat(buf, 'PPT (PowerPoint 97-2003)', 'PPTX (PowerPoint 2007+)');
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      if (error instanceof UnsupportedFormatError) throw error;
      if (error instanceof Error && error.message.includes('cfb files')) {
        throw new UnsupportedFormatError(
          "Старые PPT файлы (PowerPoint 97-2003) не поддерживаются. " +
          "Пожалуйста, сохраните файл в формате PPTX (PowerPoint 2007+) и попробуйте снова."
        );
      }
      throw new ProcessingError(`PPT processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  pptx: async (buf) => {
      const metadata = await getOfficeMetadata(buf);
      const res = await processViaOfficeParser(buf, 'PPTX');
      return { ...res, metadata };
  },
  html: async (buf, _ext, options) => processHtml(buf, options?.preserveTables),
  htm: async (buf, _ext, options) => processHtml(buf, options?.preserveTables),
};

async function streamCsvStrategy(data: string, delimiter?: string): Promise<Partial<JsonResult>> {
  return new Promise((resolve, reject) => {
    const rows: unknown[] = [];
    let rowCount = 0;
    
    const config = {
      header: true,
      skipEmptyLines: true,
      step: (result: any) => {
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
      error: (err: any) => reject(err),
    } as Papa.ParseConfig;
    
    if (delimiter && delimiter !== 'auto') {
        config.delimiter = delimiter;
    }

    Papa.parse(data, config);
  });
}

async function processExcel(data: Buffer | string, ext: string, csvDelimiter?: string): Promise<Partial<JsonResult>> {
  const workbook = new ExcelJS.Workbook();
  if (ext === "csv") {
    // If CSV, pass to stream strategy but need to ensure it doesn't loop if called from strategies.csv
    // Actually strategies.csv calls this if small file.
    // We can just use PapaParse directly here for small CSVs too to respect delimiter.
    return streamCsvStrategy(data as string, csvDelimiter);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(data as any);
  }
  const sheets: Record<string, unknown[]> = {};
  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    const jsonData: unknown[] = [];
    worksheet.eachRow((row) => {
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const columnLetter = numberToColumn(colNumber);
        rowData[columnLetter] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        jsonData.push(rowData);
      }
    });
    sheets[sheetName] = jsonData;
  });
  return { sheets };
}

async function processHtml(buf: Buffer, preserveTables: boolean = false): Promise<Partial<JsonResult>> {
  try {
    const root = parseHtml(buf.toString("utf8"));
    
    let cleanText: string;
    
    if (preserveTables) {
        // Allow tables and basic formatting
        cleanText = sanitizeHtml(root.toString(), { 
            allowedTags: ['table', 'tbody', 'thead', 'tr', 'td', 'th', 'caption', 'p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li'], 
            allowedAttributes: {
                'td': ['colspan', 'rowspan'],
                'th': ['colspan', 'rowspan']
            }
        });
    } else {
        // Strip all tags, pure text
        const rawText = root.text.replace(/\s+/g, " ").trim();
        cleanText = sanitizeHtml(rawText, { allowedTags: [], allowedAttributes: {} });
    }
    
    return { text: cleanText };
  } catch (error) {
    throw new ProcessingError(`HTML processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class FileToJsonNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Document Converter",
    name: "convertFileToJson",
    icon: "file:icon.svg",
    group: ["transform"],
    version: 5,
    description:
      "Convert documents to text/JSON (DOCX→HTML, XLSX→sheets, PDF→text, etc.)",
    defaults: { name: "Document Converter" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: "Binary Property",
        name: "binaryPropertyName",
        type: "string",
        default: "data",
        description: "Name of the binary property that contains the file",
      },
      {
        displayName: "Max File Size (MB)",
        name: "maxFileSize",
        type: "number",
        default: 50,
        description: "Maximum file size in megabytes",
        typeOptions: {
          minValue: 1,
          maxValue: 100
        }
      },
      {
        displayName: "Max Concurrency",
        name: "maxConcurrency",
        type: "number",
        default: 4,
        description: "Maximum number of files processed concurrently",
        typeOptions: {
          minValue: 1,
          maxValue: 10
        }
      },
      {
        displayName: "Max Excel Rows",
        name: "maxExcelRows",
        type: "number",
        default: 0,
        description: "Maximum number of rows to extract from Excel sheets (0 = unlimited). Useful to prevent out-of-memory errors on large files.",
      },
      {
        displayName: "CSV Delimiter",
        name: "csvDelimiter",
        type: "options",
        options: [
            { name: "Auto Detect", value: "auto" },
            { name: "Comma (,)", value: "," },
            { name: "Semicolon (;)", value: ";" },
            { name: "Tab", value: "\t" },
            { name: "Pipe (|)", value: "|" },
        ],
        default: "auto",
        description: "Delimiter to use for CSV files",
      },
      {
        displayName: "Output Format (DOCX)",
        name: "outputFormat",
        type: "options",
        options: [
          {
            name: "Plain Text",
            value: "text",
            description: "Extract text only (fastest, smallest output)",
          },
          {
            name: "HTML",
            value: "html",
            description: "Convert to HTML (preserves tables, formatting, structure)",
          },
        ],
        default: "text",
        description: "Choose output format for DOCX files",
      },
      {
        displayName: "Preserve Tables (HTML)",
        name: "preserveTables",
        type: "boolean",
        default: true,
        description: "Whether to preserve HTML tables in the output (useful for RAG/LLM context)",
        displayOptions: {
            show: {
                outputFormat: ["html"]
            }
        }
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const supported = [
      "doc", "docx", "xml", "xlsx", "csv", "pdf", "txt",
      "pptx", "html", "htm", "odt", "odp", "ods", "json", "yml"
    ];
    const maxFileSize = (this.getNodeParameter('maxFileSize', 0, 50) as number) * 1024 * 1024;
    const maxConcurrency = this.getNodeParameter('maxConcurrency', 0, 4) as number;
    
    const processItem = async (item: unknown, i: number): Promise<INodeExecutionData> => {
      const prop = this.getNodeParameter("binaryPropertyName", i, "data");
      const maxExcelRows = this.getNodeParameter('maxExcelRows', i, 0) as number;
      const csvDelimiter = this.getNodeParameter('csvDelimiter', i, 'auto') as string;
      const outputFormat = this.getNodeParameter('outputFormat', i, 'text') as string;
      const preserveTables = this.getNodeParameter('preserveTables', i, true) as boolean;
      
      if (!item || typeof item !== "object")
        throw new FileTypeError(`Item #${i} is not an object`);
      
      const itemObj = item as Record<string, unknown>;
      if (!itemObj.binary || typeof itemObj.binary !== "object")
        throw new FileTypeError(`Item #${i} does not contain binary data`);
      
      const binary = itemObj.binary as Record<string, unknown>;
      if (!binary[prop as string])
        throw new FileTypeError(`Binary property "${prop}" is missing (item ${i})`);
      
      const binaryProp = binary[prop as string] as Record<string, unknown>;
      if (!binaryProp.fileName || typeof binaryProp.fileName !== "string")
        throw new FileTypeError(`File does not contain a valid name (item ${i})`);
      
      const buf = await this.helpers.getBinaryDataBuffer(i, prop as string);
      if (!Buffer.isBuffer(buf) || buf.length === 0)
        throw new EmptyFileError("File is empty or contains no data");
      if (buf.length > maxFileSize)
        throw new FileTooLargeError(`File is too large (maximum ${maxFileSize / 1024 / 1024} MB)`);

      const name = sanitizeFileName(binaryProp.fileName ?? "");
      let ext = path.extname(name).slice(1).toLowerCase();

      if (!ext || !supported.includes(ext)) {
        try {
          const ft = await fileType.fromBuffer(buf);
          if (ft?.ext && supported.includes(ft.ext)) {
            ext = ft.ext;
          } else {
            throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
          }
        } catch (error) {
          this.logger?.warn('File type detection failed', { fileName: name });
          throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
        }
      }

      let json: Partial<JsonResult> = {};
      
      if (!strategies[ext]) {
        throw new UnsupportedFormatError(`Format "${ext}" is not supported`);
      }
      
      json = await strategies[ext](buf, ext, { 
        outputFormat, 
        maxExcelRows, 
        csvDelimiter,
        preserveTables 
      });

      return {
        json: {
          fileName: name,
          fileType: ext,
          ...json,
        },
      };
    };

    const results = await promisePool(items, processItem, maxConcurrency);
    
    const executionData: INodeExecutionData[] = [];
    const errors: Error[] = [];

    results.forEach((res, index) => {
      if (res.status === 'fulfilled' && res.value) {
        executionData.push(res.value);
      } else {
        const error = res.reason;
        this.logger?.error(`Error processing item ${index}`, { error });
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    });

    if (executionData.length === 0 && errors.length > 0) {
        throw errors[0];
    }

    return [executionData];
  }
}
