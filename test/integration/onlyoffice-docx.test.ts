import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import { extractViaOfficeParser } from '../../src/helpers';

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

    const buffer = fs.readFileSync(filePath);
    
    // officeparser обрабатывает TextBox/shapes через DrawingML
    const extractedText = await extractViaOfficeParser(buffer);
    
    console.log('\n=== TEXTBOX TEST ===');
    console.log('Extracted:', extractedText);
    console.log('====================\n');
    
    // Должен содержать текст
    expect(extractedText.length).toBeGreaterThan(0);
    // Должен содержать обычный текст
    expect(extractedText).toContain('Обычный текст');
  });
});
