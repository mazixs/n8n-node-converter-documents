import { execFileSync } from 'child_process';
import path from 'path';

describe('PDF extraction with the production parser', () => {
  it('extracts text from a real PDF without a worker version mismatch', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const pdfPath = path.resolve(__dirname, '../samples/sample3.pdf');
    const script = [
      "const fs = require('fs');",
      "const { parseOffice } = require('officeparser-v8');",
      "parseOffice(fs.readFileSync(process.argv[1]), { allowRemoteAssets: false })",
      "  .then((ast) => ast.to('text', { textConfig: { preserveLayout: false } }))",
      "  .then((result) => process.stdout.write(result.value))",
      "  .catch((error) => { console.error(error); process.exit(1); });",
    ].join('\n');

    const text = execFileSync(process.execPath, ['-e', script, pdfPath], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(text).toContain('Get Lost!');
    expect(text).toContain('A Document which shows how eaDocX');
  });
});
