import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

describe('DOCX Tables Extraction', () => {
  it('should analyze table structure in onlyoffice2.docx', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
    const buffer = fs.readFileSync(filePath);
    
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    
    expect(documentXml).toBeDefined();
    
    if (documentXml) {
      const parsed = await parseStringPromise(documentXml);
      
      console.log('\n=== TABLE STRUCTURE ANALYSIS ===\n');
      
      // Ищем таблицы в структуре
      const body = parsed['w:document']?.['w:body'];
      if (!body || !Array.isArray(body)) {
        console.log('Body not found or invalid');
        return;
      }
      
      const tables: any[] = [];
      
      // Обходим элементы body
      for (const item of body) {
        if (item['w:tbl']) {
          const tableElements = Array.isArray(item['w:tbl']) ? item['w:tbl'] : [item['w:tbl']];
          tables.push(...tableElements);
        }
      }
      
      console.log(`Found ${tables.length} tables\n`);
      
      if (tables.length > 0) {
        const firstTable = tables[0];
        
        // Извлекаем строки
        const rows = firstTable['w:tr'] || [];
        console.log(`Table 1: ${rows.length} rows\n`);
        
        // Анализируем каждую строку
        rows.slice(0, 3).forEach((row: any, rowIndex: number) => {
          const cells = row['w:tc'] || [];
          console.log(`Row ${rowIndex + 1}: ${cells.length} cells`);
          
          // DEBUG: Проверим структуру первой ячейки
          if (rowIndex === 0 && cells.length > 0) {
            console.log('  DEBUG - First cell keys:', Object.keys(cells[0]).slice(0, 10));
            console.log('  DEBUG - Has w:p?', !!cells[0]['w:p']);
            if (cells[0]['w:p']) {
              const paragraphs = Array.isArray(cells[0]['w:p']) ? cells[0]['w:p'] : [cells[0]['w:p']];
              console.log('  DEBUG - Paragraphs:', paragraphs.length);
              if (paragraphs[0]) {
                console.log('  DEBUG - First paragraph keys:', Object.keys(paragraphs[0]).slice(0, 5));
                console.log('  DEBUG - Has w:r?', !!paragraphs[0]['w:r']);
                if (paragraphs[0]['w:r']) {
                  const runs = Array.isArray(paragraphs[0]['w:r']) ? paragraphs[0]['w:r'] : [paragraphs[0]['w:r']];
                  console.log('  DEBUG - Runs:', runs.length);
                  if (runs[0]) {
                    console.log('  DEBUG - First run keys:', Object.keys(runs[0]).slice(0, 5));
                    console.log('  DEBUG - Has w:t?', !!runs[0]['w:t']);
                    if (runs[0]['w:t']) {
                      console.log('  DEBUG - w:t content:', JSON.stringify(runs[0]['w:t']));
                    }
                  }
                }
              }
            }
          }
          
          cells.forEach((cell: any, cellIndex: number) => {
            // Извлекаем текст из ячейки
            const text = extractTextFromCell(cell);
            console.log(`  Cell ${cellIndex + 1}: "${text}"`);
          });
          console.log('');
        });
      }
      
      expect(tables.length).toBeGreaterThan(0);
    }
  });
});

// Вспомогательная функция для извлечения текста из ячейки
function extractTextFromCell(cell: any): string {
  const textParts: string[] = [];
  const visited = new WeakSet(); // Защита от циклических ссылок
  
  const extractText = (obj: any, isInsideTextNode = false): void => {
    if (!obj) return;
    
    // Защита от циклов
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      if (visited.has(obj)) return;
      visited.add(obj);
    }
    
    // Если внутри текстового узла - извлекаем строки
    if (isInsideTextNode) {
      if (typeof obj === 'string') {
        textParts.push(obj);
        return;
      }
      // xml2js помещает текст в поле '_'
      if (typeof obj === 'object' && obj['_']) {
        textParts.push(obj['_']);
        return;
      }
    }
    
    if (Array.isArray(obj)) {
      obj.forEach(item => extractText(item, isInsideTextNode));
      return;
    }
    
    if (typeof obj === 'object') {
      // Нашли текстовый тег
      if (obj['w:t'] || obj['a:t']) {
        const textNode = obj['w:t'] || obj['a:t'];
        extractText(textNode, true);
        return; // Не обходим остальные свойства этого объекта
      }
      
      // Обходим все дочерние элементы
      for (const key of Object.keys(obj)) {
        // Пропускаем атрибуты и metadata
        if (!key.startsWith('$') && key !== 'w:rsidR' && key !== 'w:rsidRPr') {
          extractText(obj[key], false);
        }
      }
    }
  };
  
  extractText(cell);
  return textParts.join(' ').trim();
}
