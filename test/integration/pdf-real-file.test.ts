import { execFileSync } from 'child_process';
import path from 'path';

describe('PDF extraction with the production parser', () => {
  it('extracts text from a real PDF without a worker version mismatch', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const pdfPath = path.resolve(__dirname, '../samples/sample3.pdf');
    const script = [
      "const fs = require('fs');",
      "const { parseOffice } = require('officeparser');",
      "parseOffice(fs.readFileSync(process.argv[1]))",
      "  .then((ast) => process.stdout.write(ast.toText()))",
      "  .catch((error) => { console.error(error); process.exit(1); });",
    ].join('\n');

    const text = execFileSync(process.execPath, ['-e', script, pdfPath], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(text.trim().length).toBeGreaterThan(0);
  });
});
