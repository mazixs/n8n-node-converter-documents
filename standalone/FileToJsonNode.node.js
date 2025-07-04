"use strict";
/*
 * Convert File to JSON v5
 * ─────────────────────────────────────────────────────────
 * Универсальный кастом-нод для n8n.
 * Поддерживает: DOC, DOCX, XML, XLS, XLSX, CSV, PDF, TXT,
 *               PPT, PPTX, HTML / HTM, ODT, ODP, ODS, JSON.
 * Выход: { text: "..."} либо { sheets: {...} } + metadata.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileToJsonNode = void 0;
const xml2js_1 = require("xml2js");
const mammoth_1 = __importDefault(require("mammoth"));
const ExcelJS = __importStar(require("exceljs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const cheerio = __importStar(require("cheerio"));
const file_type_1 = require("file-type");
const chardet_1 = __importDefault(require("chardet"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const errors_1 = require("./errors");
const papaparse_1 = __importDefault(require("papaparse"));
const readline = __importStar(require("readline"));
const stream_1 = require("stream");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
/**
 * Безопасная валидация и очистка имени файла
 */
function sanitizeFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return 'unknown_file';
    }
    // Проверка на path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        throw new errors_1.FileTypeError('Invalid file name: contains path traversal characters');
    }
    // Удаляем опасные символы - создаем control characters regex программно
    const dangerousChars = /[<>:"|?*]/g;
    const controlChars = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + '-' + String.fromCharCode(159) + ']', 'g');
    const sanitized = fileName.replace(dangerousChars, '_').replace(controlChars, '_');
    // Ограничиваем длину
    return sanitized.length > 255 ? sanitized.substring(0, 255) : sanitized;
}
/**
 * Promise pool для ограничения количества одновременных задач
 */
async function promisePool(items, worker, concurrency) {
    const results = [];
    let i = 0;
    const executing = [];
    async function enqueue() {
        if (i >= items.length)
            return;
        const currentIndex = i++;
        const p = worker(items[currentIndex], currentIndex).then((res) => {
            results[currentIndex] = res;
        });
        executing.push(p.then(() => {
            executing.splice(executing.indexOf(p), 1);
        }));
        if (executing.length < concurrency) {
            await enqueue();
        }
        else {
            await Promise.race(executing);
            await enqueue();
        }
    }
    await enqueue();
    await Promise.all(executing);
    return results;
}
const CSV_STREAM_ROW_LIMIT = 100000; // лимит строк для перехода на потоковую обработку
const CSV_STREAM_SIZE_LIMIT = 10 * 1024 * 1024; // 10 МБ
const TXT_STREAM_SIZE_LIMIT = 10 * 1024 * 1024; // 10 МБ
const TXT_STREAM_CHAR_LIMIT = 1000000; // 1 млн символов
async function streamTxtStrategy(buf) {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: stream_1.Readable.from(buf.toString("utf8")),
            crlfDelay: Infinity,
        });
        let text = "";
        let truncated = false;
        rl.on("line", (line) => {
            if (text.length < TXT_STREAM_CHAR_LIMIT) {
                text += line + "\n";
            }
            else {
                truncated = true;
            }
        });
        rl.on("close", () => {
            resolve({
                text: truncated ? text.slice(0, TXT_STREAM_CHAR_LIMIT) : text,
                warning: truncated ? `Текст обрезан до ${TXT_STREAM_CHAR_LIMIT} символов` : undefined,
            });
        });
        rl.on("error", (err) => reject(err));
    });
}
/**
 * Конвертация номера колонки в букву (A, B, C...)
 */
function numberToColumn(num) {
    let result = '';
    while (num > 0) {
        num--; // Делаем 0-based
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26);
    }
    return result;
}
/**
 * Функция для нормализации JSON объектов
 * Преобразует многоуровневые структуры в плоский объект
 */
