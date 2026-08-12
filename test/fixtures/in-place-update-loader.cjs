'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryRoot = process.argv[2];
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-update-test-'));
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
const yauzlRoot = path.join(packageRoot, 'node_modules', 'yauzl');

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

function copyPackageShallow(packageName, destinationRoot) {
  const sourceRoot = path.join(repositoryRoot, 'node_modules', ...packageName.split('/'));
  fs.cpSync(sourceRoot, destinationRoot, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    copyPackageShallow(
      dependencyName,
      path.join(destinationRoot, 'node_modules', ...dependencyName.split('/')),
    );
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
  fs.writeFileSync(
    path.join(distRoot, 'prime.js'),
    "require('file-type'); require('node-html-parser'); require('officeparser');\n",
  );

  require(path.join(distRoot, 'prime.js'));

  fs.rmSync(fileTypeRoot, { recursive: true, force: true });
  fs.rmSync(htmlParserRoot, { recursive: true, force: true });
  fs.rmSync(officeParserRoot, { recursive: true, force: true });
  copyPackageShallow('file-type-modern', modernFileTypeRoot);
  const modernHtmlParserSource = fs.existsSync(
    path.join(repositoryRoot, 'node_modules', 'node-html-parser-modern'),
  ) ? 'node-html-parser-modern' : 'node-html-parser';
  copyPackageShallow(modernHtmlParserSource, modernHtmlParserRoot);
  writeOfficeParser(officeParserRoot, 'officeparser');
  writeOfficeParser(modernOfficeParserRoot, 'officeparser-modern');
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

  process.stdout.write(JSON.stringify({
    nodeName: node.description.name,
    detectedExtension: detected?.ext,
  }));
}

main()
  .finally(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }))
  .catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
