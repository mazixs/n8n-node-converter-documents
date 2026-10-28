/**
 * n8n загружает файлы community-нод при старте, поэтому тяжёлые парсеры (вместе ~400 мс)
 * должны грузиться при первом файле своего формата, а не вместе с нодой.
 */

import fs from 'fs';
import path from 'path';

const mockLoaded: string[] = [];

function mockTracked(name: string): unknown {
  mockLoaded.push(name);
  return jest.requireActual(name);
}

jest.mock('officeparser-v8', () => mockTracked('officeparser-v8'));
jest.mock('hucre', () => mockTracked('hucre'));
jest.mock('mammoth', () => mockTracked('mammoth'));

function sample(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, '..', 'samples', name));
}

describe('parser loading', () => {
  beforeEach(() => {
    jest.resetModules();
    mockLoaded.length = 0;
  });

  it('loads no parser when n8n loads the node', async () => {
    await import('../../src/ConvertFileToJson.node');

    expect(mockLoaded).toEqual([]);
  });

  it.each([
    ['sheet-cells.xlsx', 'xlsx', {}, ['hucre']],
    ['sample3.odt', 'odt', {}, ['officeparser-v8']],
    ['sample4.docx', 'docx', { outputFormat: 'html' }, ['mammoth']],
  ] as const)('loads only the parser %s needs, on first use', async (file, ext, options, expected) => {
    const { strategies } = await import('../../src/strategies');

    const result = await strategies[ext](sample(file), ext, options);

    expect(result).toBeTruthy();
    expect(mockLoaded).toEqual(expected);
  });
});
