import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

describe('DOCX Tables Extraction', () => {
  it('should analyze table structure in onlyoffice2.docx', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
    
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
      
      console.log('\n=== TABLE STRUCTURE ANALYSIS ===\n');
      
      // Ищем таблицы в структуре
      // fast-xml-parser: w:document -> w:body
      const body = parsed['w:document']?.['w:body'];
      
      if (!body) {
        console.log('Body not found or invalid');
        return;
      }
      
      const tables: unknown[] = [];
      
      // body может содержать разные элементы (w:p, w:tbl, etc.)
      // Если body это объект, ищем ключи w:tbl.
      // В fast-xml-parser порядок не гарантирован в объекте, но мы ищем w:tbl.
      
      if (body['w:tbl']) {
          const tableElements = Array.isArray(body['w:tbl']) ? body['w:tbl'] : [body['w:tbl']];
          tables.push(...tableElements);
      }
      // Также таблицы могут быть внутри w:sectPr? Нет, обычно прямо в body.
      // Или если body это массив (если configured so)? Нет, по дефолту объект.
      
      console.log(`Found ${tables.length} tables\n`);
      
      if (tables.length > 0) {
        const firstTable = tables[0] as Record<string, unknown>;
        
        // Извлекаем строки
        const rowsData = firstTable['w:tr'];
        const rows = Array.isArray(rowsData) ? rowsData : (rowsData ? [rowsData] : []) as unknown[];
        console.log(`Table 1: ${rows.length} rows\n`);
        
        // Анализируем каждую строку
        rows.slice(0, 3).forEach((row: unknown, rowIndex: number) => {
          const rowObj = row as Record<string, unknown>;
          const cellsData = rowObj['w:tc'];
          const cells = Array.isArray(cellsData) ? cellsData : (cellsData ? [cellsData] : []) as unknown[];
          console.log(`Row ${rowIndex + 1}: ${cells.length} cells`);
          
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

// Вспомогательная функция для извлечения текста из ячейки (fast-xml-parser version)
function extractTextFromCell(cell: unknown): string {
  const textParts: string[] = [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractText = (obj: any) => {
    if (!obj) return;
    
    if (typeof obj === 'string') return; // usually text is in #text property or w:t
    
    if (Array.isArray(obj)) {
      obj.forEach(item => extractText(item));
      return;
    }
    
    if (typeof obj === 'object') {
      // Нашли текстовый тег
      if (obj['w:t'] || obj['a:t']) {
        const textNode = obj['w:t'] || obj['a:t'];
        if (typeof textNode === 'string') {
            textParts.push(textNode);
        } else if (textNode['#text']) {
            textParts.push(textNode['#text']);
        }
        return;
      }
      
      // Обходим все дочерние элементы
      for (const key of Object.keys(obj)) {
        // Пропускаем атрибуты
        if (!key.startsWith('@_')) {
          extractText(obj[key]);
        }
      }
    }
  };
  
  extractText(cell);
  return textParts.join(' ').trim();
}
