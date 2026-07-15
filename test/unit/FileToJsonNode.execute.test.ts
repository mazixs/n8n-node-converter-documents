import type { IExecuteFunctions } from 'n8n-workflow';
import { fileTypeFromBuffer } from 'file-type';

import { strategies } from '../../src/strategies';
import { EmptyFileError, UnsupportedFormatError } from '../../src/errors';
import { FileToJsonNode } from '../../src/ConvertFileToJson.node';
import { validateZipArchive } from '../../src/security/archive';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

jest.mock('../../src/strategies', () => ({
  strategies: {
    txt: jest.fn(),
    pdf: jest.fn(),
    docx: jest.fn(),
  },
}));

jest.mock('../../src/security/archive', () => ({
  ...jest.requireActual('../../src/security/archive'),
  validateZipArchive: jest.fn(),
}));

type StrategyMockMap = Record<string, jest.Mock>;
type NodeOutputFile = {
  text?: string;
  metadata?: {
    fileType?: string;
    fileName?: string | null;
  };
};

type NodeOutputPayload = {
  files: NodeOutputFile[];
  totalFiles: number;
  processedAt: string;
};

const mockFileTypeFromBuffer = fileTypeFromBuffer as jest.MockedFunction<typeof fileTypeFromBuffer>;
const mockStrategies = strategies as unknown as StrategyMockMap;
const mockValidateZipArchive = validateZipArchive as jest.MockedFunction<typeof validateZipArchive>;

function createContext(options?: {
  fileName?: string;
  buffer?: Buffer;
  params?: Record<string, unknown>;
}) {
  const fileName = options?.fileName ?? 'sample.txt';
  const buffer = options?.buffer ?? Buffer.from('test-content', 'utf8');
  const params: Record<string, unknown> = {
    binaryPropertyName: 'data',
    maxFileSize: 50,
    maxConcurrency: 4,
    outputFormat: 'text',
    ...(options?.params ?? {}),
  };

  const helpers = {
    getBinaryDataBuffer: jest.fn(async () => buffer),
  };

  return {
    getInputData: jest.fn(() => [
      {
        binary: {
          data: {
            fileName,
          },
        },
      },
    ]),
    getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
      if (name in params) return params[name];
      return fallback;
    }),
    getNode: jest.fn(() => ({
      id: 'node-id',
      name: 'Convert File to JSON',
      type: 'convertFileToJson',
      typeVersion: 5,
      position: [0, 0],
      parameters: {},
    })),
    helpers,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
    },
  };
}

describe('FileToJsonNode.execute', () => {
  const node = new FileToJsonNode();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process txt file via real execute pipeline', async () => {
    const buffer = Buffer.from('hello', 'utf8');
    const ctx = createContext({ fileName: 'sample.txt', buffer });
    mockStrategies.txt.mockResolvedValue({ text: 'hello' });

    const result = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockStrategies.txt).toHaveBeenCalledWith(buffer, 'txt', undefined);

    const payload = result[0][0].json as unknown as NodeOutputPayload;
    expect(payload.totalFiles).toBe(1);
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].text).toBe('hello');
    expect(payload.files[0].metadata?.fileType).toBe('txt');
  });

  it('should pass outputFormat to docx strategy', async () => {
    const buffer = Buffer.from('docx', 'utf8');
    const ctx = createContext({
      fileName: 'sample.docx',
      buffer,
      params: { outputFormat: 'markdown' },
    });

    mockStrategies.docx.mockResolvedValue({ text: '# md' });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockStrategies.docx).toHaveBeenCalledWith(buffer, 'docx', { outputFormat: 'markdown' });
  });

  it('checks Office ZIP containers before parsing in version 5', async () => {
    const buffer = Buffer.from('docx', 'utf8');
    const ctx = createContext({ fileName: 'sample.docx', buffer });
    mockValidateZipArchive.mockResolvedValue({ entries: 1, compressedBytes: 1, uncompressedBytes: 1 });
    mockStrategies.docx.mockResolvedValue({ text: 'content' });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockValidateZipArchive).toHaveBeenCalledWith(buffer, {
      maxEntries: 10000,
      maxUncompressedBytes: 200 * 1024 * 1024,
      maxCompressionRatio: 100,
    });
    expect(mockValidateZipArchive.mock.invocationCallOrder[0])
      .toBeLessThan(mockStrategies.docx.mock.invocationCallOrder[0]);
  });

  it('should auto-detect extension from file-type when extension is unknown', async () => {
    const buffer = Buffer.from('autodetect', 'utf8');
    const ctx = createContext({ fileName: 'sample.bin', buffer });

    mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStrategies.pdf.mockResolvedValue({ text: 'auto-detected' });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(buffer);
    expect(mockStrategies.pdf).toHaveBeenCalledWith(buffer, 'pdf', undefined);
  });

  it('should throw UnsupportedFormatError when type cannot be detected', async () => {
    const ctx = createContext({ fileName: 'sample.unknown' });
    mockFileTypeFromBuffer.mockResolvedValue(undefined);

    await expect(node.execute.call(ctx as unknown as IExecuteFunctions))
      .rejects.toThrow(UnsupportedFormatError);
  });

  it('should throw EmptyFileError when strategy returns empty text', async () => {
    const ctx = createContext({ fileName: 'sample.txt' });
    mockStrategies.txt.mockResolvedValue({ text: '   ' });

    await expect(node.execute.call(ctx as unknown as IExecuteFunctions))
      .rejects.toThrow(EmptyFileError);

    expect(ctx.logger.info).not.toHaveBeenCalledWith(
      'Processing completed',
      expect.anything(),
    );
  });

  it('should reject a malformed strategy result', async () => {
    const ctx = createContext({ fileName: 'sample.txt' });
    mockStrategies.txt.mockResolvedValue({});

    await expect(node.execute.call(ctx as unknown as IExecuteFunctions))
      .rejects.toThrow('TXT processing error: strategy returned an invalid result');
  });

  it('should not report a detector failure when detection succeeds without a match', async () => {
    const ctx = createContext({ fileName: 'sample.unknown' });
    mockFileTypeFromBuffer.mockResolvedValue(undefined);

    await expect(node.execute.call(ctx as unknown as IExecuteFunctions))
      .rejects.toThrow(UnsupportedFormatError);

    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  it('should read the DOCX-only output format only for DOCX files', async () => {
    const ctx = createContext({ fileName: 'sample.txt' });
    mockStrategies.txt.mockResolvedValue({ text: 'hello' });

    await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(ctx.getNodeParameter).not.toHaveBeenCalledWith('outputFormat', expect.anything(), expect.anything());
  });

  it('should pair the aggregate result with its source item', async () => {
    const ctx = createContext({ fileName: 'sample.txt' });
    mockStrategies.txt.mockResolvedValue({ text: 'hello' });

    const result = await node.execute.call(ctx as unknown as IExecuteFunctions);

    expect(result[0][0].pairedItem).toEqual([{ item: 0 }]);
  });
});
