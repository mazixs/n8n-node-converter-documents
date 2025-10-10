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
      
      const tables: unknown[] = [];
      
      // Обходим элементы body
      for (const item of body) {
        if (item['w:tbl']) {
          const tableElements = Array.isArray(item['w:tbl']) ? item['w:tbl'] : [item['w:tbl']];
          tables.push(...tableElements);
        }
      }
      
      console.log(`Found ${tables.length} tables\n`);
      
      if (tables.length > 0) {
        const firstTable = tables[0] as Record<string, unknown>;
        
        // Извлекаем строки
        const rows = (firstTable['w:tr'] || []) as unknown[];
        console.log(`Table 1: ${rows.length} rows\n`);
        
        // Анализируем каждую строку
        rows.slice(0, 3).forEach((row: unknown, rowIndex: number) => {
          const rowObj = row as Record<string, unknown>;
          const cells = (rowObj['w:tc'] || []) as unknown[];
          console.log(`Row ${rowIndex + 1}: ${cells.length} cells`);
          
          // DEBUG: Проверим структуру первой ячейки
          if (rowIndex === 0 && cells.length > 0) {
            const firstCell = cells[0] as Record<string, unknown>;
            console.log('  DEBUG - First cell keys:', Object.keys(firstCell).slice(0, 10));
            console.log('  DEBUG - Has w:p?', !!firstCell['w:p']);
            if (firstCell['w:p']) {
              const paragraphs = Array.isArray(firstCell['w:p']) ? firstCell['w:p'] : [firstCell['w:p']];
              console.log('  DEBUG - Paragraphs:', paragraphs.length);
              if (paragraphs[0]) {
                const firstPara = paragraphs[0] as Record<string, unknown>;
                console.log('  DEBUG - First paragraph keys:', Object.keys(firstPara).slice(0, 5));
                console.log('  DEBUG - Has w:r?', !!firstPara['w:r']);
                if (firstPara['w:r']) {
                  const runs = Array.isArray(firstPara['w:r']) ? firstPara['w:r'] : [firstPara['w:r']];
                  console.log('  DEBUG - Runs:', runs.length);
                  if (runs[0]) {
                    const firstRun = runs[0] as Record<string, unknown>;
                    console.log('  DEBUG - First run keys:', Object.keys(firstRun).slice(0, 5));
                    console.log('  DEBUG - Has w:t?', !!firstRun['w:t']);
                    if (firstRun['w:t']) {
                      console.log('  DEBUG - w:t content:', JSON.stringify(firstRun['w:t']));
                    }
                  }
                }
              }
            }
          }
          
          cells.forEach((cell: unknown, cellIndex: number) => {
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
function extractTextFromCell(cell: unknown): string {
  const textParts: string[] = [];
  const visited = new WeakSet(); // Защита от циклических ссылок
  
  const extractText = (obj: unknown, isInsideTextNode = false): void => {
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
      if (typeof obj === 'object') {
        const objRecord = obj as Record<string, unknown>;
        if (objRecord['_'] && typeof objRecord['_'] === 'string') {
          textParts.push(objRecord['_']);
          return;
        }
      }
    }
    
    if (Array.isArray(obj)) {
      obj.forEach(item => extractText(item, isInsideTextNode));
      return;
    }
    
    if (typeof obj === 'object') {
      const objRecord = obj as Record<string, unknown>;
      // Нашли текстовый тег
      if (objRecord['w:t'] || objRecord['a:t']) {
        const textNode = objRecord['w:t'] || objRecord['a:t'];
        extractText(textNode, true);
        return; // Не обходим остальные свойства этого объекта
      }
      
      // Обходим все дочерние элементы
      for (const key of Object.keys(objRecord)) {
        // Пропускаем атрибуты и metadata
        if (!key.startsWith('$') && key !== 'w:rsidR' && key !== 'w:rsidRPr') {
          extractText(objRecord[key], false);
        }
      }
    }
  };
  
  extractText(cell);
  return textParts.join(' ').trim();
}
