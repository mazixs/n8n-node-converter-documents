/*
 * Convert File to JSON v6
 * ─────────────────────────────────────────────────────────
 * Универсальный кастом-нод для n8n.
 * Поддерживает: DOC, DOCX, XML, XLS, XLSX, CSV, PDF, TXT,
 *               PPT, PPTX, HTML / HTM, ODT, ODP, ODS, JSON.
 * Выход: { text: "..."} либо { sheets: {...} } + metadata.
 */

import path from "path";
import { fromBuffer as fileTypeFromBuffer } from "file-type";

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
import type { JsonResult, JsonTextResult } from "./types";

const SUPPORTED_FORMATS = [
  "doc", "docx", "xml", "yml", "xlsx", "csv", "pdf",
  "txt", "ppt", "pptx", "html", "htm", "odt", "odp", "ods", "json",
];

/**
 * Custom n8n node: convert files to JSON/text
 * Supports DOCX, XML, YML, XLSX, CSV, PDF, TXT, PPTX, HTML
 */
export class FileToJsonNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Convert File to JSON",
    name: "convertFileToJson",
    icon: "file:icon.svg",
    group: ["transform"],
    version: 5,
    description:
      "DOCX / XML / YML / XLSX / CSV / PDF / TXT / PPTX / HTML → JSON|text",
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
          {
            name: "Markdown",
            value: "markdown",
            description: "Convert to Markdown with GFM tables (ideal for AI/LLM/RAG)",
          },
        ],
        default: "text",
        description: "Choose output format for DOCX files. Markdown and HTML preserve tables and formatting for AI/LLM processing.",
      },
    ],
  };

  /**
   * Main execution method for n8n node
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
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
      if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
        try {
          const ft = await fileTypeFromBuffer(buf);
          if (ft?.ext && SUPPORTED_FORMATS.includes(ft.ext)) {
            ext = ft.ext;
          } else {
            throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
          }
        } catch (error) {
          this.logger?.warn('File type detection failed', { 
            fileName: name, 
            error: error instanceof Error ? error.message : String(error) 
          });
          throw new UnsupportedFormatError(`Unsupported file type: ${ext || "unknown"}`);
        }
      }

      this.logger?.info("ConvertFileToJSON →", {
        file: name || "[no-name]",
        ext,
        size: buf.length,
      });

      let json: Partial<JsonResult> = {};
      const startTime = performance.now();
      
      const outputFormat = this.getNodeParameter('outputFormat', i, 'text') as string;
      
      try {
        if (!strategies[ext]) {
          throw new UnsupportedFormatError(`Format "${ext}" is not supported`);
        }
        json = await strategies[ext](buf, ext, ext === 'docx' ? { outputFormat } : undefined);
      } catch (e) {
        if (e instanceof FileTypeError ||
            e instanceof FileTooLargeError ||
            e instanceof UnsupportedFormatError ||
            e instanceof EmptyFileError ||
            e instanceof ProcessingError) {
          throw e;
        }
        throw new ProcessingError(`${ext.toUpperCase()} processing error: ${(e as Error).message}`);
      }
      
      const processingTime = performance.now() - startTime;
      this.logger?.info('Processing completed', { 
        file: name, 
        size: buf.length, 
        time: `${processingTime.toFixed(2)}ms`, 
        type: ext
      });

      if (
        "text" in json &&
        (!(json as JsonTextResult).text || (json as JsonTextResult).text.trim().length === 0)
      ) {
        throw new EmptyFileError(
          `File "${name}" (${ext.toUpperCase()}, ${(buf.length / 1024).toFixed(2)} KB) contains no extractable text. ` +
          `Possible reasons: (1) File contains only images/graphics without text, ` +
          `(2) File is password-protected or encrypted, ` +
          `(3) File structure is corrupted, ` +
          `(4) File was created with a non-standard application. ` +
          `Try: Open file in original application and verify it contains text, then save it again.`
        );
      }

      json.metadata = {
        fileName: sanitizeFileName(name) || null,
        fileSize: buf.length,
        fileType: ext,
        processedAt: new Date().toISOString(),
      };

      return {
        json: json as INodeExecutionData['json'],
        pairedItem: { item: i },
      };
    };

    const results = await promisePool(items, processItem, maxConcurrency);

    return [[{
      json: {
        files: results.map(result => result.json),
        totalFiles: results.length,
        processedAt: new Date().toISOString()
      }
    }]];
  }
}
