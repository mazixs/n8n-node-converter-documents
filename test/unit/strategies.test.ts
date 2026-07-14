import { extractViaOfficeParser } from '../../src/helpers';
import { ProcessingError, UnsupportedFormatError } from '../../src/errors';
import { strategies } from '../../src/strategies';
import type { JsonResult } from '../../src/types';

jest.mock('../../src/helpers', () => ({
  extractViaOfficeParser: jest.fn(),
}));

const mockExtractViaOfficeParser = extractViaOfficeParser as jest.MockedFunction<typeof extractViaOfficeParser>;

function getTextResult(result: Partial<JsonResult>): string {
  if (!('text' in result) || typeof result.text !== 'string') {
    throw new Error('Expected strategy to return text result');
  }
  return result.text;
}

describe('File Processing Strategies (real src/strategies implementation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('json strategy should flatten nested object and add warning', async () => {
    const input = { user: { name: 'John', address: { city: 'Moscow' } }, age: 30 };
    const result = await strategies.json(Buffer.from(JSON.stringify(input), 'utf8'));

    const text = getTextResult(result);
    const parsed = JSON.parse(text);

    expect(parsed).toMatchObject({
      'user.name': 'John',
      'user.address.city': 'Moscow',
      age: 30,
    });
    expect(result.warning).toBe('Многоуровневая структура JSON была преобразована в плоский объект');
  });

  it('json strategy should throw ProcessingError on invalid JSON', async () => {
    await expect(strategies.json(Buffer.from('{"invalid": }', 'utf8')))
      .rejects.toThrow(ProcessingError);
  });

  it('json strategy should decode ISO-8859-1 without an invalid Buffer encoding', async () => {
    const result = await strategies.json(Buffer.from('{"café": 1}', 'latin1'));

    expect(JSON.parse(getTextResult(result))).toEqual({ café: 1 });
  });

  it('xml strategy should parse XML into pretty JSON text', async () => {
    const result = await strategies.xml(Buffer.from('<root><value>42</value></root>', 'utf8'));

    const text = getTextResult(result);
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({ root: { value: 42 } });
  });

  it('html strategy should extract clean body text', async () => {
    const html = '<html><body><h1>Hello</h1>\n<p>World</p></body></html>';
    const result = await strategies.html(Buffer.from(html, 'utf8'));

    expect(getTextResult(result)).toBe('Hello World');
  });

  it('pdf strategy should return text from extractViaOfficeParser', async () => {
    mockExtractViaOfficeParser.mockResolvedValue('Extracted PDF content');

    const result = await strategies.pdf(Buffer.from('mock-pdf', 'utf8'));

    expect(getTextResult(result)).toBe('Extracted PDF content');
    expect(mockExtractViaOfficeParser).toHaveBeenCalledTimes(1);
  });

  it('pdf strategy should wrap parser failures into ProcessingError', async () => {
    mockExtractViaOfficeParser.mockRejectedValue(new Error('Office parser failed'));

    await expect(strategies.pdf(Buffer.from('invalid-pdf', 'utf8')))
      .rejects.toThrow('PDF processing error: Office parser failed');
  });

  it('doc legacy CFB file should throw UnsupportedFormatError', async () => {
    const cfbBuffer = Buffer.from([
      0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1,
      0x00, 0x00,
    ]);

    await expect(strategies.doc(cfbBuffer)).rejects.toThrow(UnsupportedFormatError);
  });

  it('odt strategy should map unknown parser errors to ProcessingError with format prefix', async () => {
    mockExtractViaOfficeParser.mockRejectedValue(new Error('ODT parser failed'));

    await expect(strategies.odt(Buffer.from('invalid-odt', 'utf8')))
      .rejects.toThrow('ODT processing error: ODT parser failed');
  });

  it('csv strategy should warn only when rows are actually truncated', async () => {
    const atLimit = `value\n${Array.from({ length: 100_000 }, (_, index) => index).join('\n')}`;
    const overLimit = `${atLimit}\n100000`;

    const complete = await strategies.csv(Buffer.from(atLimit, 'utf8'));
    const truncated = await strategies.csv(Buffer.from(overLimit, 'utf8'));

    expect(complete.warning).toBeUndefined();
    expect(truncated.warning).toBe('CSV truncated to 100000 rows');
    if (!('sheets' in truncated) || !truncated.sheets) throw new Error('Expected sheet result');
    expect(truncated.sheets.Sheet1).toHaveLength(100_000);
  });

  it('large txt strategy should truncate directly without adding a newline', async () => {
    const largeText = 'a'.repeat(10 * 1024 * 1024 + 1);

    const result = await strategies.txt(Buffer.from(largeText, 'utf8'));

    expect(getTextResult(result)).toBe('a'.repeat(1_000_000));
    expect(result.warning).toBe('Текст обрезан до 1000000 символов');
  });
});
