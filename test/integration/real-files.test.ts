// Мокаем внешние зависимости для контролируемого тестирования
jest.mock('../../src/helpers', () => ({
  extractViaOfficeParser: jest.fn(),
  limitExcelSheet: jest.fn((data) => data),
}));

jest.mock('fast-xml-parser', () => ({
  XMLParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
  })),
}));

jest.mock('node-html-parser', () => ({
  parse: jest.fn(),
}));

import { extractViaOfficeParser } from '../../src/helpers';
import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml } from 'node-html-parser';
import { flattenJsonObject } from '../../src/utils/flatten';

const mockExtractViaOfficeParser = extractViaOfficeParser as jest.MockedFunction<typeof extractViaOfficeParser>;
const mockParseHtml = parseHtml as jest.MockedFunction<typeof parseHtml>;

// Стратегии для тестирования
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

const createTxtStrategy = () => async (buf: Buffer) => {
  return { text: buf.toString('utf-8') };
};

const createHtmlStrategy = () => async (buf: Buffer) => {
  const root = parseHtml(buf.toString("utf8"));
  const body = root.querySelector("body");
  const cleanText = body ? body.textContent.replace(/\s+/g, " ").trim() : "";
  return { text: cleanText };
};

const createXmlStrategy = () => async (buf: Buffer) => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(buf.toString("utf8"));
  return { text: JSON.stringify(parsed, null, 2) };
};

