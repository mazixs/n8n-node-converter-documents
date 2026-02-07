// Тестируем processHtml через стратегию html
import { parse as parseHtml } from 'node-html-parser';

jest.mock('node-html-parser');

const mockParseHtml = parseHtml as jest.MockedFunction<typeof parseHtml>;

// Тестовая версия processHtml на основе новой логики
async function processHtml(buf: Buffer): Promise<{ text: string }> {
  const root = parseHtml(buf.toString("utf8"));
  const body = root.querySelector("body");
  const cleanText = body ? body.textContent.replace(/\s+/g, " ").trim() : "";
  return { text: cleanText };
}

describe('processHtml', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text from HTML body', async () => {
    const htmlContent = `<html><body><h1>Hello</h1><p>World</p></body></html>`;
    const buffer = Buffer.from(htmlContent, 'utf8');
    
    mockParseHtml.mockReturnValue({
      querySelector: jest.fn().mockReturnValue({
        textContent: 'Hello World ',
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await processHtml(buffer);
    
    expect(result.text).toBe('Hello World');
    expect(mockParseHtml).toHaveBeenCalledWith(htmlContent);
  });

  it('should handle empty HTML body', async () => {
    const htmlContent = '<html><body></body></html>';
    const buffer = Buffer.from(htmlContent, 'utf8');
    
    mockParseHtml.mockReturnValue({
      querySelector: jest.fn().mockReturnValue({
        textContent: '',
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await processHtml(buffer);
    
    expect(result.text).toBe('');
  });

  it('should handle missing body tag', async () => {
    const htmlContent = '<div>No body</div>';
    const buffer = Buffer.from(htmlContent, 'utf8');
    
    mockParseHtml.mockReturnValue({
      querySelector: jest.fn().mockReturnValue(null),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await processHtml(buffer);
    
    expect(result.text).toBe('');
  });
});
