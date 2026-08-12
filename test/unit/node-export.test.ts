import * as nodeModule from '../../src/ConvertFileToJson.node';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

describe('n8n node module export contract', () => {
  it('exports the class using the compiled node filename', () => {
    const exports = nodeModule as unknown as Record<string, unknown>;
    expect(typeof exports.ConvertFileToJson).toBe('function');
  });
});
