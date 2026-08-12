import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

type PackageManifest = {
  version?: string;
  dependencies?: Record<string, string>;
};

function readManifest(manifestPath: string): PackageManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
}

describe('production dependency versions', () => {
  it('pins officeparser to the installed compatible version under a fresh package name', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const officeParserManifest = readManifest(
      path.resolve(path.dirname(require.resolve('officeparser-modern')), '../package.json'),
    );
    const declaredVersion = projectManifest.dependencies?.['officeparser-modern'];

    expect(declaredVersion).toBe('npm:officeparser@6.0.7');
    expect(officeParserManifest.version).toBe('6.0.7');
  });

  it('loads file-type through the native ESM bridge and detects a PDF signature', () => {
    const script = [
      "const { fileTypeFromBuffer } = require('./src/file-type-loader');",
      "fileTypeFromBuffer(Buffer.from('%PDF-1.7\\n')).then((type) => process.stdout.write(type?.ext || ''));",
    ].join('\n');

    const extension = execFileSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });

    expect(extension).toBe('pdf');
  });
});
