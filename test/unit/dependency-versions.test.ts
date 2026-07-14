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
  it('pins officeparser to the installed compatible version', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const officeParserManifest = readManifest(
      path.resolve(path.dirname(require.resolve('officeparser')), '../package.json'),
    );
    const declaredVersion = projectManifest.dependencies?.officeparser;

    expect(declaredVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(declaredVersion).toBe(officeParserManifest.version);
  });

  it('loads file-type through CommonJS and detects a PDF signature', () => {
    const script = [
      "const { fileTypeFromBuffer } = require('file-type');",
      "fileTypeFromBuffer(Buffer.from('%PDF-1.7\\n')).then((type) => process.stdout.write(type?.ext || ''));",
    ].join('\n');

    const extension = execFileSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });

    expect(extension).toBe('pdf');
  });
});
