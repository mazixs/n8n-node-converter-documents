/*
 * Convert File to JSON
 * ─────────────────────────────────────────────────────────
 * Универсальный кастом-нод для n8n.
 * Поддерживает: DOC, DOCX, XML, YML, XLSX, CSV, PDF, TXT, MD,
 *               PPT, PPTX, HTML / HTM, ODT, ODP, ODS, JSON.
 * Выход: { text: "..."} либо { sheets: {...} } + metadata.
 */

import path from "path";
import { fileTypeFromBuffer } from './file-type-loader';

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
} from 'n8n-workflow';

import {
  FileTypeError,
  FileTooLargeError,
  UnsupportedFormatError,
  EmptyFileError,
  ProcessingError,
} from "./errors";
import { sanitizeFileName, promisePool } from "./utils";
import { strategies } from "./strategies";
import { executeV6 } from './pipeline/v6';
import { validateZipArchive } from './security/archive';
import type { DocxOutputFormat, JsonResult, StrategyResult } from "./types";

function isSupportedFormat(extension: string): extension is keyof typeof strategies {
  return Object.prototype.hasOwnProperty.call(strategies, extension);
}

function isStrategyResult(value: unknown): value is StrategyResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as Record<string, unknown>;
  const hasText = typeof result.text === 'string';
  const hasSheets = Boolean(
    result.sheets && typeof result.sheets === 'object' && !Array.isArray(result.sheets),
  );
  const hasValidWarning = result.warning === undefined || typeof result.warning === 'string';

  return hasValidWarning && hasText !== hasSheets;
}

/**
 * Custom n8n node: convert files to JSON/text
 * Supports DOCX, XML, YML, XLSX, CSV, PDF, TXT, PPTX, HTML
 */
