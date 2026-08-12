import { OcrError, TesseractOcrEngine, type OcrOptions } from '../../src/ocr';

jest.mock('../../src/ocr/loader', () => ({ loadOcrDependencies: jest.fn() }));

const mockLoadOcrDependencies = (jest.requireMock('../../src/ocr/loader') as {
  loadOcrDependencies: jest.Mock;
}).loadOcrDependencies;
const mockCreateWorker = jest.fn();
const mockPdf = jest.fn();

const defaultOptions: OcrOptions = {
  languages: 'eng',
  scale: 2,
  maxPages: 10,
  pageTimeoutMs: 1000,
};

describe('Tesseract OCR engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOcrDependencies.mockResolvedValue([
      { pdf: mockPdf },
      { createWorker: mockCreateWorker },
    ]);
  });

  it('forwards model paths, limits pages, and reports a warning', async () => {
    const destroy = jest.fn(async () => undefined);
    mockPdf.mockResolvedValue({
      length: 3,
      getPage: jest.fn(async (page: number) => Buffer.from(`page-${page}`)),
      destroy,
    });
    const terminate = jest.fn(async () => undefined);
    mockCreateWorker.mockResolvedValue({
      recognize: jest.fn(async () => ({ data: { text: 'text', confidence: 75 } })),
      terminate,
    });

    const result = await new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      languages: 'rus+eng',
      languageDataPath: '/models',
      cachePath: '/cache',
      maxPages: 1,
    });

    expect(mockCreateWorker).toHaveBeenCalledWith(['rus', 'eng'], undefined, {
      langPath: '/models',
      cachePath: '/cache',
    });
    expect(result.metadata).toMatchObject({ pagesProcessed: 1, averageConfidence: 75 });
    expect(result.metadata.processingTimeMs).toEqual(expect.any(Number));
    expect(result.warnings).toEqual(['OCR limited to 1 of 3 pages']);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('supports renderer documents that do not expose destroy', async () => {
    mockPdf.mockResolvedValue({
      length: 1,
      getPage: jest.fn(async () => Buffer.from('page')),
    });
    const terminate = jest.fn(async () => undefined);
    mockCreateWorker.mockResolvedValue({
      recognize: jest.fn(async () => ({ data: { text: 'text', confidence: 80 } })),
      terminate,
    });

    const result = await new TesseractOcrEngine().recognizePdf(
      Buffer.from('pdf'),
      defaultOptions,
    );

    expect(result.text).toContain('text');
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid language codes before loading OCR dependencies', async () => {
    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      languages: '../rus',
    })).rejects.toMatchObject<Partial<OcrError>>({ code: 'OCR_INVALID_OPTIONS' });

    expect(mockLoadOcrDependencies).not.toHaveBeenCalled();
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it.each([
    [{ scale: 0 }, 'scale'],
    [{ scale: 9 }, 'scale'],
    [{ maxPages: -1 }, 'maxPages'],
    [{ maxPages: 1.5 }, 'maxPages'],
    [{ pageTimeoutMs: 0 }, 'pageTimeoutMs'],
  ])('rejects invalid numeric options %j before loading dependencies', async (override, field) => {
    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      ...override,
    })).rejects.toMatchObject<Partial<OcrError>>({
      code: 'OCR_INVALID_OPTIONS',
      message: expect.stringContaining(field),
    });

    expect(mockLoadOcrDependencies).not.toHaveBeenCalled();
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it.each([
    [{ languageDataPath: 'http://models.example/tessdata' }, 'languageDataPath'],
    [{ languageDataPath: 'https://user:secret@models.example/tessdata' }, 'languageDataPath'],
    [{ cachePath: 'relative/cache' }, 'cachePath'],
  ])('rejects unsafe path option %j', async (override, field) => {
    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      ...override,
    })).rejects.toMatchObject<Partial<OcrError>>({
      code: 'OCR_INVALID_OPTIONS',
      message: expect.stringContaining(field),
    });

    expect(mockLoadOcrDependencies).not.toHaveBeenCalled();
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it('times out a page and still releases both resources', async () => {
    const destroy = jest.fn(async () => undefined);
    const terminate = jest.fn(async () => undefined);
    mockPdf.mockResolvedValue({
      length: 1,
      getPage: jest.fn(async () => Buffer.from('page')),
      destroy,
    });
    mockCreateWorker.mockResolvedValue({
      recognize: jest.fn(() => new Promise(() => undefined)),
      terminate,
    });

    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      pageTimeoutMs: 5,
    })).rejects.toMatchObject<Partial<OcrError>>({ code: 'OCR_TIMEOUT' });

    expect(terminate).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('wraps renderer failures and releases initialized resources', async () => {
    const destroy = jest.fn(async () => undefined);
    const terminate = jest.fn(async () => undefined);
    mockPdf.mockResolvedValue({
      length: 1,
      getPage: jest.fn(async () => { throw new Error('render failed'); }),
      destroy,
    });
    mockCreateWorker.mockResolvedValue({
      recognize: jest.fn(),
      terminate,
    });

    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), defaultOptions))
      .rejects.toMatchObject<Partial<OcrError>>({ code: 'OCR_FAILED' });

    expect(terminate).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reports a missing language model and destroys the rendered document', async () => {
    const destroy = jest.fn(async () => undefined);
    mockPdf.mockResolvedValue({
      length: 1,
      getPage: jest.fn(),
      destroy,
    });
    mockCreateWorker.mockRejectedValue(new Error('failed to load zzz.traineddata'));

    await expect(new TesseractOcrEngine().recognizePdf(Buffer.from('pdf'), {
      ...defaultOptions,
      languages: 'zzz',
    })).rejects.toMatchObject<Partial<OcrError>>({
      code: 'OCR_FAILED',
      message: expect.stringContaining('traineddata'),
    });

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
