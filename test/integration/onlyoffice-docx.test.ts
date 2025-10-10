import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

describe('ONLYOFFICE DOCX Integration Test', () => {
  it('should extract text from ONLYOFFICE DOCX file without XML namespaces', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
    const buffer = fs.readFileSync(filePath);
    
    // Тестируем прямой парсинг (как в нашем fallback)
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeDefined();
    
    if (documentXml) {
      const parsed = await parseStringPromise(documentXml);
      const textParts: string[] = [];
      
      // Рекурсивная функция для поиска только w:t тегов (текстовые узлы Word)
      const extractText = (obj: unknown, isInsideTextNode = false): void => {
        if (!obj) return;
        
        // Если мы внутри w:t тега, извлекаем только строки
        if (isInsideTextNode && typeof obj === 'string') {
          textParts.push(obj);
          return;
        }
        
        if (Array.isArray(obj)) {
          obj.forEach(item => extractText(item, isInsideTextNode));
          return;
        }
        
        if (typeof obj === 'object') {
          const objRecord = obj as Record<string, unknown>;
          
          // Если нашли w:t тег - извлекаем его содержимое
          if (objRecord['w:t']) {
            extractText(objRecord['w:t'], true); // Флаг: мы внутри текстового узла
            return; // НЕ обходим остальные свойства этого объекта
          }
          
          // Продолжаем поиск w:t в дочерних элементах (только структурные теги)
          for (const key of Object.keys(objRecord)) {
            // Обходим только Word структурные элементы, игнорируем атрибуты
            if (key.startsWith('w:') && key !== 'w:rsidR' && key !== 'w:rsidRPr' && !key.startsWith('$')) {
              extractText(objRecord[key], false);
            }
          }
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
    const buffer = fs.readFileSync(filePath);
    
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeDefined();
    
    if (documentXml) {
      const parsed = await parseStringPromise(documentXml);
      const textParts: string[] = [];
      
      // Новая логика с поддержкой a:t тегов
      const extractText = (obj: unknown, isInsideTextNode = false): void => {
        if (!obj) return;
        
        if (isInsideTextNode && typeof obj === 'string') {
          textParts.push(obj);
          return;
        }
        
        if (Array.isArray(obj)) {
          obj.forEach(item => extractText(item, isInsideTextNode));
          return;
        }
        
        if (typeof obj === 'object') {
          const objRecord = obj as Record<string, unknown>;
          
          // Поддержка w:t И a:t тегов
          if (objRecord['w:t'] || objRecord['a:t']) {
            const textNode = objRecord['w:t'] || objRecord['a:t'];
            extractText(textNode, true);
            return;
          }
          
          for (const key of Object.keys(objRecord)) {
            if ((key.startsWith('w:') || key.startsWith('a:') || key.startsWith('wp:') || key.startsWith('pic:') || key.startsWith('wps:')) 
                && key !== 'w:rsidR' && key !== 'w:rsidRPr' && !key.startsWith('$')) {
              extractText(objRecord[key], false);
            }
          }
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
