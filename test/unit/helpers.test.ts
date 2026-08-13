import { extractViaOfficeParser, refreshPdfJsWorkerCache } from '../../src/helpers';
import fs from 'fs';

// Mock officeparser module (v6 API: parseOffice returns AST with toText())
jest.mock('officeparser-modern', () => ({
  parseOffice: jest.fn()
}));

import { parseOffice } from 'officeparser-modern';
const mockParseOffice = parseOffice as jest.MockedFunction<typeof parseOffice>;

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractViaOfficeParser', () => {
    it('replaces the cached fake worker with the current PDF.js worker', async () => {
      const staleWorker = { version: '5.4.530' };
      const currentWorker = { WorkerMessageHandler: { version: '5.5.207' } };
      const pdfjs = {
        PDFWorker: {
          _setupFakeWorkerGlobal: Promise.resolve(staleWorker),
        },
      };

      refreshPdfJsWorkerCache(pdfjs, currentWorker);

      await expect(pdfjs.PDFWorker._setupFakeWorkerGlobal)
        .resolves.toBe(currentWorker.WorkerMessageHandler);
    });

    it('should extract text successfully', async () => {
      const expectedText = 'extracted text from office file';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockParseOffice.mockResolvedValue({ toText: () => expectedText } as any);

      const buffer = Buffer.from('mock office file content');
      const result = await extractViaOfficeParser(buffer, true);

      expect(result).toBe(expectedText);
      expect(mockParseOffice).toHaveBeenCalledWith(buffer, { pdfWorkerSrc: expect.any(String) });
      const config = mockParseOffice.mock.calls[0][1] as { pdfWorkerSrc?: string };
      expect(config.pdfWorkerSrc).toContain('pdfjs-dist/legacy/build/pdf.worker.mjs');
      expect(fs.existsSync(config.pdfWorkerSrc as string)).toBe(true);
    });

    it('should keep the existing parser call for non-PDF formats', async () => {
      mockParseOffice.mockResolvedValue({ toText: () => 'office text' } as never);

      await expect(extractViaOfficeParser(Buffer.from('docx'))).resolves.toBe('office text');
      expect(mockParseOffice).toHaveBeenCalledWith(Buffer.from('docx'));
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
        return { toText: () => 'isolated text' } as never;
      });

      await expect(extractViaOfficeParser(Buffer.from('pdf'), true)).resolves.toBe('isolated text');
      expect(workerGlobal.pdfjsWorker).toBe(staleWorker);
      delete workerGlobal.pdfjsWorker;
    });
  });
});
