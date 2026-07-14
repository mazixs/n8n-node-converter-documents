import { strategies } from '../../src/strategies';
import type { JsonResult } from '../../src/types';

function getTextResult(result: Partial<JsonResult>): string {
  if (!('text' in result) || typeof result.text !== 'string') {
    throw new Error('Expected strategy to return text result');
  }
  return result.text;
}

describe('html/htm strategies', () => {
  it('should extract text from HTML body and normalize whitespace', async () => {
    const htmlContent = '<html><body><h1>Hello</h1>\n\n<p>World</p></body></html>';
    const result = await strategies.html(Buffer.from(htmlContent, 'utf8'));

    expect(getTextResult(result)).toBe('Hello World');
  });

  it('should extract text from an HTML fragment when body is missing', async () => {
    const htmlContent = '<div>No body</div>';
    const result = await strategies.html(Buffer.from(htmlContent, 'utf8'));

    expect(getTextResult(result)).toBe('No body');
  });

  it('htm strategy should behave the same as html', async () => {
    const htmlContent = '<html><body><p>Same parser</p></body></html>';
    const htmlResult = await strategies.html(Buffer.from(htmlContent, 'utf8'));
    const htmResult = await strategies.htm(Buffer.from(htmlContent, 'utf8'));

    expect(getTextResult(htmResult)).toBe(getTextResult(htmlResult));
  });
});
