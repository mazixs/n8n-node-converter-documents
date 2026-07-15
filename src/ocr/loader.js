/**
 * Keep native dynamic imports in a CommonJS build. TypeScript rewrites import()
 * to require(), which cannot load the ESM-only PDF renderer.
 */
exports.loadOcrDependencies = async function loadOcrDependencies() {
  return Promise.all([
    import('pdf-to-img'),
    import('tesseract.js'),
  ]);
};
