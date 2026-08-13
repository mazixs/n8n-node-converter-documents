import { sanitizeFileName } from '../../src/utils/sanitize';
import { FileTypeError } from '../../src/errors';

describe('sanitizeFileName', () => {
  it('returns "unknown_file" for empty or non-string input', () => {
    expect(sanitizeFileName('')).toBe('unknown_file');
    expect(sanitizeFileName(undefined as unknown as string)).toBe('unknown_file');
  });

  it('allows legitimate file names that merely contain ".." as a substring', () => {
    expect(sanitizeFileName('report..v2.pdf')).toBe('report..v2.pdf');
    expect(sanitizeFileName('my..file.docx')).toBe('my..file.docx');
    expect(sanitizeFileName('a.b..c.txt')).toBe('a.b..c.txt');
  });

  it('rejects path traversal via a ".." path segment', () => {
    expect(() => sanitizeFileName('../etc/passwd')).toThrow(FileTypeError);
    expect(() => sanitizeFileName('..')).toThrow(FileTypeError);
    expect(() => sanitizeFileName('..\\win.txt')).toThrow(FileTypeError);
  });

  it('rejects file names containing path separators', () => {
    expect(() => sanitizeFileName('a/b.txt')).toThrow(FileTypeError);
    expect(() => sanitizeFileName('a\\b.txt')).toThrow(FileTypeError);
  });

  it('strips dangerous and control characters', () => {
    expect(sanitizeFileName('bad<>:"|?*name.txt')).toBe('bad_______name.txt');
  });

  it('truncates names longer than 255 characters', () => {
    const longName = `${'a'.repeat(300)}.txt`;
    const result = sanitizeFileName(longName);
    expect(result.length).toBe(255);
  });
});