export class ConvertFileToJson implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Convert File to JSON",
    name: "convertFileToJson",
    icon: "file:icon.svg",
    group: ["transform"],
    version: [5, 6],
    description:
      "DOCX / XML / YML / XLSX / CSV / PDF / TXT / MD / PPTX / HTML → JSON|text",
    subtitle: 'Document → JSON/Text',
    defaults: { name: "Convert File to JSON" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
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
        },
        displayOptions: { show: { '@version': [5] } },
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
        },
        displayOptions: { show: { '@version': [5] } },
      },
      {
        displayName: "Output Format",
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
          {
            name: "Markdown",
            value: "markdown",
            description: "Convert to Markdown with GFM tables (ideal for AI/LLM/RAG)",
          },
        ],
        default: "text",
        description: "Choose output format for DOCX files. Markdown and HTML preserve tables and formatting for AI/LLM processing.",
      },
      {
        displayName: 'JSON Output Mode',
        name: 'jsonMode',
        type: 'options',
        options: [
          { name: 'Preserve Structure', value: 'preserve' },
          { name: 'Flatten', value: 'flatten' },
        ],
        default: 'preserve',
        description: 'Whether nested JSON should be preserved or converted to dotted keys',
        displayOptions: { show: { '@version': [6] } },
      },
      {
        displayName: 'Keep Source Binary',
        name: 'keepSourceBinary',
        type: 'boolean',
        default: false,
        description: 'Whether to copy the source binary property to the output item',
        displayOptions: { show: { '@version': [6] } },
      },
      {
        displayName: 'Advanced Options',
        name: 'advancedOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { '@version': [6] } },
        options: [
          {
            displayName: 'Max File Size (MB)',
            name: 'maxFileSizeMb',
            type: 'number',
            default: 50,
            description: 'Maximum input size; use 0 for no workflow-level limit',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max Concurrency',
            name: 'maxConcurrency',
            type: 'number',
            default: 4,
            description: 'Number of input files processed concurrently',
            typeOptions: { minValue: 1 },
          },
          {
            displayName: 'Max Rows per Sheet',
            name: 'maxRows',
            type: 'number',
            default: 100000,
            description: 'CSV/XLSX row limit per sheet; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max TXT Characters',
            name: 'maxTextChars',
            type: 'number',
            default: 1000000,
            description: 'TXT character limit; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max Output Characters',
            name: 'maxOutputChars',
            type: 'number',
            default: 1000000,
            description: 'Maximum serialized document content; text is truncated, structured output fails safely; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max Archive Entries',
            name: 'maxArchiveEntries',
            type: 'number',
            default: 10000,
            description: 'Maximum entries in Office ZIP containers; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max Archive Uncompressed Size (MB)',
            name: 'maxArchiveUncompressedMb',
            type: 'number',
            default: 200,
            description: 'Maximum expanded Office container size; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Max Compression Ratio',
            name: 'maxCompressionRatio',
            type: 'number',
            default: 100,
            description: 'Maximum expanded-to-compressed ZIP ratio; use 0 for unlimited',
            typeOptions: { minValue: 0 },
          },
        ],
      },
      {
        displayName: 'OCR Mode',
        name: 'ocrMode',
        type: 'options',
        options: [
          { name: 'Disabled', value: 'disabled' },
          { name: 'When No Text Found', value: 'whenEmpty' },
          { name: 'Always', value: 'always' },
        ],
        default: 'disabled',
        description: 'OCR is local but CPU/RAM intensive and intended for self-hosted n8n',
        displayOptions: { show: { '@version': [6] } },
      },
      {
        displayName: 'OCR Options',
        name: 'ocrOptions',
        type: 'collection',
        placeholder: 'Add OCR Option',
        default: {},
        displayOptions: { show: { '@version': [6], ocrMode: ['whenEmpty', 'always'] } },
        options: [
          {
            displayName: 'Languages',
            name: 'languages',
            type: 'string',
            default: 'eng',
            placeholder: 'rus+eng',
            description: 'Tesseract language codes separated by +',
          },
          {
            displayName: 'Language Data Path',
            name: 'languageDataPath',
            type: 'string',
            default: '',
            description: 'Optional local path or HTTPS URL containing Tesseract language data',
          },
          {
            displayName: 'Cache Path',
            name: 'cachePath',
            type: 'string',
            default: '',
            description: 'Optional writable directory for cached language models',
          },
          {
            displayName: 'Render Scale',
            name: 'scale',
            type: 'number',
            default: 2,
            typeOptions: { minValue: 1 },
          },
          {
            displayName: 'Max Pages',
            name: 'maxPages',
            type: 'number',
            default: 10,
            description: 'Maximum pages recognized; use 0 for all pages',
            typeOptions: { minValue: 0 },
          },
          {
            displayName: 'Page Timeout (Seconds)',
            name: 'pageTimeoutSeconds',
            type: 'number',
            default: 60,
            typeOptions: { minValue: 1 },
          },
          {
            displayName: 'OCR Concurrency',
            name: 'ocrConcurrency',
            type: 'number',
            default: 1,
            description: 'Maximum PDF files recognized concurrently',
            typeOptions: { minValue: 1 },
          },
        ],
      },
    ],
  };

  /**
   * Main execution method for n8n node
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    if (this.getNode().typeVersion >= 6) return executeV6.call(this);

    const items = this.getInputData();
    const maxFileSize = (this.getNodeParameter('maxFileSize', 0, 50) as number) * 1024 * 1024;
    const maxConcurrency = this.getNodeParameter('maxConcurrency', 0, 4) as number;

    const processItem = async (item: unknown, i: number): Promise<INodeExecutionData> => {
      const prop = this.getNodeParameter("binaryPropertyName", i, "data");
      // --- Input data validation ---
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
      // --- End of validation ---

      const name = sanitizeFileName(binaryProp.fileName ?? "");
      let ext = path.extname(name).slice(1).toLowerCase();

      /* ── autodetect ── */
      if (!isSupportedFormat(ext)) {
        let detectedExtension: string | undefined;
        try {
          const ft = await fileTypeFromBuffer(buf);
          detectedExtension = ft?.ext;
        } catch (error) {
          this.logger?.warn('File type detection failed', { 
            fileName: name, 
            error: error instanceof Error ? error.message : String(error) 
          });
          throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
        }

        if (!detectedExtension || !isSupportedFormat(detectedExtension)) {
          throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
        }
        ext = detectedExtension;
      }

      this.logger?.info("ConvertFileToJSON →", {
        file: name || "[no-name]",
        ext,
        size: buf.length,
      });

      if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) {
        await validateZipArchive(buf, {
          maxEntries: 10_000,
          maxUncompressedBytes: 200 * 1024 * 1024,
          maxCompressionRatio: 100,
        });
      }

      const startTime = performance.now();
      let strategyResult: StrategyResult;
      const strategy = isSupportedFormat(ext) ? strategies[ext] : undefined;

      if (!strategy) {
        throw new UnsupportedFormatError(`Format "${ext}" is not supported`);
      }
      
      try {
        const options = ext === 'docx'
          ? { outputFormat: this.getNodeParameter('outputFormat', i, 'text') as DocxOutputFormat }
          : undefined;
        strategyResult = await strategy(buf, ext, options);
      } catch (e) {
        if (e instanceof FileTypeError ||
            e instanceof FileTooLargeError ||
            e instanceof UnsupportedFormatError ||
            e instanceof EmptyFileError ||
            e instanceof ProcessingError) {
          throw e;
        }
        throw new ProcessingError(
          `${ext.toUpperCase()} processing error: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      if (!isStrategyResult(strategyResult)) {
        throw new ProcessingError(`${ext.toUpperCase()} processing error: strategy returned an invalid result`);
      }

      if ("text" in strategyResult && strategyResult.text.trim().length === 0) {
        throw new EmptyFileError(
          `File "${name}" (${ext.toUpperCase()}, ${(buf.length / 1024).toFixed(2)} KB) contains no extractable text. ` +
          `Possible reasons: (1) File contains only images/graphics without text, ` +
          `(2) File is password-protected or encrypted, ` +
          `(3) File structure is corrupted, ` +
          `(4) File was created with a non-standard application. ` +
          `Try: Open file in original application and verify it contains text, then save it again.`
        );
      }

      const json = {
        ...strategyResult,
        metadata: {
          fileName: name || null,
          fileSize: buf.length,
          fileType: ext,
          processedAt: new Date().toISOString(),
        },
      } as JsonResult;

      const processingTime = performance.now() - startTime;
      this.logger?.info('Processing completed', {
        file: name,
        size: buf.length,
        time: `${processingTime.toFixed(2)}ms`,
        type: ext,
      });

      return {
        json: json as unknown as INodeExecutionData['json'],
        pairedItem: { item: i },
      };
    };

    const results = await promisePool(items, processItem, maxConcurrency);

    return [[{
      json: {
        files: results.map(result => result.json),
        totalFiles: results.length,
        processedAt: new Date().toISOString()
      },
      pairedItem: items.map((_item, item) => ({ item })),
    }]];
  }
}

export { ConvertFileToJson as FileToJsonNode };
