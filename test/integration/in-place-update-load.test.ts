import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('in-place n8n community package update', () => {
  it('loads and parses PDFs after replacing dependencies left by 1.2.2-1.5.0', () => {
    const repositoryRoot = path.resolve(__dirname, '../..');
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-update-test-'));
    let output: string;
    try {
      output = execFileSync(
        process.execPath,
        [
          path.join(repositoryRoot, 'test/fixtures/in-place-update-loader.cjs'),
          repositoryRoot,
          temporaryRoot,
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            NODE_PATH: path.join(repositoryRoot, 'node_modules'),
          },
        },
      );
    } finally {
      // The pdf.js process the loader leaves idle is ended with it, a moment after it exits.
      fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }

    expect(JSON.parse(output)).toEqual({
      nodeName: 'convertFileToJson',
      detectedExtension: 'png',
      pdfHasText: true,
      staleWorkerRestored: true,
    });
  });
});
