import yauzl from 'yauzl';

export type ArchiveErrorCode = 'ARCHIVE_LIMIT_EXCEEDED' | 'ARCHIVE_UNSAFE_PATH' | 'ARCHIVE_INVALID';

export interface ArchiveLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
}

export interface ArchiveStats {
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
}

export class ArchiveValidationError extends Error {
  constructor(message: string, readonly code: ArchiveErrorCode, readonly cause?: Error) {
    super(message);
    this.name = 'ArchiveValidationError';
  }
}

export function isUnsafeArchivePath(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) return true;
  return normalized.split('/').some((part) => part === '..');
}

function exceeds(value: number, limit: number): boolean {
  return limit > 0 && value > limit;
}

export async function validateZipArchive(buffer: Buffer, limits: ArchiveLimits): Promise<ArchiveStats> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(new ArchiveValidationError(
          `Invalid ZIP container: ${openError?.message ?? 'unable to open archive'}`,
          'ARCHIVE_INVALID',
          openError ?? undefined,
        ));
        return;
      }

      const stats: ArchiveStats = { entries: 0, compressedBytes: 0, uncompressedBytes: 0 };
      let settled = false;
      const fail = (error: ArchiveValidationError) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        reject(error);
      };

      zipFile.on('error', (error) => {
        fail(new ArchiveValidationError(`Invalid ZIP container: ${error.message}`, 'ARCHIVE_INVALID', error));
      });
      zipFile.on('entry', (entry) => {
        if (settled) return;
        if (isUnsafeArchivePath(entry.fileName)) {
          fail(new ArchiveValidationError(
            `Unsafe path in ZIP container: ${entry.fileName}`,
            'ARCHIVE_UNSAFE_PATH',
          ));
          return;
        }

        stats.entries += 1;
        stats.compressedBytes += entry.compressedSize;
        stats.uncompressedBytes += entry.uncompressedSize;
        const archiveRatio = stats.compressedBytes === 0
          ? (stats.uncompressedBytes === 0 ? 0 : Number.POSITIVE_INFINITY)
          : stats.uncompressedBytes / stats.compressedBytes;
        const entryRatio = entry.compressedSize === 0
          ? (entry.uncompressedSize === 0 ? 0 : Number.POSITIVE_INFINITY)
          : entry.uncompressedSize / entry.compressedSize;

        if (exceeds(stats.entries, limits.maxEntries)) {
          fail(new ArchiveValidationError(
            `ZIP container exceeds the ${limits.maxEntries} entry limit`,
            'ARCHIVE_LIMIT_EXCEEDED',
          ));
          return;
        }
        if (exceeds(stats.uncompressedBytes, limits.maxUncompressedBytes)) {
          fail(new ArchiveValidationError(
            `ZIP container exceeds the ${limits.maxUncompressedBytes} byte uncompressed limit`,
            'ARCHIVE_LIMIT_EXCEEDED',
          ));
          return;
        }
        if (exceeds(entryRatio, limits.maxCompressionRatio) ||
            exceeds(archiveRatio, limits.maxCompressionRatio)) {
          fail(new ArchiveValidationError(
            `ZIP container exceeds the ${limits.maxCompressionRatio}:1 compression ratio limit`,
            'ARCHIVE_LIMIT_EXCEEDED',
          ));
          return;
        }
        zipFile.readEntry();
      });
      zipFile.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(stats);
      });
      zipFile.readEntry();
    });
  });
}
