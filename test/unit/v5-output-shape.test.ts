import type { IExecuteFunctions } from 'n8n-workflow';

import { FileToJsonNode } from '../../src/ConvertFileToJson.node';

/**
 * The `data` field (structured JSON/XML/YML output) is a version-6-only
 * addition. Version 5's execute body is not allowed to change — its output
 * shape is fixed by history — so this test runs the *real* (unmocked)
 * `json`/`yml` strategies through the real v5 pipeline and checks that the
 * new `data` field never appears in v5's aggregate output.
 */
function createV5Context(fileName: string, buffer: Buffer) {
  return {
    getInputData: jest.fn(() => [{ binary: { data: { fileName } } }]),
    getNodeParameter: jest.fn((name: string, _index: number, fallback?: unknown) => {
      const params: Record<string, unknown> = {
        binaryPropertyName: 'data',
        maxFileSize: 50,
        maxConcurrency: 4,
        outputFormat: 'text',
      };
      return name in params ? params[name] : fallback;
    }),
    getNode: jest.fn(() => ({
      id: 'node-id',
      name: 'Convert Document',
      type: 'convertFileToJson',
      typeVersion: 5,
      position: [0, 0],
      parameters: {},
    })),
    helpers: {
      getBinaryDataBuffer: jest.fn(async () => buffer),
    },
    logger: { info: jest.fn(), warn: jest.fn() },
  };
}

describe('version 5 output shape is unaffected by the v6-only data field', () => {
  const node = new FileToJsonNode();

  it('does not include a data key for a JSON input file', async () => {
    const buffer = Buffer.from(JSON.stringify({ nested: { value: 1 } }), 'utf8');
    const ctx = createV5Context('sample.json', buffer);

    const [[result]] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const file = (result.json as { files: Array<Record<string, unknown>> }).files[0];

    expect(typeof file.text).toBe('string');
    expect('data' in file).toBe(false);
  });

  it('does not include a data key for a Yandex Market YML input file', async () => {
    const yml = `<yml_catalog date="2024-01-15"><shop>
      <name>Shop</name>
      <offers><offer id="1" available="true"><name>Item</name></offer></offers>
    </shop></yml_catalog>`;
    const ctx = createV5Context('catalog.yml', Buffer.from(yml, 'utf8'));

    const [[result]] = await node.execute.call(ctx as unknown as IExecuteFunctions);
    const file = (result.json as { files: Array<Record<string, unknown>> }).files[0];

    expect(typeof file.text).toBe('string');
    expect('data' in file).toBe(false);
  });
});
