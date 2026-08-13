/**
 * Regression test: decodeBuffer() (src/strategies/index.ts) must detect the
 * encoding from a bounded prefix of the buffer rather than scanning the
 * entire (potentially huge) file, while still decoding the full content.
 */

jest.mock('chardet', () => ({
  detect: jest.fn(),
}));

import chardet from 'chardet';
import { strategies } from '../../src/strategies';

const mockDetect = chardet.detect as jest.MockedFunction<typeof chardet.detect>;

describe('decodeBuffer encoding sampling', () => {
  beforeEach(() => {
    mockDetect.mockReset();
    mockDetect.mockReturnValue('utf-8');
  });

  it('detects encoding from a bounded prefix, not the whole buffer', async () => {
    const bigText = 'a'.repeat(200_000);
    const buf = Buffer.from(bigText, 'utf8');

    await strategies.txt(buf);

    expect(mockDetect).toHaveBeenCalledTimes(1);
    const sampleArg = mockDetect.mock.calls[0][0] as Buffer;
    expect(sampleArg.length).toBeLessThan(buf.length);
    expect(sampleArg.length).toBeLessThanOrEqual(64 * 1024);
  });

  it('still decodes the full buffer content, past the sampled prefix', async () => {
    const bigText = `${'a'.repeat(100_000)}TAIL_MARKER`;
    const buf = Buffer.from(bigText, 'utf8');

    const result = await strategies.txt(buf);
    if (!('text' in result) || typeof result.text !== 'string') {
      throw new Error('Expected text result');
    }
    expect(result.text.endsWith('TAIL_MARKER')).toBe(true);
    expect(result.text.length).toBe(bigText.length);
  });

  it('passes the whole buffer to detect when it is smaller than the sample size', async () => {
    const buf = Buffer.from('short text', 'utf8');

    await strategies.txt(buf);

    const sampleArg = mockDetect.mock.calls[0][0] as Buffer;
    expect(sampleArg.length).toBe(buf.length);
  });
});
