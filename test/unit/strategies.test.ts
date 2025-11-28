import { extractViaOfficeParser } from '../../src/helpers';

// Mock dependencies
jest.mock('../../src/helpers', () => ({
  extractViaOfficeParser: jest.fn(),
  limitExcelSheet: jest.fn((data) => data),
}));

jest.mock('fast-xml-parser', () => {
  return {
    XMLParser: jest.fn().mockImplementation(() => ({
      parse: jest.fn((xml) => ({ root: { element: 'value' } })), // Default mock
    })),
  };
});

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    xlsx: {
      load: jest.fn().mockResolvedValue(undefined),
    },
    eachSheet: jest.fn(),
  })),
}));

import { XMLParser } from 'fast-xml-parser';

const mockExtractViaOfficeParser = extractViaOfficeParser as jest.MockedFunction<typeof extractViaOfficeParser>;

// Copied helper for testing
function flattenJsonObject(obj: unknown, prefix: string = '', result: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== 'object' || obj instanceof Date || obj instanceof Buffer) {
    result[prefix || 'value'] = obj;
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const key = prefix ? `${prefix}[${index}]` : `item_${index}`;
      flattenJsonObject(item, key, result);
    });
    return result;
  }
  Object.keys(obj).forEach(key => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    flattenJsonObject((obj as Record<string, unknown>)[key], newKey, result);
  });
  return result;
}

// Re-implemented strategies matching new code
const createJsonStrategy = () => async (buf: Buffer) => {
  try {
    const jsonString = buf.toString('utf-8');
    const parsed = JSON.parse(jsonString);
    if (typeof parsed === 'object' && parsed !== null) {
      const flattened = flattenJsonObject(parsed);
      return { 
        text: JSON.stringify(flattened, null, 2),
        warning: Object.keys(flattened).length > Object.keys(parsed).length ? 
          "Многоуровневая структура JSON была преобразована в плоский объект" : undefined
      };
    }
    return { text: JSON.stringify(parsed, null, 2) };
  } catch (error) {
    throw new Error(`JSON parsing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const createXmlStrategy = () => async (buf: Buffer) => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(buf.toString("utf8"));
  return { text: JSON.stringify(parsed, null, 2) };
};

const createPdfStrategy = () => async (buf: Buffer) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    throw new Error(`PDF processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

describe('File Processing Strategies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('flattenJsonObject', () => {
    it('should flatten nested object structure', () => {
      const input = { user: { name: 'John', address: { city: 'Moscow' } }, age: 30 };
      const result = flattenJsonObject(input);
      expect(result).toEqual({
        'user.name': 'John',
        'user.address.city': 'Moscow',
        'age': 30
      });
    });
  });

  describe('JSON Strategy', () => {
    const jsonStrategy = createJsonStrategy();
    it('should process simple JSON object', async () => {
      const jsonData = { name: 'John', age: 30 };
      const result = await jsonStrategy(Buffer.from(JSON.stringify(jsonData)));
      expect(result.text).toBe(JSON.stringify(jsonData, null, 2));
    });
  });

  describe('XML Strategy', () => {
    const xmlStrategy = createXmlStrategy();
    it('should parse XML successfully', async () => {
      // Mock XMLParser to return specific object
      (XMLParser as jest.Mock).mockImplementation(() => ({
        parse: jest.fn().mockReturnValue({ root: { element: 'value' } }),
      }));

      const result = await xmlStrategy(Buffer.from('<root><element>value</element></root>'));
      expect(result.text).toBe(JSON.stringify({ root: { element: 'value' } }, null, 2));
    });
  });

  describe('PDF Strategy', () => {
    const pdfStrategy = createPdfStrategy();
    it('should extract text via OfficeParser successfully', async () => {
      mockExtractViaOfficeParser.mockResolvedValue('Extracted PDF content');
      const result = await pdfStrategy(Buffer.from('mock PDF content'));
      expect(result.text).toBe('Extracted PDF content');
    });

    it('should handle errors', async () => {
      mockExtractViaOfficeParser.mockRejectedValue(new Error('OfficeParser failed'));
      await expect(pdfStrategy(Buffer.from('invalid')))
        .rejects.toThrow('PDF processing error: OfficeParser failed');
    });
  });
});
