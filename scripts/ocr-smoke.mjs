import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TesseractOcrEngine } from '../dist/ocr/index.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = process.argv[2] ?? path.resolve(scriptDirectory, '../test/samples/sample3.pdf');
const buffer = fs.readFileSync(pdfPath);
const result = await new TesseractOcrEngine().recognizePdf(buffer, {
  languages: process.env.OCR_LANGUAGES || 'eng',
  languageDataPath: process.env.OCR_LANGUAGE_DATA_PATH || undefined,
  cachePath: process.env.OCR_CACHE_PATH || undefined,
  scale: 1.5,
  maxPages: 1,
  pageTimeoutMs: 120_000,
});

process.stdout.write(JSON.stringify({
  textLength: result.text.trim().length,
  pagesProcessed: result.metadata.pagesProcessed,
}));
