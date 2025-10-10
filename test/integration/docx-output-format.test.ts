import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

describe('DOCX Output Format Functionality', () => {
  describe('Plain Text format (outputFormat: "text")', () => {
    it('should extract plain text without HTML tags', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
      const buffer = fs.readFileSync(filePath);

      // Text формат
      const textResult = await mammoth.extractRawText({ buffer });
      expect(textResult.value).toContain('Привет из ONLYOFFICE');
      expect(textResult.value).not.toContain('<p>');
      expect(textResult.value).not.toContain('<table>');
      
      console.log('✓ Plain text format works correctly');
    });
  });

  describe('HTML format (outputFormat: "html")', () => {
    it('should return HTML with tags', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
      const buffer = fs.readFileSync(filePath);
      
      // HTML формат
      const htmlResult = await mammoth.convertToHtml({ buffer });
      expect(htmlResult.value).toContain('Привет из ONLYOFFICE');
      expect(htmlResult.value).toContain('<p>');
      
      console.log('✓ HTML format works correctly');
    });

    it('should convert tables to HTML', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      // HTML формат с таблицами
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      expect(htmlResult.value).toContain('<table>');
      expect(htmlResult.value).toContain('<tr>');
      expect(htmlResult.value).toContain('<td>');
      expect(htmlResult.value).toContain('Ситуация');
      expect(htmlResult.value).toContain('Что делать');

      // Подсчитаем таблицы
      const tableCount = (htmlResult.value.match(/<table>/g) || []).length;
      expect(tableCount).toBeGreaterThan(0);
      
      console.log(`✓ HTML format preserves ${tableCount} tables`);
    });
  });

  describe('Plain Text does not have HTML', () => {
    it('should not contain HTML tags in plain text mode', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      // Text формат
      const textResult = await mammoth.extractRawText({ buffer });
      
      expect(textResult.value).not.toContain('<table>');
      expect(textResult.value).not.toContain('<tr>');
      expect(textResult.value).not.toContain('<td>');
      expect(textResult.value).not.toContain('<p>');
      expect(textResult.value).not.toContain('<h');

      // Но текст должен содержаться
      expect(textResult.value).toContain('Ситуация');
      
      console.log('✓ Plain text has no HTML tags');
    });
  });

  describe('Size comparison', () => {
    it('should show size difference between text and HTML formats', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      const textResult = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      const textSize = textResult.value.length;
      const htmlSize = htmlResult.value.length;
      
      console.log('\n=== FORMAT COMPARISON ===');
      console.log(`Plain Text size: ${textSize} chars`);
      console.log(`HTML size: ${htmlSize} chars`);
      console.log(`Difference: ${htmlSize - textSize} chars (+${Math.round((htmlSize / textSize) * 100)}%)`);
      
      // HTML должен быть больше из-за разметки
      expect(htmlSize).toBeGreaterThan(textSize);
      
      // Но оба должны содержать контент
      expect(textSize).toBeGreaterThan(100);
      expect(htmlSize).toBeGreaterThan(100);
    });
  });
});
