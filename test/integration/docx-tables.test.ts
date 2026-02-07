import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

describe('DOCX Tables Extraction', () => {
  it('should detect tables in onlyoffice2.docx via HTML conversion', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    
    // mammoth.convertToHtml сохраняет таблицы как <table>
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    
    console.log('\n=== TABLE STRUCTURE ANALYSIS ===\n');
    
    // Считаем таблицы
    const tableCount = (html.match(/<table>/g) || []).length;
    const rowCount = (html.match(/<tr>/g) || []).length;
    const cellCount = (html.match(/<td>/g) || []).length;
    
    console.log(`Found ${tableCount} tables`);
    console.log(`Total rows: ${rowCount}`);
    console.log(`Total cells: ${cellCount}`);
    
    // Извлекаем содержимое первых ячеек для визуализации
    const cellContents = html.match(/<td>(.*?)<\/td>/g);
    if (cellContents && cellContents.length > 0) {
      console.log('\nFirst cells:');
      cellContents.slice(0, 6).forEach((cell: string, i: number) => {
        const text = cell.replace(/<[^>]*>/g, '').trim();
        console.log(`  Cell ${i + 1}: "${text}"`);
      });
    }
    
    expect(tableCount).toBeGreaterThan(0);
    expect(rowCount).toBeGreaterThan(0);
    expect(cellCount).toBeGreaterThan(0);
  });
});
