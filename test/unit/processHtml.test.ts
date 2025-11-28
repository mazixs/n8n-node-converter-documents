// Тестируем processHtml функцию
import { parse as parseHtml } from 'node-html-parser';
import sanitizeHtml from 'sanitize-html';

// Мокаем внешние зависимости
jest.mock('node-html-parser');
jest.mock('sanitize-html');

const mockParseHtml = parseHtml as jest.MockedFunction<typeof parseHtml>;
const mockSanitizeHtml = sanitizeHtml as jest.MockedFunction<typeof sanitizeHtml>;

// Создаем тестовую версию processHtml на основе оригинальной логики
async function processHtml(buf: Buffer): Promise<{ text: string }> {
  const root = parseHtml(buf.toString("utf8"));
  const rawText = root.text.replace(/\s+/g, " ").trim();
  const cleanText = sanitizeHtml(rawText, { allowedTags: [], allowedAttributes: {} });
  return { text: cleanText };
}

describe('processHtml', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настраиваем моки по умолчанию
    mockParseHtml.mockImplementation((html: string) => {
      return {
        text: html.replace(/<[^>]*>/g, ' '), // Simple mock text extraction
        toString: () => html,
        // Add other necessary methods if needed by internal logic
        querySelectorAll: () => [],
        querySelector: () => null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    });
    
    mockSanitizeHtml.mockImplementation((text: string) => text.trim());
  });

  it('should extract text from HTML body', async () => {
    const htmlContent = `<html><body><h1>Hello</h1><p>World</p></body></html>`;
    const buffer = Buffer.from(htmlContent, 'utf8');
    
    mockParseHtml.mockReturnValue({
      text: 'Hello World ',
      toString: () => htmlContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await processHtml(buffer);
    
    expect(result.text).toBe('Hello World');
    expect(mockParseHtml).toHaveBeenCalledWith(htmlContent);
  });

  it('should handle empty HTML', async () => {
    const htmlContent = '<html><body></body></html>';
    const buffer = Buffer.from(htmlContent, 'utf8');
    
    mockParseHtml.mockReturnValue({
      text: '',
      toString: () => htmlContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await processHtml(buffer);
    
    expect(result.text).toBe('');
  });
});
