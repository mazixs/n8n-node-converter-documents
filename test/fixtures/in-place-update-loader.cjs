'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repositoryRoot = process.argv[2];
// The caller removes it: on Windows this process cannot delete the native modules it has loaded.
const temporaryRoot = process.argv[3];
const packageRoot = path.join(
  temporaryRoot,
  'node_modules',
  '@mazix',
  'n8n-nodes-converter-documents',
);
const distRoot = path.join(packageRoot, 'dist');
const fileTypeRoot = path.join(packageRoot, 'node_modules', 'file-type');
const modernFileTypeRoot = path.join(packageRoot, 'node_modules', 'file-type-modern');
const htmlParserRoot = path.join(packageRoot, 'node_modules', 'node-html-parser');
const modernHtmlParserRoot = path.join(packageRoot, 'node_modules', 'node-html-parser-modern');
const officeParserRoot = path.join(packageRoot, 'node_modules', 'officeparser');
const modernOfficeParserRoot = path.join(packageRoot, 'node_modules', 'officeparser-modern');
const v8OfficeParserRoot = path.join(packageRoot, 'node_modules', 'officeparser-v8');
const topLevelPdfjsRoot = path.join(packageRoot, 'node_modules', 'pdfjs-dist');
const yauzlRoot = path.join(packageRoot, 'node_modules', 'yauzl');
const hucreRoot = path.join(packageRoot, 'node_modules', 'hucre');

function writeOfficeParser(root, packageName) {
  fs.mkdirSync(path.join(root, 'dist', 'utils'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: packageName, version: '6.0.7', main: 'dist/index.js' }),
  );
  fs.writeFileSync(
    path.join(root, 'dist', 'index.js'),
    "module.exports = require('./utils/zipUtils');\n",
  );
  fs.writeFileSync(
    path.join(root, 'dist', 'utils', 'zipUtils.js'),
    "const yauzl = require('yauzl'); module.exports = { parseOffice: async () => ({ toText: () => '' }), yauzl };\n",
  );
}

function writeYauzl(root) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'yauzl', version: '3.4.0', main: 'index.js' }),
  );
  fs.writeFileSync(path.join(root, 'index.js'), 'module.exports = { modern: true };\n');
}

/**
 * pdf.js 5.5.207 as 1.5.0 leaves it in a running n8n: the API module in the ESM cache under the
 * package root, its worker in globalThis.pdfjsWorker. Both throw if the updated node reaches them.
 */
function writeStalePdfjs(root) {
  fs.mkdirSync(path.join(root, 'legacy', 'build'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'pdfjs-dist', version: '5.5.207' }),
  );
  fs.writeFileSync(
    path.join(root, 'legacy', 'build', 'pdf.mjs'),
    "export const version = '5.5.207';\n" +
      "export function getDocument() { throw new Error('stale pdf.js 5.5.207 API used'); }\n",
  );
  fs.writeFileSync(
    path.join(root, 'legacy', 'build', 'pdf.worker.mjs'),
    "const fail = () => { throw new Error('stale pdf.js 5.5.207 worker used'); };\n" +
      'globalThis.pdfjsWorker = { WorkerMessageHandler: { setup: fail, initializeFromPort: fail } };\n',
  );
}

function findInstalledPackage(fromDirectory, packageName) {
  for (let directory = fromDirectory; ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(directory) === directory) {
      throw new Error(`Cannot find ${packageName} from ${fromDirectory}`);
    }
  }
}

function installedPackage(packageName) {
  return path.join(repositoryRoot, 'node_modules', ...packageName.split('/'));
}

/**
 * Like npm --install-strategy=shallow: everything a direct dependency needs lands in its own
 * node_modules. Packages nested in the source come along with it; hoisted ones are gathered there.
 */
function copyPackageShallow(sourceRoot, destinationRoot) {
  fs.cpSync(sourceRoot, destinationRoot, { recursive: true });

  const visited = new Set([sourceRoot]);
  const pending = [sourceRoot];
  while (pending.length > 0) {
    const packageRoot = pending.pop();
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
      const dependencyRoot = findInstalledPackage(packageRoot, dependencyName);
      if (visited.has(dependencyRoot)) continue;
      visited.add(dependencyRoot);
      pending.push(dependencyRoot);

      if (dependencyRoot.startsWith(sourceRoot + path.sep)) continue;
      const destination = path.join(destinationRoot, 'node_modules', ...dependencyName.split('/'));
      if (!fs.existsSync(destination)) fs.cpSync(dependencyRoot, destination, { recursive: true });
    }
  }
}

