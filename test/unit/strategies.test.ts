import { extractViaOfficeParser } from '../../src/helpers';
import { ProcessingError, UnsupportedFormatError } from '../../src/errors';
import { strategies } from '../../src/strategies';
import type { JsonResult } from '../../src/types';

type ConfigurableStrategy = (
  buffer: Buffer,
  extension?: string,
  options?: Record<string, unknown>,
) => Promise<Partial<JsonResult>>;

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

/** `data` only exists on the text-result branch of the `StrategyResult` union. */
function getData(result: Partial<JsonResult>): unknown {
  return (result as { data?: unknown }).data;
}

describe('File Processing Strategies (real src/strategies implementation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('json strategy should flatten nested object and add warning', async () => {
    const input = { user: { name: 'John', address: { city: 'Moscow' } }, age: 30 };
    const strategy = strategies.json as unknown as ConfigurableStrategy;
    // `includeParsedData: true` is how the v6 pipeline opts into `data` — see the
    // "omits data" test below for the v5-style call (no options at all, so the
    // flag defaults to falsy), which must NOT include `data`.
    const result = await strategy(
      Buffer.from(JSON.stringify(input), 'utf8'),
      'json',
      { includeParsedData: true },
    );

    const text = getTextResult(result);
    const parsed = JSON.parse(text);

    expect(parsed).toMatchObject({
      'user.name': 'John',
      'user.address.city': 'Moscow',
      age: 30,
    });
    expect(result.warning).toBe('Многоуровневая структура JSON была преобразована в плоский объект');
    // `data` must be the same flattened object that was serialized into `text`,
    // not the original nested input, so downstream nodes never re-parse `text`.
    expect(getData(result)).toEqual(parsed);
  });

  it('json strategy omits data when called without options (the v5 execute path)', async () => {
    const input = { nested: { value: 1 } };
    const result = await strategies.json(Buffer.from(JSON.stringify(input), 'utf8'));

    expect('data' in result).toBe(false);
  });

  it('json strategy omits data when options are present but includeParsedData is not set', async () => {
    // Regression guard for the explicit-contract fix: merely passing an options
    // object (e.g. `maxRows`, unrelated to json at all) must not turn on `data`.
    // Only `includeParsedData: true` may.
    const input = { nested: { value: 1 } };
    const strategy = strategies.json as unknown as ConfigurableStrategy;

    const result = await strategy(Buffer.from(JSON.stringify(input), 'utf8'), 'json', { maxRows: 5 });

    expect('data' in result).toBe(false);
  });

  it('json strategy preserves nested structure when configured', async () => {
    const input = { user: { name: 'John' }, roles: ['admin'] };
    const strategy = strategies.json as unknown as ConfigurableStrategy;

    const result = await strategy(
      Buffer.from(JSON.stringify(input), 'utf8'),
      'json',
      { jsonMode: 'preserve', includeParsedData: true },
    );

    expect(JSON.parse(getTextResult(result))).toEqual(input);
    expect(result.warning).toBeUndefined();
    expect(getData(result)).toEqual(input);
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
    const strategy = strategies.xml as unknown as ConfigurableStrategy;
    const result = await strategy(
      Buffer.from('<root><value>42</value></root>', 'utf8'),
      'xml',
      { includeParsedData: true },
    );

    const text = getTextResult(result);
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({ root: { value: 42 } });
    // `data` reuses the already-parsed object instead of re-parsing `text`.
    expect(getData(result)).toEqual(parsed);
  });

  it('xml strategy omits data when called without options (the v5 execute path)', async () => {
    const result = await strategies.xml(Buffer.from('<root><value>1</value></root>', 'utf8'));

    expect('data' in result).toBe(false);
  });

  it('xml strategy limits custom entity expansion', async () => {
    const entities = Array.from({ length: 10_001 }, () => '&x;').join('');
    const xml = `<!DOCTYPE root [<!ENTITY x "a">]><root>${entities}</root>`;

    await expect(strategies.xml(Buffer.from(xml, 'utf8')))
      .rejects.toThrow(/entity expansion count limit/i);
  });

  it('yml strategy returns the parsed object as data for a non-Yandex-Market catalog', async () => {
    const strategy = strategies.yml as unknown as ConfigurableStrategy;
    const result = await strategy(
      Buffer.from('<root><value>1</value></root>', 'utf8'),
      'yml',
      { includeParsedData: true },
    );

    const text = getTextResult(result);
    expect(getData(result)).toEqual(JSON.parse(text));
  });

  it('yml strategy returns the Yandex Market catalog object as data', async () => {
    const xml = `<yml_catalog date="2024-01-15"><shop>
      <name>Shop</name>
      <offers><offer id="1" available="true"><name>Item</name></offer></offers>
    </shop></yml_catalog>`;
    const strategy = strategies.yml as unknown as ConfigurableStrategy;
    const result = await strategy(Buffer.from(xml, 'utf8'), 'yml', { includeParsedData: true });

    const text = getTextResult(result);
    expect(getData(result)).toEqual(JSON.parse(text));
  });

  it('yml strategy omits data when called without options (the v5 execute path)', async () => {
    const result = await strategies.yml(Buffer.from('<root><value>1</value></root>', 'utf8'));

    expect('data' in result).toBe(false);
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

  it('csv strategy uses the configured row limit', async () => {
    const strategy = strategies.csv as unknown as ConfigurableStrategy;
    const result = await strategy(Buffer.from('value\n1\n2\n3', 'utf8'), 'csv', { maxRows: 2 });

    expect(result.warning).toBe('CSV truncated to 2 rows');
    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheet result');
    expect(result.sheets.Sheet1).toHaveLength(2);
  });

  it('large txt strategy should truncate directly without adding a newline', async () => {
    const largeText = 'a'.repeat(10 * 1024 * 1024 + 1);

    const result = await strategies.txt(Buffer.from(largeText, 'utf8'));

    expect(getTextResult(result)).toBe('a'.repeat(1_000_000));
    expect(result.warning).toBe('Текст обрезан до 1000000 символов');
  });

  it('txt strategy uses the configured character limit for small files', async () => {
    const strategy = strategies.txt as unknown as ConfigurableStrategy;
    const result = await strategy(Buffer.from('abcdefgh', 'utf8'), 'txt', { maxTextChars: 5 });

    expect(getTextResult(result)).toBe('abcde');
    expect(result.warning).toBe('Текст обрезан до 5 символов');
  });

  it('md strategy should return Markdown content as text', async () => {
    const mdStrategy = (strategies as Record<string, ConfigurableStrategy>).md;
    const result = await mdStrategy(Buffer.from('# Title\n\nMarkdown body', 'utf8'));

    expect(getTextResult(result)).toBe('# Title\n\nMarkdown body');
    expect(result.warning).toBeUndefined();
  });
});
