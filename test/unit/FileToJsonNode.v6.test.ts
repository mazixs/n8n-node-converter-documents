import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { fileTypeFromBuffer } from '../../src/file-type-loader';
import fs from 'fs';
import path from 'path';

import { FileToJsonNode } from '../../src/ConvertFileToJson.node';
import { strategies } from '../../src/strategies';

jest.mock('../../src/file-type-loader', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

jest.mock('../../src/strategies', () => ({
  strategies: {
    txt: jest.fn(),
    md: jest.fn(),
    pdf: jest.fn(),
    docx: jest.fn(),
    json: jest.fn(),
    xml: jest.fn(),
    xlsx: jest.fn(),
    csv: jest.fn(),
  },
}));

jest.mock('../../src/ocr/loader', () => ({ loadOcrDependencies: jest.fn() }));

type StrategyMocks = Record<string, jest.Mock>;

const mockFileTypeFromBuffer = fileTypeFromBuffer as jest.MockedFunction<typeof fileTypeFromBuffer>;
const mockStrategies = strategies as unknown as StrategyMocks;
const mockLoadOcrDependencies = (jest.requireMock('../../src/ocr/loader') as {
  loadOcrDependencies: jest.Mock;
}).loadOcrDependencies;
const mockCreateWorker = jest.fn();
const mockRenderPdf = jest.fn();

function binary(fileName: string) {
  return { data: '', mimeType: 'application/octet-stream', fileName };
}

function createContext(options: {
  items?: INodeExecutionData[];
  buffers?: Buffer[];
  params?: Record<string, unknown>;
  continueOnFail?: boolean;
}) {
  const items = options.items ?? [{ json: { source: 'first' }, binary: { data: binary('first.txt') } }];
  const buffers = options.buffers ?? [Buffer.from('first')];
  const params: Record<string, unknown> = {
    binaryPropertyName: 'data',
    keepSourceBinary: false,
    outputFormat: 'text',
    jsonMode: 'preserve',
    advancedOptions: {},
    ocrMode: 'disabled',
    ocrOptions: {},
    ...options.params,
  };

  return {
    getInputData: jest.fn(() => items),
    getNode: jest.fn(() => ({
      id: 'node-id',
      name: 'Convert File to JSON',
      type: 'convertFileToJson',
      typeVersion: 6,
      position: [0, 0],
      parameters: {},
    })),
    getNodeParameter: jest.fn((name: string, _index: number, fallback?: unknown) =>
      name in params ? params[name] : fallback),
    continueOnFail: jest.fn(() => options.continueOnFail ?? false),
    helpers: {
      getBinaryDataBuffer: jest.fn(async (index: number) => buffers[index]),
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
    },
  };
}

describe('FileToJsonNode version 6', () => {
  const node = new FileToJsonNode();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileTypeFromBuffer.mockResolvedValue(undefined);
    mockLoadOcrDependencies.mockResolvedValue([
      { pdf: mockRenderPdf },
      { createWorker: mockCreateWorker },
    ]);
  });

  it('exposes legacy version 5 and current version 6', () => {
    expect(node.description.version).toEqual([5, 6]);
  });

  it('exposes version 6 resource controls and OCR settings', () => {
    const advanced = node.description.properties.find((property) => property.name === 'advancedOptions');
    const ocrMode = node.description.properties.find((property) => property.name === 'ocrMode');
    const keepBinary = node.description.properties.find((property) => property.name === 'keepSourceBinary');
    const advancedOptions = advanced && 'options' in advanced && Array.isArray(advanced.options)
      ? advanced.options : [];

    expect(advanced?.type).toBe('collection');
    expect(advanced?.displayOptions).toEqual({ show: { '@version': [6] } });
    expect(advancedOptions.map((option) => option.name))
      .toEqual(expect.arrayContaining([
        'maxFileSizeMb',
        'maxConcurrency',
        'maxRows',
        'maxTextChars',
        'maxOutputChars',
        'maxArchiveEntries',
        'maxArchiveUncompressedMb',
        'maxCompressionRatio',
      ]));
    expect(ocrMode?.displayOptions).toEqual({ show: { '@version': [6] } });
    expect(keepBinary?.displayOptions).toEqual({ show: { '@version': [6] } });
  });

  it('emits one ordered result per input and preserves input JSON', async () => {
    const items: INodeExecutionData[] = [
      { json: { source: 'first' }, binary: { data: binary('first.txt') } },
      { json: { source: 'second' }, binary: { data: binary('second.txt') } },
    ];
    const ctx = createContext({
      items,
      buffers: [Buffer.from('slow'), Buffer.from('fast')],
      params: { advancedOptions: { maxConcurrency: 2 } },
    });

    mockStrategies.txt.mockImplementation(async (buffer: Buffer) => {
      if (buffer.toString() === 'slow') await new Promise((resolve) => setTimeout(resolve, 10));
      return { text: buffer.toString() };
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(output).toHaveLength(2);
    expect(output.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
    expect(output.map((item) => item.json.source)).toEqual(['first', 'second']);
    expect(output.map((item) => (item.json.document as { text: string }).text)).toEqual(['slow', 'fast']);
    expect(output.every((item) => item.binary === undefined)).toBe(true);
  });

  it('keeps source binary data only when requested', async () => {
    const item: INodeExecutionData = {
      json: { source: 'first' },
      binary: { data: binary('first.txt') },
    };
    const ctx = createContext({ items: [item], params: { keepSourceBinary: true } });
    mockStrategies.txt.mockResolvedValue({ text: 'first' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(output[0].binary).toBe(item.binary);
  });

  it('accepts Markdown files by extension when signature detection is inconclusive', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('README.md') } }],
      buffers: [Buffer.from('# Title\n\nMarkdown body')],
    });
    mockStrategies.md.mockResolvedValue({ text: '# Title\n\nMarkdown body' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockStrategies.md).toHaveBeenCalledWith(
      expect.any(Buffer),
      'md',
      expect.any(Object),
    );
    expect((output[0].json.document as { text: string }).text).toBe('# Title\n\nMarkdown body');
  });

  it('uses a detected supported type and reports an extension mismatch', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('wrong.txt') } }],
      buffers: [Buffer.from('%PDF')],
    });
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: 'pdf text' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as {
      warnings: string[];
      metadata: { fileType: string; declaredFileType: string };
    };

    expect(mockStrategies.pdf).toHaveBeenCalled();
    expect(document.metadata).toMatchObject({ fileType: 'pdf', declaredFileType: 'txt' });
    expect(document.warnings.join(' ')).toMatch(/txt.*pdf/i);
  });

  it('passes configurable format limits and JSON mode to strategies', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('nested.json') } }],
      buffers: [Buffer.from('{"nested":{"value":1}}')],
      params: {
        jsonMode: 'preserve',
        advancedOptions: { maxRows: 123, maxTextChars: 456 },
      },
    });
    mockStrategies.json.mockResolvedValue({ text: '{"nested":{"value":1}}' });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockStrategies.json).toHaveBeenCalledWith(
      expect.any(Buffer),
      'json',
      expect.objectContaining({ jsonMode: 'preserve', maxRows: 123, maxTextChars: 456 }),
    );
  });

  it('surfaces the strategy-provided structured data alongside text for JSON input', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('nested.json') } }],
      buffers: [Buffer.from('{"nested":{"value":1}}')],
    });
    const parsed = { nested: { value: 1 } };
    mockStrategies.json.mockResolvedValue({ text: '{"nested":{"value":1}}', data: parsed });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { text: string; data: unknown };

    expect(document.text).toBe('{"nested":{"value":1}}');
    expect(document.data).toEqual(parsed);
  });

  it('surfaces the strategy-provided structured data alongside text for XML input', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('doc.xml') } }],
      buffers: [Buffer.from('<root><value>42</value></root>')],
    });
    const parsed = { root: { value: 42 } };
    mockStrategies.xml.mockResolvedValue({ text: '{"root":{"value":42}}', data: parsed });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { text: string; data: unknown };

    expect(document.text).toBe('{"root":{"value":42}}');
    expect(document.data).toEqual(parsed);
  });

  it('does not add a data key for formats that only produce text, such as DOCX', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('report.docx') } }],
      buffers: [buffer],
    });
    mockStrategies.docx.mockResolvedValue({ text: 'plain docx text' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as Record<string, unknown>;

    expect(document.text).toBe('plain docx text');
    expect('data' in document).toBe(false);
  });

  it('does not add a data key for formats that only produce text, such as PDF', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('scan.pdf') } }],
      buffers: [Buffer.from('%PDF-1.4')],
    });
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: 'plain pdf text' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as Record<string, unknown>;

    expect(document.text).toBe('plain pdf text');
    expect('data' in document).toBe(false);
  });

  it('rejects structured data that exceeds the global output limit, even when text fits', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('big.json') } }],
      buffers: [Buffer.from('{"a":1}')],
      params: { advancedOptions: { maxOutputChars: 10 } },
      continueOnFail: true,
    });
    // `text` alone is short enough to pass the limit, but `data` mirrors a much
    // larger object — it must not leak past the limit that constrains `text`.
    mockStrategies.json.mockResolvedValue({
      text: '{"a":1}',
      data: { a: 'x'.repeat(1000) },
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { error: { stage: string; code: string } };

    expect(document.error).toMatchObject({
      stage: 'normalize',
      code: 'OUTPUT_LIMIT_EXCEEDED',
    });
  });

  it('truncates oversized text output using the global output limit', async () => {
    const ctx = createContext({
      params: { advancedOptions: { maxOutputChars: 5 } },
    });
    mockStrategies.txt.mockResolvedValue({ text: 'abcdefgh' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { text: string; warnings: string[] };

    expect(document.text).toBe('abcde');
    expect(document.warnings.join(' ')).toMatch(/5 characters/i);
  });

  it('rejects oversized structured output that cannot be safely truncated', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('large.csv') } }],
      buffers: [Buffer.from('csv')],
      params: { advancedOptions: { maxOutputChars: 5 } },
      continueOnFail: true,
    });
    mockStrategies.csv.mockResolvedValue({ sheets: { Sheet1: [{ A: 'large value' }] } });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { error: { stage: string; code: string } };

    expect(document.error).toMatchObject({
      stage: 'normalize',
      code: 'OUTPUT_LIMIT_EXCEEDED',
    });
  });

  it('rejects an oversized structured output without ever serializing it as one huge string', async () => {
    const originalStringify = JSON.stringify;
    const producedLengths: number[] = [];
    const stringifySpy = jest.spyOn(JSON, 'stringify').mockImplementation((value, ...rest) => {
      const result = originalStringify(value, ...(rest as []));
      if (typeof result === 'string') producedLengths.push(result.length);
      return result;
    });

    try {
      const bigRow = { A: 'x'.repeat(1000) };
      const rows = Array.from({ length: 2000 }, () => ({ ...bigRow }));
      // Full sheets payload would serialize to roughly 2,000,000+ characters.
      const fullSerializedLength = originalStringify({ Sheet1: rows }).length;
      expect(fullSerializedLength).toBeGreaterThan(1_000_000);

      const ctx = createContext({
        items: [{ json: {}, binary: { data: binary('large.csv') } }],
        buffers: [Buffer.from('csv')],
        params: { advancedOptions: { maxOutputChars: 100 } },
        continueOnFail: true,
      });
      mockStrategies.csv.mockResolvedValue({ sheets: { Sheet1: rows } });

      const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
      const document = output[0].json.document as { error: { stage: string; code: string } };

      expect(document.error).toMatchObject({
        stage: 'normalize',
        code: 'OUTPUT_LIMIT_EXCEEDED',
      });
      // Proves the limit check never materialized the full payload as a single string:
      // every intermediate string produced while checking the limit stayed small.
      expect(Math.max(...producedLengths)).toBeLessThan(fullSerializedLength / 10);
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('reports the file-size limit at the check_limits stage', async () => {
    const ctx = createContext({
      buffers: [Buffer.from('too large')],
      params: { advancedOptions: { maxFileSizeMb: 0.000001 } },
      continueOnFail: true,
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as { error: { stage: string; code: string } };

    expect(document.error).toMatchObject({ stage: 'check_limits', code: 'FILE_TOO_LARGE' });
    expect(mockStrategies.txt).not.toHaveBeenCalled();
  });

  it('returns a structured error item when Continue On Fail is enabled', async () => {
    const ctx = createContext({
      items: [{ json: { requestId: 42 }, binary: { data: binary('bad.bin') } }],
      continueOnFail: true,
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as {
      status: string;
      error: { stage: string; code: string; fileName: string };
    };

    expect(output[0].json.requestId).toBe(42);
    expect(document.status).toBe('error');
    expect(document.error).toMatchObject({
      stage: 'detect',
      code: 'UNSUPPORTED_FORMAT',
      fileName: 'bad.bin',
    });
  });

  it('keeps successful items and requested binaries in a mixed Continue On Fail batch', async () => {
    const badItem: INodeExecutionData = {
      json: { id: 'bad' },
      binary: { data: binary('bad.bin') },
    };
    const goodItem: INodeExecutionData = {
      json: { id: 'good' },
      binary: { data: binary('good.txt') },
    };
    const ctx = createContext({
      items: [badItem, goodItem],
      buffers: [Buffer.from('bad'), Buffer.from('good')],
      params: { keepSourceBinary: true, advancedOptions: { maxConcurrency: 2 } },
      continueOnFail: true,
    });
    mockStrategies.txt.mockResolvedValue({ text: 'good' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect((output[0].json.document as { status: string }).status).toBe('error');
    expect((output[1].json.document as { status: string }).status).toBe('success');
    expect(output[0].binary).toBe(badItem.binary);
    expect(output[1].binary).toBe(goodItem.binary);
  });

  it('throws NodeOperationError when Continue On Fail is disabled', async () => {
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('bad.bin') } }],
    });

    await expect(node.execute.call(ctx as unknown as IExecuteFunctions))
      .rejects.toBeInstanceOf(NodeOperationError);
  });

  it('rejects an oversized Office archive before parsing', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('sample.docx') } }],
      buffers: [buffer],
      params: { advancedOptions: { maxArchiveEntries: 1 } },
      continueOnFail: true,
    });
    mockFileTypeFromBuffer.mockResolvedValue({
      ext: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    mockStrategies.docx.mockResolvedValue({ text: 'must not run' });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as {
      error: { stage: string; code: string };
    };

    expect(document.error).toMatchObject({
      stage: 'check_limits',
      code: 'ARCHIVE_LIMIT_EXCEEDED',
    });
    expect(mockStrategies.docx).not.toHaveBeenCalled();
  });

  it('uses local OCR for an image-only PDF and releases resources', async () => {
    const destroy = jest.fn(async () => undefined);
    const getPage = jest.fn(async (page: number) => Buffer.from(`page-${page}`));
    const terminate = jest.fn(async () => undefined);
    const recognize = jest.fn(async (image: Buffer) => ({
      data: {
        text: `recognized ${image.toString()}`,
        confidence: image.toString() === 'page-1' ? 90 : 80,
      },
    }));
    mockRenderPdf.mockResolvedValue({ length: 2, getPage, destroy });
    mockCreateWorker.mockResolvedValue({ recognize, terminate });
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: '' });
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('scan.pdf') } }],
      buffers: [Buffer.from('%PDF scan')],
      params: {
        ocrMode: 'whenEmpty',
        ocrOptions: {
          languages: 'rus+eng',
          scale: 2,
          maxPages: 2,
          pageTimeoutSeconds: 60,
        },
      },
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const document = output[0].json.document as {
      text: string;
      metadata: { ocr: { engine: string; languages: string; pagesProcessed: number; averageConfidence: number; processingTimeMs: number } };
    };

    expect(document.text).toContain('recognized page-1');
    expect(document.text).toContain('recognized page-2');
    expect(document.metadata.ocr).toEqual({
      engine: 'tesseract.js',
      languages: 'rus+eng',
      pagesProcessed: 2,
      averageConfidence: 85,
      processingTimeMs: expect.any(Number),
    });
    expect(mockCreateWorker).toHaveBeenCalledWith(['rus', 'eng'], undefined, expect.any(Object));
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('does not start OCR when normal PDF extraction returns text', async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: 'embedded PDF text' });
    const ctx = createContext({
      items: [{ json: {}, binary: { data: binary('text.pdf') } }],
      buffers: [Buffer.from('%PDF text')],
      params: { ocrMode: 'whenEmpty' },
    });

    const [output] = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect((output[0].json.document as { text: string }).text).toBe('embedded PDF text');
    expect(mockLoadOcrDependencies).not.toHaveBeenCalled();
  });

  it('limits OCR concurrency independently from file concurrency', async () => {
    let activeRecognitions = 0;
    let maxActiveRecognitions = 0;
    mockRenderPdf.mockImplementation(async () => ({
      length: 1,
      getPage: async () => Buffer.from('page'),
      destroy: async () => undefined,
    }));
    mockCreateWorker.mockImplementation(async () => ({
      recognize: async () => {
        activeRecognitions += 1;
        maxActiveRecognitions = Math.max(maxActiveRecognitions, activeRecognitions);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRecognitions -= 1;
        return { data: { text: 'recognized', confidence: 90 } };
      },
      terminate: async () => undefined,
    }));
    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: '' });
    const ctx = createContext({
      items: [
        { json: {}, binary: { data: binary('first.pdf') } },
        { json: {}, binary: { data: binary('second.pdf') } },
      ],
      buffers: [Buffer.from('%PDF first'), Buffer.from('%PDF second')],
      params: {
        advancedOptions: { maxConcurrency: 2 },
        ocrMode: 'whenEmpty',
        ocrOptions: { ocrConcurrency: 1 },
      },
    });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(maxActiveRecognitions).toBe(1);
  });
});
