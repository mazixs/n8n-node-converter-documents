import fs from 'fs';
import path from 'path';

import {
  ArchiveValidationError,
  isUnsafeArchivePath,
  validateZipArchive,
} from '../../src/security/archive';

describe('Office archive security', () => {
  const safeLimits = {
    maxEntries: 10_000,
    maxUncompressedBytes: 200 * 1024 * 1024,
    maxCompressionRatio: 100,
  };

  it.each([
    '../evil.xml',
    'word/../../evil.xml',
    '/absolute.xml',
    'C:/absolute.xml',
    '..\\evil.xml',
  ])('rejects unsafe archive path %s', (entryName) => {
    expect(isUnsafeArchivePath(entryName)).toBe(true);
  });

  it('accepts a normal nested Office path', () => {
    expect(isUnsafeArchivePath('word/document.xml')).toBe(false);
  });

  it('reads a valid DOCX central directory without extracting files', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));

    const stats = await validateZipArchive(buffer, safeLimits);

    expect(stats.entries).toBeGreaterThan(1);
    expect(stats.uncompressedBytes).toBeGreaterThan(stats.compressedBytes);
  });

  it('rejects an archive exceeding the expanded byte limit', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));

    await expect(validateZipArchive(buffer, { ...safeLimits, maxUncompressedBytes: 1 }))
      .rejects.toMatchObject<Partial<ArchiveValidationError>>({ code: 'ARCHIVE_LIMIT_EXCEEDED' });
  });

  it('rejects an archive exceeding the compression ratio limit', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));

    await expect(validateZipArchive(buffer, { ...safeLimits, maxCompressionRatio: 0.01 }))
      .rejects.toMatchObject<Partial<ArchiveValidationError>>({ code: 'ARCHIVE_LIMIT_EXCEEDED' });
  });

  it('checks the compression ratio of each entry, not only the archive total', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample4.docx'));

    await expect(validateZipArchive(buffer, { ...safeLimits, maxCompressionRatio: 52 }))
      .rejects.toMatchObject<Partial<ArchiveValidationError>>({ code: 'ARCHIVE_LIMIT_EXCEEDED' });
  });

  it('rejects invalid ZIP data', async () => {
    await expect(validateZipArchive(Buffer.from('not-a-zip'), safeLimits))
      .rejects.toMatchObject<Partial<ArchiveValidationError>>({ code: 'ARCHIVE_INVALID' });
  });
});
