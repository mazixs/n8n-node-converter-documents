import { execFileSync } from 'child_process';
import path from 'path';

describe('RTF extraction with the production parser', () => {
  it('extracts plain text from a real RTF file without control words', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const rtfPath = path.resolve(__dirname, '../samples/sample1.rtf');
    const script = [
      "const fs = require('fs');",
      "const { parseOffice } = require('officeparser-v8');",
      "parseOffice(fs.readFileSync(process.argv[1]), { allowRemoteAssets: false })",
      "  .then((ast) => ast.to('text', { textConfig: { preserveLayout: false } }))",
      "  .then((result) => process.stdout.write(result.value))",
      "  .catch((error) => { console.error(error); process.exit(1); });",
    ].join('\n');

    const text = execFileSync(process.execPath, ['-e', script, rtfPath], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(text).toContain('It is an example test rtf-file to RTF2XML bean for testing');
    expect(text).not.toMatch(/\\rtf1|\\fonttbl|\\par\b/);
  });
});
