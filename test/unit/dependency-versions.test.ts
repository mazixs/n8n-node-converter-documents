import fs from 'fs';
import path from 'path';

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
      require.resolve('officeparser/package.json'),
    );
    const declaredVersion = projectManifest.dependencies?.officeparser;

    expect(declaredVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(declaredVersion).toBe(officeParserManifest.version);
  });
});
