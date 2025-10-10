import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

describe('DOCX to HTML Conversion', () => {
  describe('mammoth.convertToHtml()', () => {
    it('should convert onlyoffice2.docx (with tables) to HTML', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      console.log('\n=== ONLYOFFICE2 (Tables) → HTML ===\n');
      
      const result = await mammoth.convertToHtml({ buffer });
      
      console.log('HTML output:');
      console.log('─'.repeat(60));
      console.log(result.value);
      console.log('─'.repeat(60));
      console.log(`\nLength: ${result.value.length} chars`);
      console.log('Messages:', result.messages.length);
      
      if (result.messages.length > 0) {
        console.log('\nWarnings/Errors:');
        result.messages.forEach((msg: { type: string; message: string }) => console.log(`  - ${msg.type}: ${msg.message}`));
      }
      
      // Проверки
      expect(result.value).toBeDefined();
      expect(result.value.length).toBeGreaterThan(0);
      
      // Проверим, что таблицы конвертировались в HTML
      const hasTableTag = result.value.includes('<table>');
      const hasSituationText = result.value.includes('Ситуация');
      console.log('\nHas <table> tag?', hasTableTag);
      console.log('Has table content?', hasSituationText);
      
      expect(hasTableTag).toBe(true);
      expect(hasSituationText).toBe(true);
    });

    it('should convert onlyoffice-text.docx (simple text) to HTML', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
      const buffer = fs.readFileSync(filePath);
      
      console.log('\n=== ONLYOFFICE-TEXT (Simple) → HTML ===\n');
      
      const result = await mammoth.convertToHtml({ buffer });
      
      console.log('HTML output:');
      console.log('─'.repeat(60));
      console.log(result.value);
      console.log('─'.repeat(60));
      console.log(`\nLength: ${result.value.length} chars`);
      
      expect(result.value).toBeDefined();
      expect(result.value).toContain('Привет из ONLYOFFICE');
    });

    it('should convert text-in-textbox.docx (with TextBox) to HTML', async () => {
      const filePath = path.join(__dirname, '../samples/text-in-textbox.docx');
      const buffer = fs.readFileSync(filePath);
      
      console.log('\n=== TEXT-IN-TEXTBOX → HTML ===\n');
      
      const result = await mammoth.convertToHtml({ buffer });
      
      console.log('HTML output:');
      console.log('─'.repeat(60));
      console.log(result.value);
      console.log('─'.repeat(60));
      console.log(`\nLength: ${result.value.length} chars`);
      
      expect(result.value).toBeDefined();
      
      // Проверим, извлекается ли текст из TextBox
      const hasTextBoxContent = result.value.includes('TextBox') || result.value.includes('Обычный текст');
      console.log('\nHas TextBox/Regular content?', hasTextBoxContent);
    });
  });

  describe('HTML quality checks', () => {
    it('should preserve text structure and formatting', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      const result = await mammoth.convertToHtml({ buffer });
      const html = result.value;
      
      console.log('\n=== QUALITY ANALYSIS ===\n');
      
      // Анализ структуры HTML
      const stats = {
        totalLength: html.length,
        tables: (html.match(/<table>/g) || []).length,
        tableRows: (html.match(/<tr>/g) || []).length,
        tableCells: (html.match(/<td>/g) || []).length,
        headings: (html.match(/<h[1-6]>/g) || []).length,
        paragraphs: (html.match(/<p>/g) || []).length,
        boldText: (html.match(/<strong>/g) || []).length,
        italicText: (html.match(/<em>/g) || []).length,
        links: (html.match(/<a /g) || []).length,
        lists: (html.match(/<ul>|<ol>/g) || []).length,
      };
      
      console.log('Structure Analysis:');
      console.log(`  Total length: ${stats.totalLength} chars`);
      console.log(`  Tables: ${stats.tables}`);
      console.log(`  Table rows: ${stats.tableRows}`);
      console.log(`  Table cells: ${stats.tableCells}`);
      console.log(`  Headings: ${stats.headings}`);
      console.log(`  Paragraphs: ${stats.paragraphs}`);
      console.log(`  Bold text: ${stats.boldText}`);
      console.log(`  Italic text: ${stats.italicText}`);
      console.log(`  Links: ${stats.links}`);
      console.log(`  Lists: ${stats.lists}`);
      
      // Проверка качества
      console.log('\nQuality Checks:');
      console.log(`  ✓ Has content: ${html.length > 50 ? 'PASS' : 'FAIL'}`);
      console.log(`  ✓ Has tables: ${stats.tables > 0 ? 'PASS' : 'FAIL'}`);
      console.log(`  ✓ Has structure elements: ${(stats.headings + stats.tables + stats.lists) > 0 ? 'PASS' : 'FAIL'}`);
      
      expect(html.length).toBeGreaterThan(50);
      expect(stats.tables).toBeGreaterThan(0);
    });
  });

  describe('Comparison: extractRawText vs convertToHtml', () => {
    it('should show difference between text and HTML output', async () => {
      const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
      const buffer = fs.readFileSync(filePath);
      
      console.log('\n=== TEXT vs HTML COMPARISON ===\n');
      
      // Обычный текст (mammoth.extractRawText)
      const textResult = await mammoth.extractRawText({ buffer });
      
      // HTML
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      console.log('TEXT OUTPUT (first 300 chars):');
      console.log('─'.repeat(60));
      console.log(textResult.value.substring(0, 300));
      console.log('─'.repeat(60));
      console.log(`Total: ${textResult.value.length} chars\n`);
      
      console.log('HTML OUTPUT (first 300 chars):');
      console.log('─'.repeat(60));
      console.log(htmlResult.value.substring(0, 300));
      console.log('─'.repeat(60));
      console.log(`Total: ${htmlResult.value.length} chars\n`);
      
      console.log('DIFFERENCE:');
      console.log(`  Size difference: ${htmlResult.value.length - textResult.value.length} chars`);
      console.log(`  HTML has structure: ${htmlResult.value.includes('<table>') || htmlResult.value.includes('<h')}`);
      console.log(`  Text is plain: ${!textResult.value.includes('<')}`);
      
      expect(textResult.value.length).toBeGreaterThan(0);
      expect(htmlResult.value.length).toBeGreaterThan(0);
    });
  });
});
