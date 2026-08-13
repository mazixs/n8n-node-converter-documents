import path from 'path';
import { fileTypeFromBuffer } from '../file-type-loader';
import {
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
} from 'n8n-workflow';

import {
  EmptyFileError,
  FileTooLargeError,
  FileTypeError,
  ProcessingError,
  UnsupportedFormatError,
} from '../errors';
import { OcrError, TesseractOcrEngine, type OcrMetadata } from '../ocr';
import { ArchiveValidationError, validateZipArchive } from '../security/archive';
import { strategies } from '../strategies';
import type { DocxOutputFormat, StrategyResult } from '../types';
import { promisePool, sanitizeFileName } from '../utils';
import { isStrategyResult, isSupportedFormat } from '../utils/formatGuards';
import { Semaphore } from '../utils/semaphore';

export type PipelineStage =
  | 'validate'
  | 'detect'
  | 'check_limits'
  | 'parse'
  | 'ocr_decision'
  | 'normalize'
  | 'emit';

export class PipelineFailure extends Error {
  constructor(
    message: string,
    readonly stage: PipelineStage,
    readonly code: string,
    readonly fileName: string | null,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PipelineFailure';
  }
}

function converterErrorCode(error: unknown): string {
  if (error instanceof ArchiveValidationError) return error.code;
  if (error instanceof OcrError) return error.code;
  if (error instanceof FileTooLargeError) return 'FILE_TOO_LARGE';
  if (error instanceof UnsupportedFormatError) return 'UNSUPPORTED_FORMAT';
  if (error instanceof EmptyFileError) return 'EMPTY_CONTENT';
  if (error instanceof FileTypeError) return 'INVALID_INPUT';
  return 'PROCESSING_FAILED';
}

/** Internal signal used to unwind recursion as soon as the length budget is exceeded. */
class LengthLimitExceeded extends Error {}

