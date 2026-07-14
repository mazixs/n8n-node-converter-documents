import { extractViaOfficeParser } from '../../src/helpers';

// Mock officeparser module (v6 API: parseOffice returns AST with toText())
jest.mock('officeparser', () => ({
  parseOffice: jest.fn()
}));

import { parseOffice } from 'officeparser';
const mockParseOffice = parseOffice as jest.MockedFunction<typeof parseOffice>;

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractViaOfficeParser', () => {
    it('should extract text successfully', async () => {
      const expectedText = 'extracted text from office file';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockParseOffice.mockResolvedValue({ toText: () => expectedText } as any);

      const buffer = Buffer.from('mock office file content');
      const result = await extractViaOfficeParser(buffer);

      expect(result).toBe(expectedText);
      expect(mockParseOffice).toHaveBeenCalledWith(buffer);
    });

    it('should reject on officeparser error', async () => {
      const mockError = new Error('OfficeParser extraction failed');
      mockParseOffice.mockRejectedValue(mockError);

      const buffer = Buffer.from('invalid office file content');
      
      await expect(extractViaOfficeParser(buffer))
        .rejects.toThrow('OfficeParser extraction failed');
    });
  });
});