function flattenJsonObject(obj, prefix = '', result = {}) {
    if (obj === null || obj === undefined) {
        return result;
    }
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
        flattenJsonObject(obj[key], newKey, result);
    });
    return result;
}
// Стратегии обработки форматов
const strategies = {
    doc: async (buf) => {
        try {
            // Проверяем, является ли это старым DOC файлом (CFB формат)
            const signature = buf.slice(0, 8);
            const cfbSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
            if (signature.equals(cfbSignature)) {
                throw new errors_1.UnsupportedFormatError("Старые DOC файлы (Word 97-2003) не поддерживаются. " +
                    "Пожалуйста, сохраните файл в формате DOCX (Word 2007+) и попробуйте снова.");
            }
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            if (error instanceof errors_1.UnsupportedFormatError) {
                throw error;
            }
            // Если это ошибка officeparser о CFB файлах, выдаем понятное сообщение
            if (error instanceof Error && error.message.includes('cfb files')) {
                throw new errors_1.UnsupportedFormatError("Старые DOC файлы (Word 97-2003) не поддерживаются. " +
                    "Пожалуйста, сохраните файл в формате DOCX (Word 2007+) и попробуйте снова.");
            }
            throw new errors_1.ProcessingError(`DOC processing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    docx: async (buf) => {
        // Используем officeparser вместо mammoth для единообразия
        try {
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            // Fallback на mammoth если officeparser не справился
            try {
                const result = await mammoth_1.default.extractRawText({ buffer: buf });
                return { text: result.value };
            }
            catch {
                throw new errors_1.ProcessingError(`DOCX processing error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    },
    xml: async (buf) => {
        const parsed = await (0, xml2js_1.parseStringPromise)(buf.toString("utf8"));
        return { text: JSON.stringify(parsed, null, 2) };
    },
    json: async (buf) => {
        try {
            const encoding = chardet_1.default.detect(buf) || "utf-8";
            const jsonString = iconv_lite_1.default.decode(buf, encoding);
            const parsed = JSON.parse(jsonString);
            // Если это простой объект, нормализуем его
            if (typeof parsed === 'object' && parsed !== null) {
                const flattened = flattenJsonObject(parsed);
                return {
                    text: JSON.stringify(flattened, null, 2),
                    warning: Object.keys(flattened).length > Object.keys(parsed).length ?
                        "Многоуровневая структура JSON была преобразована в плоский объект" : undefined
                };
            }
            // Если это массив или примитив, возвращаем как есть
            return { text: JSON.stringify(parsed, null, 2) };
        }
        catch (error) {
            throw new errors_1.ProcessingError(`JSON parsing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    odt: async (buf) => {
        try {
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            throw new errors_1.ProcessingError(`ODT processing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    odp: async (buf) => {
        try {
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            throw new errors_1.ProcessingError(`ODP processing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    ods: async (buf) => {
        try {
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            throw new errors_1.ProcessingError(`ODS processing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    xlsx: async (buf) => {
        // Пробуем сначала officeparser, затем ExcelJS как fallback
        try {
            const _text = await (0, helpers_1.extractViaOfficeParser)(buf);
            // officeparser возвращает текст, но для Excel нам нужна структура
            // Поэтому используем ExcelJS для полной функциональности
            throw new Error("Use ExcelJS for structured data");
        }
        catch {
            // Используем ExcelJS для полной поддержки структуры Excel
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buf);
            const sheets = {};
            workbook.eachSheet((worksheet, _sheetId) => {
                const sheetName = worksheet.name;
                const jsonData = [];
                worksheet.eachRow((row, _rowNumber) => {
                    const rowData = {};
                    row.eachCell((cell, colNumber) => {
                        const columnLetter = numberToColumn(colNumber - 1);
                        rowData[columnLetter] = cell.value;
                    });
                    if (Object.keys(rowData).length > 0) {
                        jsonData.push(rowData);
                    }
                });
                sheets[sheetName] = (0, helpers_1.limitExcelSheet)(jsonData);
            });
            return { sheets };
        }
    },
    csv: async (buf) => {
        const encoding = chardet_1.default.detect(buf) || "utf-8";
        const decoded = iconv_lite_1.default.decode(buf, encoding);
        if (buf.length > CSV_STREAM_SIZE_LIMIT) {
            return streamCsvStrategy(decoded);
        }
        return processExcel(decoded, "csv");
    },
    pdf: async (buf) => {
        // Используем officeparser вместо pdf-parse (officeparser использует pdf.js с 2024/05/06)
        try {
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            // Fallback на pdf-parse если officeparser не справился
            try {
                const data = await (0, pdf_parse_1.default)(buf);
                return { text: data.text };
            }
            catch {
                throw new errors_1.ProcessingError(`PDF processing error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    },
    txt: async (buf) => {
        if (buf.length > TXT_STREAM_SIZE_LIMIT) {
            return streamTxtStrategy(buf);
        }
        const encoding = chardet_1.default.detect(buf) || "utf-8";
        return { text: iconv_lite_1.default.decode(buf, encoding) };
    },
    ppt: async (buf) => {
        try {
            // Проверяем, является ли это старым PPT файлом (CFB формат)
            const signature = buf.slice(0, 8);
            const cfbSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
            if (signature.equals(cfbSignature)) {
                throw new errors_1.UnsupportedFormatError("Старые PPT файлы (PowerPoint 97-2003) не поддерживаются. " +
                    "Пожалуйста, сохраните файл в формате PPTX (PowerPoint 2007+) и попробуйте снова.");
            }
            return { text: await (0, helpers_1.extractViaOfficeParser)(buf) };
        }
        catch (error) {
            if (error instanceof errors_1.UnsupportedFormatError) {
                throw error;
            }
            // Если это ошибка officeparser о CFB файлах, выдаем понятное сообщение
            if (error instanceof Error && error.message.includes('cfb files')) {
                throw new errors_1.UnsupportedFormatError("Старые PPT файлы (PowerPoint 97-2003) не поддерживаются. " +
                    "Пожалуйста, сохраните файл в формате PPTX (PowerPoint 2007+) и попробуйте снова.");
            }
            throw new errors_1.ProcessingError(`PPT processing error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    pptx: async (buf) => ({
        text: await (0, helpers_1.extractViaOfficeParser)(buf),
    }),
    html: async (buf) => processHtml(buf),
    htm: async (buf) => processHtml(buf),
};
async function streamCsvStrategy(data) {
    return new Promise((resolve, reject) => {
        const rows = [];
        let rowCount = 0;
        papaparse_1.default.parse(data, {
            header: true,
            skipEmptyLines: true,
            step: (result) => {
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
            error: (err) => reject(err),
        });
    });
}
async function processExcel(data, ext) {
    const workbook = new ExcelJS.Workbook();
    if (ext === "csv") {
        // Для CSV используем Papa Parse (уже реализовано в streamCsvStrategy)
        return streamCsvStrategy(data);
    }
    else {
        // Для Excel файлов загружаем через ExcelJS
        await workbook.xlsx.load(data);
    }
    const sheets = {};
    workbook.eachSheet((worksheet, _sheetId) => {
        const sheetName = worksheet.name;
        const jsonData = [];
        worksheet.eachRow((row, _rowNumber) => {
            const rowData = {};
            row.eachCell((cell, colNumber) => {
                const columnLetter = numberToColumn(colNumber);
                rowData[columnLetter] = cell.value;
            });
            if (Object.keys(rowData).length > 0) {
                jsonData.push(rowData);
            }
        });
        sheets[sheetName] = (0, helpers_1.limitExcelSheet)(jsonData);
    });
    return { sheets };
}
/**
 * Обработка HTML/HTM файлов
 */
async function processHtml(buf) {
    try {
        const $ = cheerio.load(buf.toString("utf8"));
        const rawText = $("body").text().replace(/\s+/g, " ").trim();
        const cleanText = (0, sanitize_html_1.default)(rawText, { allowedTags: [], allowedAttributes: {} });
        return { text: cleanText };
    }
    catch (error) {
        throw new errors_1.ProcessingError(`HTML processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Custom n8n node: convert files to JSON/text
 * Supports DOCX, XML, XLSX, CSV, PDF, TXT, PPTX, HTML
 */
class FileToJsonNode {
    constructor() {
        this.description = {
            displayName: "Convert File to JSON",
            name: "convertFileToJson",
            icon: "file:icon.svg",
            group: ["transform"],
            version: 5,
            description: "DOCX / XML / XLSX / CSV / PDF / TXT / PPTX / HTML → JSON|text",
            defaults: { name: "Convert File to JSON" },
            inputs: ["main"],
            outputs: ["main"],
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
            ],
        };
    }
    /**
     * Main execution method for n8n node
     */
    async execute() {
        const items = this.getInputData();
        const supported = [
            "doc",
            "docx",
            "xml",
            "xlsx",
            "csv",
            "pdf",
            "txt",
            "pptx",
            "html",
            "htm",
        ];
        const maxFileSize = this.getNodeParameter('maxFileSize', 0, 50) * 1024 * 1024; // MB в байты
        const maxConcurrency = this.getNodeParameter('maxConcurrency', 0, 4);
        const processItem = async (item, i) => {
            const prop = this.getNodeParameter("binaryPropertyName", i, "data");
            // --- Input data validation ---
            if (!item || typeof item !== "object")
                throw new errors_1.FileTypeError(`Item #${i} is not an object`);
            const itemObj = item;
            if (!itemObj.binary || typeof itemObj.binary !== "object")
                throw new errors_1.FileTypeError(`Item #${i} does not contain binary data`);
            const binary = itemObj.binary;
            if (!binary[prop])
                throw new errors_1.FileTypeError(`Binary property "${prop}" is missing (item ${i})`);
            const binaryProp = binary[prop];
            if (!binaryProp.fileName || typeof binaryProp.fileName !== "string")
                throw new errors_1.FileTypeError(`File does not contain a valid name (item ${i})`);
            const buf = await this.helpers.getBinaryDataBuffer(i, prop);
            if (!Buffer.isBuffer(buf) || buf.length === 0)
                throw new errors_1.EmptyFileError("File is empty or contains no data");
            if (buf.length > maxFileSize)
                throw new errors_1.FileTooLargeError("File is too large (maximum 50 MB)");
            // --- End of validation ---
            const name = sanitizeFileName(binaryProp.fileName ?? "");
            let ext = path_1.default.extname(name).slice(1).toLowerCase();
            /* ── autodetect ── */
            if (!ext || !supported.includes(ext)) {
                try {
                    const ft = await (0, file_type_1.fileTypeFromBuffer)(buf);
                    if (ft?.ext && supported.includes(ft.ext)) {
                        ext = ft.ext;
                    }
                    else {
                        throw new errors_1.UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
                    }
                }
                catch (error) {
                    this.logger?.warn('File type detection failed', {
                        fileName: name,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    throw new errors_1.UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
                }
            }
            this.logger?.info("ConvertFileToJSON →", {
                file: name || "[no-name]",
                ext,
                size: buf.length,
            });
            let json = {};
            const startTime = performance.now();
            try {
                if (!strategies[ext]) {
                    throw new errors_1.UnsupportedFormatError(`Format "${ext}" is not supported`);
                }
                json = await strategies[ext](buf, ext);
            }
            catch (e) {
                throw new errors_1.ProcessingError(`${ext.toUpperCase()} processing error: ${e.message}`);
            }
            const processingTime = performance.now() - startTime;
            this.logger?.info('Processing completed', {
                file: name,
                size: buf.length,
                time: `${processingTime.toFixed(2)}ms`,
                type: ext
            });
            if ("text" in json &&
                (!json.text || json.text.trim().length === 0))
                throw new errors_1.EmptyFileError("File is empty or contains no text");
            json.metadata = {
                fileName: sanitizeFileName(name) || null,
                fileSize: buf.length,
                fileType: ext,
                processedAt: new Date().toISOString(),
            };
            return { json };
        };
        const results = await promisePool(items, processItem, maxConcurrency);
        // Объединяем все результаты в один item
        return [[{
                    json: {
                        files: results.map(result => result.json),
                        totalFiles: results.length,
                        processedAt: new Date().toISOString()
                    }
                }]];
    }
}
exports.FileToJsonNode = FileToJsonNode;
//# sourceMappingURL=FileToJsonNode.node.js.map