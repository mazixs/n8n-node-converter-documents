// Вспомогательные функции для работы с файлами в кастомном ноде n8n
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { parseOffice, type OfficeParserConfig } from 'officeparser-v8';

/**
 * Worker из той же копии pdf.js, которую грузит сам officeparser: n8n ставит её в
 * officeparser-v8/node_modules, то есть по пути, которого не было ни в одной прошлой версии ноды.
 * Адрес file: нужен officeparser, чтобы запускать pdf.js в отдельном процессе с лимитом памяти
 * и времени, — враждебный PDF не уронит n8n.
 */
const pdfWorkerSrc = pathToFileURL(
  createRequire(require.resolve('officeparser-v8')).resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

/** Предупреждения officeparser, при которых часть текста не прочитана или прочитана недостоверно. */
const TEXT_LOSS_WARNINGS = new Set<string>([
  'PDF_CONTENT_LIMIT_EXCEEDED',
  'PDF_TEXT_ENCODING_SUSPECT',
  'PDF_ASSET_UNAVAILABLE',
  'PAGE_LOAD_FAILED',
  'CONTENT_PART_NOT_READ',
  'ALT_CHUNK_NOT_READ',
  'TABLE_CELL_LIMIT_EXCEEDED',
  'REPEATED_CONTENT_LIMIT_EXCEEDED',
]);

type PdfJsWorkerGlobal = typeof globalThis & { pdfjsWorker?: unknown };

export interface OfficeExtraction {
  text: string;
  /** Что парсер пропустил, в виде `КОД: сообщение`; пусто, если документ прочитан целиком. */
  warnings: string[];
}

let pdfParseQueue: Promise<void> = Promise.resolve();

async function parseToText(buffer: Buffer, config: OfficeParserConfig): Promise<OfficeExtraction> {
  const ast = await parseOffice(buffer, config);
  const { value } = await ast.to('text', { textConfig: { preserveLayout: false } });
  const warnings = ast.warnings
    .filter((issue) => TEXT_LOSS_WARNINGS.has(issue.code))
    .map((issue) => `${issue.code}: ${issue.message}`);
  return { text: value, warnings: [...new Set(warnings)] };
}

/**
 * Извлекает текст из буфера с помощью officeparser
 *
 * @param buffer - Буфер с содержимым файла
 * @returns Promise с извлеченным текстом и предупреждениями о пропущенном содержимом
 * @throws Error если файл не удалось обработать
 */
export async function extractViaOfficeParser(
  buffer: Buffer,
  isolatePdfWorker = false,
): Promise<OfficeExtraction> {
  if (!isolatePdfWorker) {
    return parseToText(buffer, { allowRemoteAssets: false });
  }

  const previousParse = pdfParseQueue;
  let releaseParse!: () => void;
  pdfParseQueue = new Promise<void>((resolve) => {
    releaseParse = resolve;
  });

  await previousParse;

  // pdf.js прошлой версии ноды мог оставить в процессе свой worker. officeparser принял бы его
  // за предзагруженный вызывающим кодом и разобрал PDF им — в этом процессе и с чужой версией API.
  const globalObject = globalThis as PdfJsWorkerGlobal;
  const previousWorker = globalObject.pdfjsWorker;
  globalObject.pdfjsWorker = undefined;

  try {
    return await parseToText(buffer, { allowRemoteAssets: false, pdfWorkerSrc });
  } finally {
    globalObject.pdfjsWorker = previousWorker;
    releaseParse();
  }
}
