import * as fs from 'fs';
import * as path from 'path';
import readXlsxFile, { readSheetNames } from 'read-excel-file/node';
import { limitExcelSheet } from '../../src/helpers';
import { numberToColumn } from '../../src/utils/columns';

describe('XLSX Sheets Processing', () => {
  describe('Real XLSX file structure', () => {
    it('should analyze sample2.xlsx structure', async () => {
      const filePath = path.join(__dirname, '../samples/sample2.xlsx');
      
      if (!fs.existsSync(filePath)) {
        console.log('⚠️ sample2.xlsx not found, skipping test');
        return;
      }
      
      const buffer = fs.readFileSync(filePath);
      const sheetNames = await readSheetNames(buffer);
      
      console.log('\n=== XLSX FILE ANALYSIS ===\n');
      console.log(`Total sheets: ${sheetNames.length}`);
      
      const sheets: Record<string, unknown[]> = {};
      
      for (const sheetName of sheetNames) {
        const rows = await readXlsxFile(buffer, { sheet: sheetName });
        console.log(`\nSheet: "${sheetName}"`);
        console.log(`  Rows: ${rows.length}`);
        
        const jsonData: unknown[] = [];
        
        for (const row of rows) {
          const rowData: Record<string, unknown> = {};
          row.forEach((cell: unknown, colIndex: number) => {
            if (cell !== null && cell !== undefined) {
              const columnLetter = numberToColumn(colIndex + 1);
              rowData[columnLetter] = cell instanceof Date ? cell.toISOString() : cell;
            }
          });
          if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
          }
        }
        
        sheets[sheetName] = limitExcelSheet(jsonData, 0);
      }
      
      console.log('\n=== RESULT STRUCTURE ===\n');
      console.log('Sheet names:', Object.keys(sheets));
      Object.entries(sheets).forEach(([name, data]) => {
        console.log(`  - "${name}": ${data.length} rows`);
      });
      
      expect(sheetNames.length).toBeGreaterThan(0);
    });
  });

  describe('Column letter conversion', () => {
    it('should convert column numbers to letters correctly', () => {
      expect(numberToColumn(1)).toBe('A');
      expect(numberToColumn(2)).toBe('B');
      expect(numberToColumn(3)).toBe('C');
      expect(numberToColumn(26)).toBe('Z');
      expect(numberToColumn(27)).toBe('AA');
      expect(numberToColumn(28)).toBe('AB');
    });
  });

  describe('Sheet size limiting', () => {
    it('should limit large sheets to 10000 rows', () => {
      const largeSheet = Array.from({ length: 15000 }, (_, i) => ({
        A: `Row${i}`,
        B: i
      }));
      
      const limited = limitExcelSheet(largeSheet, 10000);
      
      expect(limited.length).toBe(10000);
      expect(limited[0]).toEqual({ A: 'Row0', B: 0 });
      expect(limited[9999]).toEqual({ A: 'Row9999', B: 9999 });
    });

    it('should not limit sheets under 10000 rows', () => {
      const smallSheet = Array.from({ length: 100 }, (_, i) => ({
        A: `Row${i}`
      }));
      
      const result = limitExcelSheet(smallSheet, 10000);
      
      expect(result.length).toBe(100);
      expect(result).toEqual(smallSheet);
    });

    it('should return all rows when maxRows is 0', () => {
      const sheet = Array.from({ length: 50 }, (_, i) => ({ A: `Row${i}` }));
      const result = limitExcelSheet(sheet, 0);
      expect(result).toEqual(sheet);
    });
  });
});
