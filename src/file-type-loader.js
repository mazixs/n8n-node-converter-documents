/**
 * Keep the ESM import native in the CommonJS build. This also avoids Node's
 * stale package metadata cache when n8n replaces file-type 16 in place. The
 * npm alias gives the ESM-only release a fresh package-resolution key.
 */
exports.fileTypeFromBuffer = async function fileTypeFromBuffer(input) {
  const fileType = await import('file-type-modern');
  return fileType.fileTypeFromBuffer(input);
};
