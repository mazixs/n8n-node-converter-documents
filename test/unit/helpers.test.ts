import { extractViaOfficeParser } from '../../src/helpers';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Mock officeparser module (v8 API: parseOffice returns an AST rendered by `to()`)
jest.mock('officeparser-v8', () => ({
  parseOffice: jest.fn()
}));

import { parseOffice } from 'officeparser-v8';
const mockParseOffice = parseOffice as jest.MockedFunction<typeof parseOffice>;

type Issue = { type: 'warning'; code: string; message: string };

function astWithText(text: string, warnings: Issue[] = []): { to: jest.Mock; warnings: Issue[] } {
  return { to: jest.fn().mockResolvedValue({ value: text }), warnings };
}

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractViaOfficeParser', () => {
    it('parses PDFs with the worker of officeparser\'s own pdf.js copy and no CDN', async () => {
      const ast = astWithText('extracted text from office file');
      mockParseOffice.mockResolvedValue(ast as never);

      const buffer = Buffer.from('mock office file content');
      const result = await extractViaOfficeParser(buffer, true);

      expect(result).toEqual({ text: 'extracted text from office file', warnings: [] });
      const config = mockParseOffice.mock.calls[0][1] as { pdfWorkerSrc?: string; allowRemoteAssets?: boolean };
      expect(config.allowRemoteAssets).toBe(false);
      // A file: URL is what lets officeparser run pdf.js in its separate process.
      expect(config.pdfWorkerSrc).toMatch(/^file:\/\//);
      const workerPath = fileURLToPath(config.pdfWorkerSrc as string);
      expect(fs.existsSync(workerPath)).toBe(true);
      expect(workerPath).toBe(
        createRequire(require.resolve('officeparser-v8')).resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
      );
    });

    it('renders plain text without the spatial layout padding', async () => {
      const ast = astWithText('office text');
      mockParseOffice.mockResolvedValue(ast as never);

      await expect(extractViaOfficeParser(Buffer.from('docx')))
        .resolves.toEqual({ text: 'office text', warnings: [] });
      expect(ast.to).toHaveBeenCalledWith('text', { textConfig: { preserveLayout: false } });
    });

    it('should keep remote assets disabled for non-PDF formats without a worker override', async () => {
      mockParseOffice.mockResolvedValue(astWithText('office text') as never);

      await extractViaOfficeParser(Buffer.from('docx'));

      expect(mockParseOffice).toHaveBeenCalledWith(Buffer.from('docx'), { allowRemoteAssets: false });
    });

    it('should reject on officeparser error', async () => {
      const mockError = new Error('OfficeParser extraction failed');
      mockParseOffice.mockRejectedValue(mockError);

      const buffer = Buffer.from('invalid office file content');

      await expect(extractViaOfficeParser(buffer, true))
        .rejects.toThrow('OfficeParser extraction failed');
    });

    it('should isolate a stale PDF.js worker global during parsing', async () => {
      const staleWorker = { version: '5.4.530' };
      const workerGlobal = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
      workerGlobal.pdfjsWorker = staleWorker;
      mockParseOffice.mockImplementation(async () => {
        expect(workerGlobal.pdfjsWorker).toBeUndefined();
        return astWithText('isolated text') as never;
      });

      await expect(extractViaOfficeParser(Buffer.from('pdf'), true))
        .resolves.toEqual({ text: 'isolated text', warnings: [] });
      expect(workerGlobal.pdfjsWorker).toBe(staleWorker);
      delete workerGlobal.pdfjsWorker;
    });

    it('reports content the parser left out or could not read faithfully', async () => {
      const limit = 'PDF content limit reached on page 3: the rest of the document was not read.';
      mockParseOffice.mockResolvedValue(astWithText('partial text', [
        { type: 'warning', code: 'PDF_CONTENT_LIMIT_EXCEEDED', message: limit },
        { type: 'warning', code: 'PDF_STRUCT_TREE_UNRELIABLE', message: 'Structure recovered from geometry.' },
        { type: 'warning', code: 'PDF_CONTENT_LIMIT_EXCEEDED', message: limit },
        { type: 'warning', code: 'PDF_TEXT_ENCODING_SUSPECT', message: 'Many unmappable glyphs.' },
      ]) as never);

      await expect(extractViaOfficeParser(Buffer.from('pdf'), true)).resolves.toEqual({
        text: 'partial text',
        warnings: [
          `PDF_CONTENT_LIMIT_EXCEEDED: ${limit}`,
          'PDF_TEXT_ENCODING_SUSPECT: Many unmappable glyphs.',
        ],
      });
    });
  });
});
