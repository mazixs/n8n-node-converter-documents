import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

describe('ONLYOFFICE DOCX Integration Test', () => {
  it('should extract text from ONLYOFFICE DOCX file without XML namespaces', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    
    // Тестируем прямой парсинг (как в нашем fallback)
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeDefined();
    
    if (documentXml) {
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(documentXml);
      const textParts: string[] = [];
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractText = (obj: any) => {
          if (!obj) return;
          if (typeof obj === 'string') return;
          if (Array.isArray(obj)) {
              obj.forEach(item => extractText(item));
              return;
          }
          if (typeof obj === 'object') {
              if (obj['w:t'] || obj['a:t']) {
                  const t = obj['w:t'] || obj['a:t'];
                  if (typeof t === 'string') textParts.push(t);
                  else if (t['#text']) textParts.push(t['#text']);
                  return;
              }
              Object.keys(obj).forEach(key => {
                  if ((key.startsWith('w:') || key.startsWith('a:') || key.startsWith('wp:') || key.startsWith('pic:') || key.startsWith('wps:')) 
                      && !key.startsWith('w:rsid') && !key.startsWith('@_')) {
                      extractText(obj[key]);
                  }
              });
          }
      };
      
      extractText(parsed);
      const extractedText = textParts.join(' ').trim();
      
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
    }
  });

  it('should extract text from TextBox and shapes (DrawingML a:t tags)', async () => {
    const filePath = path.join(__dirname, '../samples/text-in-textbox.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeDefined();
    
    if (documentXml) {
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(documentXml);
      const textParts: string[] = [];
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractText = (obj: any) => {
          if (!obj) return;
          if (typeof obj === 'string') return;
          if (Array.isArray(obj)) {
              obj.forEach(item => extractText(item));
              return;
          }
          if (typeof obj === 'object') {
              if (obj['w:t'] || obj['a:t']) {
                  const t = obj['w:t'] || obj['a:t'];
                  if (typeof t === 'string') textParts.push(t);
                  else if (t['#text']) textParts.push(t['#text']);
                  return;
              }
              Object.keys(obj).forEach(key => {
                  if ((key.startsWith('w:') || key.startsWith('a:') || key.startsWith('wp:') || key.startsWith('pic:') || key.startsWith('wps:')) 
                      && !key.startsWith('w:rsid') && !key.startsWith('@_')) {
                      extractText(obj[key]);
                  }
              });
          }
      };
      
      extractText(parsed);
      const extractedText = textParts.join(' ').trim();
      
      console.log('\n=== TEXTBOX TEST ===');
      console.log('Extracted:', extractedText);
      console.log('====================\n');
      
      // Должен содержать текст как из TextBox, так и обычный
      expect(extractedText).toContain('Текст внутри TextBox');
      expect(extractedText).toContain('Обычный текст');
      expect(extractedText.length).toBeGreaterThan(0);
    }
  });
});
