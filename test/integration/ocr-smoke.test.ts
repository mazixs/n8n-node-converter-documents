import { execFileSync } from 'child_process';
import path from 'path';

const runOcrSmoke = process.env.RUN_OCR_SMOKE === '1' ? it : it.skip;

describe('real OCR smoke test', () => {
  runOcrSmoke('renders and recognizes the first page locally', async () => {
    const output = execFileSync(process.execPath, [
      path.resolve(__dirname, '../../scripts/ocr-smoke.mjs'),
      path.resolve(__dirname, '../samples/sample3.pdf'),
    ], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      timeout: 180_000,
      env: process.env,
    });
    const result = JSON.parse(output) as { textLength: number; pagesProcessed: number };

    expect(result.textLength).toBeGreaterThan(0);
    expect(result.pagesProcessed).toBe(1);
  }, 180_000);
});
