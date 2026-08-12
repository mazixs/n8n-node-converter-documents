import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('in-place n8n community package update', () => {
  it('loads after replacing dependencies whose entry points changed since 1.2.2', () => {
    const repositoryRoot = path.resolve(__dirname, '../..');
    const output = execFileSync(
      process.execPath,
      [
        path.join(repositoryRoot, 'test/fixtures/in-place-update-loader.cjs'),
        repositoryRoot,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_PATH: path.join(repositoryRoot, 'node_modules'),
        },
      },
    );

    expect(JSON.parse(output)).toEqual({
      nodeName: 'convertFileToJson',
      detectedExtension: 'png',
    });
  });
});