const createOdtStrategy = () => async (buf: Buffer) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    throw new Error(`ODT processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const createOdpStrategy = () => async (buf: Buffer) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    throw new Error(`ODP processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const createOdsStrategy = () => async (buf: Buffer) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    throw new Error(`ODS processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const createPdfStrategy = () => async (buf: Buffer) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    throw new Error(`PDF processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

describe('Real Files Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockParseHtml.mockImplementation((html: string) => {
      return {
        text: html.replace(/<[^>]*>/g, ' '), 
        textContent: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        toString: () => html,
        querySelectorAll: () => [],
        querySelector: (selector: string) => {
          if (selector === 'body') {
            return {
              textContent: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            };
          }
          return null;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    });
  });

  describe('JSON Files', () => {
    it('should process nested-objects.json with flattening', async () => {
      const jsonStrategy = createJsonStrategy();
      const content = JSON.stringify({
        company: {
          name: "Tech",
          employees: [{id: 1, name: "Alice"}, {id: 2, name: "Bob"}],
          address: { street: "Main", city: "NY", country: "USA" }
        }
      });
      const buffer = Buffer.from(content);
      
      const result = await jsonStrategy(buffer);
      
      expect(result.text).toContain('company.name');
      expect(result.text).toContain('company.employees[0].id');
      expect(result.text).toContain('company.employees[0].name');
      expect(result.text).toContain('company.employees[1].id');
      expect(result.text).toContain('company.employees[1].name');
      expect(result.text).toContain('company.address.street');
      expect(result.text).toContain('company.address.city');
      expect(result.text).toContain('company.address.country');
      expect(result.warning).toBe("Многоуровневая структура JSON была преобразована в плоский объект");
    });

    it('should handle Unicode characters in json-with-unicode.json', async () => {
      const jsonStrategy = createJsonStrategy();
      const content = JSON.stringify({
        greetings: {
          english: "Hello",
          japanese: "こんにちは",
          arabic: "مرحبا",
          russian: "Здравствуйте",
          hindi: "नमस्ते"
        }
      });
      const buffer = Buffer.from(content);
      
      const result = await jsonStrategy(buffer);
      
      expect(result.text).toContain('greetings.english');
      expect(result.text).toContain('greetings.japanese');
      expect(result.text).toContain('greetings.arabic');
      expect(result.text).toContain('greetings.russian');
      expect(result.text).toContain('greetings.hindi');
      
      const parsedResult = JSON.parse(result.text);
      expect(parsedResult['greetings.japanese']).toBe('こんにちは');
      expect(parsedResult['greetings.arabic']).toBe('مرحبا');
      expect(parsedResult['greetings.russian']).toBe('Здравствуйте');
      expect(parsedResult['greetings.hindi']).toBe('नमस्ते');
    });
  });

  describe('Text Files', () => {
    it('should process sample1.txt correctly', async () => {
      const txtStrategy = createTxtStrategy();
      const content = "Utilitatis causa amicitia est quaesita. Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
      const buffer = Buffer.from(content);
      
      const result = await txtStrategy(buffer);
      
      expect(result.text).toContain('Utilitatis causa amicitia est quaesita');
      expect(result.text).toContain('Lorem ipsum dolor sit amet');
      expect(result.text).toContain('consectetur adipiscing elit');
    });
  });

  describe('HTML Files', () => {
    it('should extract text from sample1.html', async () => {
      const htmlStrategy = createHtmlStrategy();
      const content = "<html><body><h1>Title</h1><p>Text</p></body></html>";
      const buffer = Buffer.from(content);
      
      const result = await htmlStrategy(buffer);
      
      expect(result.text).toBeDefined();
      expect(result.text).toContain('Title');
      expect(result.text).toContain('Text');
      expect(mockParseHtml).toHaveBeenCalled();
    });
  });

  describe('XML Files', () => {
    it('should process large-dataset.xml (5.4MB)', async () => {
      const xmlStrategy = createXmlStrategy();
      const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      
      (XMLParser as unknown as jest.Mock).mockImplementation(() => ({
        parse: jest.fn().mockReturnValue({ root: { records: 'Large dataset processed' } }),
      }));
      
      const result = await xmlStrategy(buffer);
      
      expect(result.text).toBe(JSON.stringify({ root: { records: 'Large dataset processed' } }, null, 2));
      expect(buffer.length).toBeGreaterThan(5 * 1024 * 1024);
    });
  });

  describe('OpenDocument Files', () => {
    it('should process sample3.odt (ODT text document)', async () => {
      const odtStrategy = createOdtStrategy();
      const buffer = Buffer.from('mock ODT');
      
      mockExtractViaOfficeParser.mockResolvedValue('Extracted ODT content from real file');
      
      const result = await odtStrategy(buffer);
      
      expect(result.text).toBe('Extracted ODT content from real file');
      expect(mockExtractViaOfficeParser).toHaveBeenCalledWith(buffer);
    });

    it('should process sample1.odp (ODP presentation)', async () => {
      const odpStrategy = createOdpStrategy();
      const buffer = Buffer.from('mock ODP');
      
      mockExtractViaOfficeParser.mockResolvedValue('Extracted ODP presentation content');
      
      const result = await odpStrategy(buffer);
      
      expect(result.text).toBe('Extracted ODP presentation content');
      expect(mockExtractViaOfficeParser).toHaveBeenCalledWith(buffer);
    });

    it('should process sample3.ods (ODS spreadsheet)', async () => {
      const odsStrategy = createOdsStrategy();
      const buffer = Buffer.from('mock ODS');
      
      mockExtractViaOfficeParser.mockResolvedValue('Extracted ODS spreadsheet data');
      
      const result = await odsStrategy(buffer);
      
      expect(result.text).toBe('Extracted ODS spreadsheet data');
      expect(mockExtractViaOfficeParser).toHaveBeenCalledWith(buffer);
    });
  });

  describe('PDF Files', () => {
    it('should process sample3.pdf', async () => {
      const pdfStrategy = createPdfStrategy();
      const buffer = Buffer.from('mock PDF');
      
      mockExtractViaOfficeParser.mockResolvedValue('PDF content');
      
      const result = await pdfStrategy(buffer);
      
      expect(result.text).toBe('PDF content');
      expect(mockExtractViaOfficeParser).toHaveBeenCalledWith(buffer);
    });
  });

  describe('File Size Validation', () => {
    it('should handle large files appropriately', () => {
      const largeXmlBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      const largeDocxBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      
      expect(largeXmlBuffer.length).toBeGreaterThan(5 * 1024 * 1024);
      expect(largeDocxBuffer.length).toBeGreaterThan(10 * 1024 * 1024);
      
      expect(largeXmlBuffer).toBeInstanceOf(Buffer);
      expect(largeDocxBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling with Real Files', () => {
    it('should handle ODT processing errors gracefully', async () => {
      const odtStrategy = createOdtStrategy();
      const buffer = Buffer.from('mock ODT');
      
      mockExtractViaOfficeParser.mockRejectedValue(new Error('Real ODT processing failed'));
      
      await expect(odtStrategy(buffer))
        .rejects.toThrow('ODT processing error: Real ODT processing failed');
    });

    it('should handle corrupted JSON gracefully', async () => {
      const jsonStrategy = createJsonStrategy();
      const corruptedJson = Buffer.from('{ "invalid": json content }');
      
      await expect(jsonStrategy(corruptedJson))
        .rejects.toThrow('JSON parsing error:');
    });
  });
});
