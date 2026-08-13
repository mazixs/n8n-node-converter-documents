import { ConvertFileToJson } from '../../src/ConvertFileToJson.node';

/**
 * n8n subtitle expressions are plain JS evaluated with `$parameter` in scope.
 * This test extracts the expression body from the real node description and
 * evaluates it directly (the same way n8n's expression engine would) against
 * a stubbed `$parameter`, so a change to the subtitle template is checked
 * against its actual behavior rather than just its literal string contents.
 */
function evaluateSubtitle(params: Record<string, unknown>): string {
  const node = new ConvertFileToJson();
  const subtitle = node.description.subtitle as string;

  if (!subtitle.startsWith('=')) throw new Error('Expected an n8n expression starting with "="');
  const match = subtitle.slice(1).match(/^\{\{([\s\S]*)\}\}$/);
  if (!match) throw new Error('Expected the whole subtitle to be a single {{ }} expression');

  // n8n exposes `$parameter` as an object accessed via bracket notation
  // (`$parameter["outputFormat"]`), not as a function — mirror that shape.
  const evaluate = new Function('$parameter', `return (${match[1]});`) as (
    parameters: Record<string, unknown>,
  ) => string;
  return evaluate(params);
}

describe('Convert Document node subtitle expression', () => {
  it('shows nothing about format for the default Plain Text output', () => {
    expect(evaluateSubtitle({ outputFormat: 'text' })).toBe('');
  });

  it('does not show Format for XLSX/CSV/PDF/TXT workflows where outputFormat is a no-op', () => {
    // Simulates v5/v6 with the parameter left at its default while processing
    // any non-DOCX format — outputFormat still resolves to "text" regardless.
    expect(evaluateSubtitle({ outputFormat: 'text', ocrMode: 'disabled' })).toBe('');
  });

  it('shows the format only when the user picked a non-default DOCX output', () => {
    expect(evaluateSubtitle({ outputFormat: 'html' })).toBe('Format: html');
    expect(evaluateSubtitle({ outputFormat: 'markdown' })).toBe('Format: markdown');
  });

  it('shows OCR mode when enabled, independent of outputFormat', () => {
    expect(evaluateSubtitle({ outputFormat: 'text', ocrMode: 'whenEmpty' })).toBe('OCR: whenEmpty');
    expect(evaluateSubtitle({ outputFormat: 'text', ocrMode: 'always' })).toBe('OCR: always');
  });

  it('hides OCR when disabled or absent (v5 has no ocrMode parameter at all)', () => {
    expect(evaluateSubtitle({ outputFormat: 'text', ocrMode: 'disabled' })).toBe('');
    expect(evaluateSubtitle({ outputFormat: 'text' })).toBe('');
  });

  it('combines both segments when a non-default format and OCR are both active', () => {
    expect(evaluateSubtitle({ outputFormat: 'markdown', ocrMode: 'always' }))
      .toBe('Format: markdown · OCR: always');
  });
});