async function main() {
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.cpSync(path.join(repositoryRoot, 'dist'), distRoot, { recursive: true });

  fs.mkdirSync(fileTypeRoot, { recursive: true });
  fs.writeFileSync(
    path.join(fileTypeRoot, 'package.json'),
    JSON.stringify({ name: 'file-type', version: '16.5.4', main: 'index.js' }),
  );
  fs.writeFileSync(
    path.join(fileTypeRoot, 'index.js'),
    'module.exports = { fileTypeFromBuffer: async () => undefined };\n',
  );

  fs.mkdirSync(path.join(htmlParserRoot, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(htmlParserRoot, 'package.json'),
    JSON.stringify({ name: 'node-html-parser', version: '7.0.2', main: 'dist/index.js' }),
  );
  fs.writeFileSync(
    path.join(htmlParserRoot, 'dist', 'index.js'),
    'module.exports = { parse: () => ({ textContent: "" }) };\n',
  );
  writeOfficeParser(officeParserRoot, 'officeparser');
  const oldYauzlRoot = path.join(officeParserRoot, 'node_modules', 'yauzl');
  writeYauzl(oldYauzlRoot);
  writeOfficeParser(modernOfficeParserRoot, 'officeparser-modern');
  writeStalePdfjs(topLevelPdfjsRoot);
  fs.writeFileSync(
    path.join(distRoot, 'prime.js'),
    "require('file-type'); require('node-html-parser'); require('officeparser');\n" +
      "require('officeparser-modern');\n",
  );

  require(path.join(distRoot, 'prime.js'));
  const stalePdfjsBuild = path.join(topLevelPdfjsRoot, 'legacy', 'build');
  await import(pathToFileURL(path.join(stalePdfjsBuild, 'pdf.mjs')).href);
  await import(pathToFileURL(path.join(stalePdfjsBuild, 'pdf.worker.mjs')).href);
  const staleWorker = globalThis.pdfjsWorker;

  fs.rmSync(fileTypeRoot, { recursive: true, force: true });
  fs.rmSync(htmlParserRoot, { recursive: true, force: true });
  fs.rmSync(officeParserRoot, { recursive: true, force: true });
  fs.rmSync(modernOfficeParserRoot, { recursive: true, force: true });
  // The stale pdfjs-dist stays on disk: a lookup of pdfjs-dist from the package root would find it.
  copyPackageShallow(installedPackage('file-type-modern'), modernFileTypeRoot);
  const modernHtmlParserSource = fs.existsSync(installedPackage('node-html-parser-modern'))
    ? 'node-html-parser-modern'
    : 'node-html-parser';
  copyPackageShallow(installedPackage(modernHtmlParserSource), modernHtmlParserRoot);
  copyPackageShallow(installedPackage('officeparser-v8'), v8OfficeParserRoot);
  // hucre is new in this update: dist loads the ESM-only package with require(esm).
  copyPackageShallow(installedPackage('hucre'), hucreRoot);
  writeOfficeParser(officeParserRoot, 'officeparser');
  writeYauzl(yauzlRoot);

  for (const cachedPath of Object.keys(require.cache)) {
    if (cachedPath.startsWith(packageRoot)) delete require.cache[cachedPath];
  }

  const nodeModule = require(path.join(distRoot, 'ConvertFileToJson.node.js'));
  const node = new nodeModule.ConvertFileToJson();
  const { fileTypeFromBuffer } = require(path.join(distRoot, 'file-type-loader.js'));
  const detected = await fileTypeFromBuffer(
    Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  );

  const { strategies } = require(path.join(distRoot, 'strategies', 'index.js'));
  const pdf = await strategies.pdf(
    fs.readFileSync(path.join(repositoryRoot, 'test', 'samples', 'sample3.pdf')),
  );
  const xlsx = await strategies.xlsx(
    fs.readFileSync(path.join(repositoryRoot, 'test', 'samples', 'sheet-cells.xlsx')),
  );

  process.stdout.write(JSON.stringify({
    nodeName: node.description.name,
    detectedExtension: detected?.ext,
    pdfHasText: pdf.text.includes('Get Lost!'),
    staleWorkerRestored: globalThis.pdfjsWorker === staleWorker,
    xlsxSheets: Object.keys(xlsx.sheets),
    hucreFromPackage: require.resolve('hucre', { paths: [distRoot] }).startsWith(hucreRoot),
  }));
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
