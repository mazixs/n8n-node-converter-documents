import type { Worker } from 'tesseract.js';
import path from 'node:path';

import { loadOcrDependencies } from './loader';

interface PdfDocument {
  length: number;
  getPage(pageNumber: number): Promise<Buffer>;
  destroy?(): Promise<void>;
}

interface PdfModule {
  pdf(buffer: Buffer, options: { scale: number }): Promise<PdfDocument>;
}

interface TesseractModule {
  createWorker: typeof import('tesseract.js').createWorker;
}

export type OcrErrorCode = 'OCR_FAILED' | 'OCR_TIMEOUT' | 'OCR_UNAVAILABLE' | 'OCR_INVALID_OPTIONS';

export interface OcrOptions {
  languages: string;
  languageDataPath?: string;
  cachePath?: string;
  scale: number;
  maxPages: number;
  pageTimeoutMs: number;
}

export interface OcrMetadata {
  engine: 'tesseract.js';
  languages: string;
  pagesProcessed: number;
  averageConfidence: number;
  processingTimeMs: number;
}

export interface OcrResult {
  text: string;
  metadata: OcrMetadata;
  warnings: string[];
}

export interface OcrEngine {
  recognizePdf(buffer: Buffer, options: OcrOptions): Promise<OcrResult>;
}

export class OcrError extends Error {
  constructor(message: string, readonly code: OcrErrorCode, readonly cause?: Error) {
    super(message);
    this.name = 'OcrError';
  }
}

function parseLanguages(value: string): string[] {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_]+(?:\+[a-z0-9_]+)*$/.test(normalized)) {
    throw new OcrError('OCR languages must use Tesseract codes separated by +', 'OCR_INVALID_OPTIONS');
  }
  return normalized.split('+');
}

function validateLocalPath(value: string, field: string): void {
  if (!path.isAbsolute(value) && !path.win32.isAbsolute(value)) {
    throw new OcrError(`${field} must be an absolute local path`, 'OCR_INVALID_OPTIONS');
  }
}

function validateLanguageDataPath(value: string): void {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL');
  } catch {
    throw new OcrError(
      'languageDataPath must be an absolute local path or an HTTPS URL without credentials',
      'OCR_INVALID_OPTIONS',
    );
  }
}

function validateOptions(options: OcrOptions): string[] {
  const languages = parseLanguages(options.languages);
  if (!Number.isFinite(options.scale) || options.scale < 1 || options.scale > 8) {
    throw new OcrError('scale must be between 1 and 8', 'OCR_INVALID_OPTIONS');
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 0) {
    throw new OcrError('maxPages must be a non-negative integer', 'OCR_INVALID_OPTIONS');
  }
  if (!Number.isFinite(options.pageTimeoutMs) || options.pageTimeoutMs <= 0 || options.pageTimeoutMs > 3_600_000) {
    throw new OcrError('pageTimeoutMs must be between 1 and 3600000', 'OCR_INVALID_OPTIONS');
  }
  if (options.languageDataPath) validateLanguageDataPath(options.languageDataPath);
  if (options.cachePath) validateLocalPath(options.cachePath, 'cachePath');
  return languages;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, page: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new OcrError(`OCR timed out on page ${page}`, 'OCR_TIMEOUT'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class TesseractOcrEngine implements OcrEngine {
  async recognizePdf(buffer: Buffer, options: OcrOptions): Promise<OcrResult> {
    const languages = validateOptions(options);
    const startedAt = performance.now();
    let document: PdfDocument | undefined;
    let worker: Worker | undefined;

    try {
      let pdfModule: PdfModule;
      let tesseractModule: TesseractModule;
      try {
        [pdfModule, tesseractModule] = await loadOcrDependencies() as [PdfModule, TesseractModule];
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error));
        throw new OcrError(
          'OCR optional dependencies are not installed. Reinstall without --omit=optional.',
          'OCR_UNAVAILABLE',
          cause,
        );
      }

      document = await pdfModule.pdf(buffer, { scale: options.scale });
      const workerOptions: Partial<import('tesseract.js').WorkerOptions> = {};
      if (options.languageDataPath) workerOptions.langPath = options.languageDataPath;
      if (options.cachePath) workerOptions.cachePath = options.cachePath;
      worker = await tesseractModule.createWorker(languages, undefined, workerOptions);

      const pageLimit = options.maxPages === 0
        ? document.length
        : Math.min(document.length, options.maxPages);
      const texts: string[] = [];
      const confidences: number[] = [];
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const image = await document.getPage(pageNumber);
        const result = await withTimeout(
          worker.recognize(image),
          options.pageTimeoutMs,
          pageNumber,
        );
        const text = result.data.text.trim();
        if (text) texts.push(`--- Page ${pageNumber} ---\n${text}`);
        if (Number.isFinite(result.data.confidence)) confidences.push(result.data.confidence);
      }

      const warnings = document.length > pageLimit
        ? [`OCR limited to ${pageLimit} of ${document.length} pages`]
        : [];
      const averageConfidence = confidences.length === 0
        ? 0
        : Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2));
      return {
        text: texts.join('\n\n'),
        metadata: {
          engine: 'tesseract.js',
          languages: languages.join('+'),
          pagesProcessed: pageLimit,
          averageConfidence,
          processingTimeMs: Number((performance.now() - startedAt).toFixed(2)),
        },
        warnings,
      };
    } catch (error) {
      if (error instanceof OcrError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new OcrError(`OCR processing failed: ${cause.message}`, 'OCR_FAILED', cause);
    } finally {
      const cleanupOperations: Promise<unknown>[] = [];
      if (worker) cleanupOperations.push(worker.terminate());
      if (document?.destroy) cleanupOperations.push(document.destroy());
      await Promise.allSettled(cleanupOperations);
    }
  }
}
