// Вспомогательные функции для работы с файлами в кастомном ноде n8n
import { createRequire } from 'module';
import { parseOffice } from 'officeparser-modern';

const pdfWorkerSrc = createRequire(__filename).resolve(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
);

type PdfJsWorkerModule = { WorkerMessageHandler?: unknown };

type PdfJsModule = {
  PDFWorker?: {
    _setupFakeWorkerGlobal?: Promise<unknown>;
  };
};

type PdfJsWorkerGlobal = typeof globalThis & { pdfjsWorker?: unknown };

let pdfParseQueue: Promise<void> = Promise.resolve();

export function refreshPdfJsWorkerCache(
  pdfjs: PdfJsModule,
  worker: PdfJsWorkerModule,
): void {
  if (!pdfjs.PDFWorker || !worker.WorkerMessageHandler) return;

  Object.defineProperty(pdfjs.PDFWorker, '_setupFakeWorkerGlobal', {
    value: Promise.resolve(worker.WorkerMessageHandler),
    configurable: true,
    writable: true,
  });
}

function refreshInstalledPdfJsWorker(): void {
  try {
    const requireFromHelper = createRequire(__filename);
    const pdfjs = requireFromHelper('pdfjs-dist/legacy/build/pdf.mjs') as PdfJsModule;
    const worker = requireFromHelper(pdfWorkerSrc) as PdfJsWorkerModule;
    refreshPdfJsWorkerCache(pdfjs, worker);
  } catch {
    // OfficeParser still receives an explicit worker path below.
  }
}

/**
 * Извлекает текст из буфера с помощью officeparser
 * 
 * @param buffer - Буфер с содержимым файла
 * @returns Promise с извлеченным текстом
 * @throws Error если файл не удалось обработать
 */
export async function extractViaOfficeParser(
  buffer: Buffer,
  isolatePdfWorker = false,
): Promise<string> {
  if (!isolatePdfWorker) {
    const ast = await parseOffice(buffer);
    return ast.toText();
  }

  const previousParse = pdfParseQueue;
  let releaseParse!: () => void;
  pdfParseQueue = new Promise<void>((resolve) => {
    releaseParse = resolve;
  });

  await previousParse;

  const globalObject = globalThis as PdfJsWorkerGlobal;
  const previousWorker = globalObject.pdfjsWorker;
  globalObject.pdfjsWorker = undefined;

  try {
    refreshInstalledPdfJsWorker();
    const ast = await parseOffice(buffer, { pdfWorkerSrc });
    return ast.toText();
  } finally {
    globalObject.pdfjsWorker = previousWorker;
    releaseParse();
  }
}
