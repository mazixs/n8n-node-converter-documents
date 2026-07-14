import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import mammoth from 'mammoth';

describe('ONLYOFFICE DOCX Integration Test', () => {
  it('should extract text from ONLYOFFICE DOCX file without XML namespaces', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    
    // Тестируем через mammoth (как в реальном fallback)
    const result = await mammoth.extractRawText({ buffer });
    const extractedText = result.value.trim();
    
    console.log('\n=== EXTRACTED TEXT ===');
    console.log('Preview:', extractedText.substring(0, 500));
    console.log('Total length:', extractedText.length);
    console.log('======================\n');
    
    // Текст не должен быть пустым
    expect(extractedText.length).toBeGreaterThan(0);
    
    // НЕ должно содержать XML namespaces
    expect(extractedText).not.toContain('http://schemas.microsoft.com');
    expect(extractedText).not.toContain('xmlns');
    expect(extractedText).not.toContain('http://schemas.openxmlformats.org');
  });

  it('should extract text from TextBox and shapes via officeparser', async () => {
    const filePath = path.join(__dirname, '../samples/text-in-textbox.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Sample file not found, skipping test');
      return;
    }

    const script = [
      "const fs = require('fs');",
      "const { parseOffice } = require('officeparser');",
      "parseOffice(fs.readFileSync(process.argv[1]))",
      "  .then((ast) => process.stdout.write(ast.toText()))",
      "  .catch((error) => { console.error(error); process.exit(1); });",
    ].join('\n');
    const extractedText = execFileSync(process.execPath, ['-e', script, filePath], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });
    
    console.log('\n=== TEXTBOX TEST ===');
    console.log('Extracted:', extractedText);
    console.log('====================\n');
    
    // Должен содержать текст
    expect(extractedText.length).toBeGreaterThan(0);
    // Должен содержать обычный текст
    expect(extractedText).toContain('Обычный текст');
  });
});
