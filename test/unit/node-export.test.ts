import * as nodeModule from '../../src/ConvertFileToJson.node';
import { ConvertFileToJson } from '../../src/ConvertFileToJson.node';

describe('n8n node module export contract', () => {
  it('exports the class using the compiled node filename', () => {
    const exports = nodeModule as unknown as Record<string, unknown>;
    expect(typeof exports.ConvertFileToJson).toBe('function');
  });

  it('keeps the type identifier stable even though the display name changed', () => {
    // `description.name` is the node type identifier referenced by saved workflows.
    // Renaming it would turn every existing workflow into an "unrecognized node type".
    // Only `displayName` (the label shown on the canvas) is allowed to change.
    const node = new ConvertFileToJson();

    expect(node.description.name).toBe('convertFileToJson');
    expect(node.description.displayName).toBe('Convert Document');
  });
});