/** Whether `JSON.stringify` would drop this value entirely (as a bare value or object property). */
function isOmittedByJson(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

function addLength(total: number, delta: number, limit: number): number {
  const next = total + delta;
  if (next > limit) throw new LengthLimitExceeded();
  return next;
}

/**
 * Adds the exact length that `JSON.stringify(value)` would contribute to `total`,
 * throwing `LengthLimitExceeded` the moment the running total would cross `limit`.
 * Mirrors `JSON.stringify`'s own rules: `undefined`/functions/symbols are dropped
 * from objects and turned into `"null"` inside arrays; strings/numbers/booleans
 * use their real serialized length (quoting, escaping, `NaN`/`Infinity` -> `null`).
 */
function accumulateLength(value: unknown, total: number, limit: number): number {
  if (value === null) return addLength(total, 4, limit); // "null"
  if (value instanceof Date) return addLength(total, JSON.stringify(value).length, limit);

  switch (typeof value) {
    case 'boolean':
      return addLength(total, value ? 4 : 5, limit); // "true" / "false"
    case 'number':
      return addLength(total, Number.isFinite(value) ? JSON.stringify(value).length : 4, limit);
    case 'string':
      return addLength(total, JSON.stringify(value).length, limit);
    case 'undefined':
    case 'function':
    case 'symbol':
      // JSON.stringify(undefined) === undefined: contributes nothing as a bare value.
      return total;
    default:
      break;
  }

  if (Array.isArray(value)) {
    total = addLength(total, 2, limit); // "[" + "]"
    let first = true;
    for (const item of value) {
      if (!first) total = addLength(total, 1, limit); // comma
      first = false;
      total = isOmittedByJson(item)
        ? addLength(total, 4, limit) // array holes/undefined/functions/symbols -> "null"
        : accumulateLength(item, total, limit);
    }
    return total;
  }

  // Plain object.
  total = addLength(total, 2, limit); // "{" + "}"
  let first = true;
  for (const [key, propertyValue] of Object.entries(value as Record<string, unknown>)) {
    if (isOmittedByJson(propertyValue)) continue; // key:value pair dropped entirely
    if (!first) total = addLength(total, 1, limit); // comma
    first = false;
    total = addLength(total, JSON.stringify(key).length + 1, limit); // "key":
    total = accumulateLength(propertyValue, total, limit);
  }
  return total;
}

/**
 * Determines whether `JSON.stringify(value).length > limit` without ever
 * materializing the full serialized string in memory: sums the exact serialized
 * length property by property, item by item, and bails out via exception
 * as soon as the running total crosses the limit. Used for both `sheets` and
 * the structured `data` field.
 */
export function exceedsSerializedLength(value: unknown, limit: number): boolean {
  try {
    return accumulateLength(value, 0, limit) > limit;
  } catch (error) {
    if (error instanceof LengthLimitExceeded) return true;
    throw error;
  }
}

function toPipelineFailure(
  error: unknown,
  stage: PipelineStage,
  fileName: string | null,
): PipelineFailure {
  if (error instanceof PipelineFailure) return error;
  const cause = error instanceof Error ? error : new Error(String(error));
  return new PipelineFailure(cause.message, stage, converterErrorCode(error), fileName, cause);
}

export async function executeV6(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const advanced = this.getNodeParameter('advancedOptions', 0, {}) as Record<string, unknown>;
  const maxFileSizeMb = typeof advanced.maxFileSizeMb === 'number' ? advanced.maxFileSizeMb : 50;
  const maxFileSize = maxFileSizeMb === 0 ? 0 : maxFileSizeMb * 1024 * 1024;
  const maxConcurrency = typeof advanced.maxConcurrency === 'number' ? advanced.maxConcurrency : 4;
  const keepSourceBinary = this.getNodeParameter('keepSourceBinary', 0, false) as boolean;
  const ocrMode = this.getNodeParameter('ocrMode', 0, 'disabled') as 'disabled' | 'whenEmpty' | 'always';
  const rawOcrOptions = this.getNodeParameter('ocrOptions', 0, {}) as Record<string, unknown>;
  const ocrEngine = new TesseractOcrEngine();
  const configuredOcrConcurrency = typeof rawOcrOptions.ocrConcurrency === 'number'
    ? Math.trunc(rawOcrOptions.ocrConcurrency) : 1;
  const ocrSemaphore = new Semaphore(Math.max(1, configuredOcrConcurrency));

  const processItem = async (item: unknown, index: number): Promise<INodeExecutionData> => {
    let stage: PipelineStage = 'validate';
    let fileName: string | null = null;

    try {
      const binaryProperty = this.getNodeParameter('binaryPropertyName', index, 'data') as string;
      if (!item || typeof item !== 'object') throw new FileTypeError(`Item #${index} is not an object`);

      const sourceItem = item as INodeExecutionData;
      const binaryData = sourceItem.binary?.[binaryProperty];
      if (!binaryData) throw new FileTypeError(`Binary property "${binaryProperty}" is missing (item ${index})`);
      if (!binaryData.fileName || typeof binaryData.fileName !== 'string') {
        throw new FileTypeError(`File does not contain a valid name (item ${index})`);
      }

      fileName = sanitizeFileName(binaryData.fileName);
      const buffer = await this.helpers.getBinaryDataBuffer(index, binaryProperty);
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new EmptyFileError('File is empty or contains no data');

      stage = 'detect';
      const declaredExtension = path.extname(fileName).slice(1).toLowerCase();
      let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>;
      try {
        detected = await fileTypeFromBuffer(buffer);
      } catch (error) {
        this.logger?.warn('File type detection failed', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const detectedExtension = detected?.ext?.toLowerCase();
      let extension = declaredExtension;
      if (detectedExtension && isSupportedFormat(detectedExtension)) extension = detectedExtension;
      if (!isSupportedFormat(extension)) {
        throw new UnsupportedFormatError(`Unsupported file type: ${declaredExtension || detectedExtension || 'unknown'}`);
      }

      const warnings: string[] = [];
      if (detectedExtension && isSupportedFormat(detectedExtension) && declaredExtension && declaredExtension !== detectedExtension) {
        warnings.push(`File extension ${declaredExtension} does not match detected type ${detectedExtension}`);
      }

      stage = 'check_limits';
      if (maxFileSize > 0 && buffer.length > maxFileSize) {
        throw new FileTooLargeError(`File is too large (maximum ${maxFileSizeMb} MB)`);
      }
      if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(extension)) {
        const maxArchiveEntries = typeof advanced.maxArchiveEntries === 'number'
          ? advanced.maxArchiveEntries : 10_000;
        const maxArchiveUncompressedMb = typeof advanced.maxArchiveUncompressedMb === 'number'
          ? advanced.maxArchiveUncompressedMb : 200;
        const maxCompressionRatio = typeof advanced.maxCompressionRatio === 'number'
          ? advanced.maxCompressionRatio : 100;
        await validateZipArchive(buffer, {
          maxEntries: maxArchiveEntries,
          maxUncompressedBytes: maxArchiveUncompressedMb === 0
            ? 0 : maxArchiveUncompressedMb * 1024 * 1024,
          maxCompressionRatio,
        });
      }

      stage = 'parse';
      const startedAt = performance.now();
      const strategy = strategies[extension];
      let strategyResult: StrategyResult;
      try {
        strategyResult = await strategy(buffer, extension, {
          outputFormat: extension === 'docx'
            ? this.getNodeParameter('outputFormat', index, 'text') as DocxOutputFormat
            : undefined,
          jsonMode: this.getNodeParameter('jsonMode', index, 'preserve') as 'preserve' | 'flatten',
          maxRows: typeof advanced.maxRows === 'number' ? advanced.maxRows : 100_000,
          maxTextChars: typeof advanced.maxTextChars === 'number' ? advanced.maxTextChars : 1_000_000,
          includeParsedData: true,
        });
      } catch (error) {
        if (error instanceof FileTypeError || error instanceof FileTooLargeError ||
            error instanceof UnsupportedFormatError || error instanceof EmptyFileError ||
            error instanceof ProcessingError) throw error;
        throw new ProcessingError(
          `${extension.toUpperCase()} processing error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      stage = 'ocr_decision';
      let ocrMetadata: OcrMetadata | undefined;
      const shouldUseOcr = extension === 'pdf' && (
        ocrMode === 'always' ||
        (ocrMode === 'whenEmpty' && 'text' in strategyResult && strategyResult.text.trim().length === 0)
      );
      if (shouldUseOcr) {
        const ocrResult = await ocrSemaphore.run(() => ocrEngine.recognizePdf(buffer, {
          languages: typeof rawOcrOptions.languages === 'string' ? rawOcrOptions.languages : 'eng',
          languageDataPath: typeof rawOcrOptions.languageDataPath === 'string'
            ? rawOcrOptions.languageDataPath : undefined,
          cachePath: typeof rawOcrOptions.cachePath === 'string' ? rawOcrOptions.cachePath : undefined,
          scale: typeof rawOcrOptions.scale === 'number' ? rawOcrOptions.scale : 2,
          maxPages: typeof rawOcrOptions.maxPages === 'number' ? rawOcrOptions.maxPages : 10,
          pageTimeoutMs: (typeof rawOcrOptions.pageTimeoutSeconds === 'number'
            ? rawOcrOptions.pageTimeoutSeconds : 60) * 1000,
        }));
        strategyResult = { text: ocrResult.text };
        warnings.push(...ocrResult.warnings);
        ocrMetadata = ocrResult.metadata;
      }

      stage = 'normalize';
      if (!isStrategyResult(strategyResult)) {
        throw new ProcessingError(`${extension.toUpperCase()} processing error: strategy returned an invalid result`);
      }
      if ('text' in strategyResult && strategyResult.text.trim().length === 0) {
        throw new EmptyFileError(`File "${fileName}" contains no extractable text`);
      }
      if (strategyResult.warning) warnings.push(strategyResult.warning);
      const maxOutputChars = typeof advanced.maxOutputChars === 'number'
        ? advanced.maxOutputChars : 1_000_000;
      if ('text' in strategyResult && maxOutputChars > 0 && strategyResult.text.length > maxOutputChars) {
        strategyResult = { ...strategyResult, text: strategyResult.text.slice(0, maxOutputChars) };
        warnings.push(`Output truncated to ${maxOutputChars} characters`);
      }
      if ('sheets' in strategyResult && maxOutputChars > 0 &&
          exceedsSerializedLength(strategyResult.sheets, maxOutputChars)) {
        throw new PipelineFailure(
          `Structured output exceeds the ${maxOutputChars} character limit`,
          'normalize',
          'OUTPUT_LIMIT_EXCEEDED',
          fileName,
        );
      }
      if ('data' in strategyResult && strategyResult.data !== undefined && maxOutputChars > 0 &&
          exceedsSerializedLength(strategyResult.data, maxOutputChars)) {
        throw new PipelineFailure(
          `Structured output exceeds the ${maxOutputChars} character limit`,
          'normalize',
          'OUTPUT_LIMIT_EXCEEDED',
          fileName,
        );
      }

      stage = 'emit';
      const { warning: _warning, ...content } = strategyResult;
      const result: INodeExecutionData = {
        json: {
          ...sourceItem.json,
          document: {
            status: 'success',
            ...content,
            warnings,
            metadata: {
              fileName,
              fileSize: buffer.length,
              fileType: extension,
              declaredFileType: declaredExtension || null,
              detectedMime: detected?.mime ?? null,
              ...(ocrMetadata ? { ocr: ocrMetadata } : {}),
              processedAt: new Date().toISOString(),
              processingTimeMs: Number((performance.now() - startedAt).toFixed(2)),
            },
          },
        },
        pairedItem: { item: index },
      };
      if (keepSourceBinary && sourceItem.binary) result.binary = sourceItem.binary;
      return result;
    } catch (error) {
      const failure = toPipelineFailure(error, stage, fileName);
      if (!this.continueOnFail()) {
        throw new NodeOperationError(this.getNode(), failure, { itemIndex: index });
      }
      const sourceJson = item && typeof item === 'object' && 'json' in item &&
        item.json && typeof item.json === 'object' ? item.json as INodeExecutionData['json'] : {};
      const errorResult: INodeExecutionData = {
        json: {
          ...sourceJson,
          document: {
            status: 'error',
            error: {
              stage: failure.stage,
              code: failure.code,
              message: failure.message,
              fileName: failure.fileName,
            },
          },
        },
        pairedItem: { item: index },
      };
      if (keepSourceBinary && item && typeof item === 'object' && 'binary' in item) {
        const binary = (item as INodeExecutionData).binary;
        if (binary) errorResult.binary = binary;
      }
      return errorResult;
    }
  };

  return [await promisePool(items, processItem, maxConcurrency)];
}
