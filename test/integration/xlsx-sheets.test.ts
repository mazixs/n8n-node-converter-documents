import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { limitExcelSheet } from '../../src/helpers';

describe('XLSX Sheets Processing', () => {
  describe('Real XLSX file structure', () => {
    it('should analyze sample2.xlsx structure', async () => {
      const filePath = path.join(__dirname, '../samples/sample2.xlsx');
      
      if (!fs.existsSync(filePath)) {
        console.log('⚠️ sample2.xlsx not found, skipping test');
        return;
      }
      
      const buffer = fs.readFileSync(filePath);
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      
      console.log('\n=== XLSX FILE ANALYSIS ===\n');
      console.log(`Total sheets: ${workbook.worksheets.length}`);
      
      const sheets: Record<string, unknown[]> = {};
      
      workbook.eachSheet((worksheet, sheetId) => {
        console.log(`\nSheet #${sheetId}: "${worksheet.name}"`);
        console.log(`  Rows: ${worksheet.rowCount}`);
        console.log(`  Columns: ${worksheet.columnCount}`);
        
        const jsonData: unknown[] = [];
        let rowsWithData = 0;
        
        worksheet.eachRow((row, rowNumber) => {
          const rowData: Record<string, unknown> = {};
          let hasData = false;
          
          row.eachCell((cell, colNumber) => {
            // Convert column number to letter (1→A, 2→B, etc)
            const columnLetter = String.fromCharCode(64 + colNumber);
            rowData[columnLetter] = cell.value;
            hasData = true;
          });
          
          if (hasData && Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
            rowsWithData++;
            
            // Show first 3 rows as example
            if (rowNumber <= 3) {
              console.log(`  Row ${rowNumber}:`, JSON.stringify(rowData));
            }
          }
        });
        
        console.log(`  Rows with data: ${rowsWithData}`);
        sheets[worksheet.name] = limitExcelSheet(jsonData, 0);
      });
      
      console.log('\n=== RESULT STRUCTURE ===\n');
      console.log('Output format: { sheets: { ... } }');
      console.log('Sheet names:', Object.keys(sheets));
      console.log('Total data rows per sheet:');
      Object.entries(sheets).forEach(([name, data]) => {
        console.log(`  - "${name}": ${data.length} rows`);
      });
      
      expect(workbook.worksheets.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple sheets handling', () => {
    it('should create separate objects for each sheet', async () => {
      const workbook = new ExcelJS.Workbook();
      
      // Create test workbook with 3 sheets
      const sheet1 = workbook.addWorksheet('Products');
      sheet1.addRow(['ID', 'Name', 'Price']);
      sheet1.addRow([1, 'Apple', 100]);
      sheet1.addRow([2, 'Banana', 50]);
      
      const sheet2 = workbook.addWorksheet('Orders');
      sheet2.addRow(['Order', 'Quantity']);
      sheet2.addRow([101, 5]);
      sheet2.addRow([102, 3]);
      
      const sheet3 = workbook.addWorksheet('Customers');
      sheet3.addRow(['Name', 'Email']);
      sheet3.addRow(['John', 'john@example.com']);
      
      // Convert to buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Parse it back (simulating real XLSX strategy)
      const parsedWorkbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await parsedWorkbook.xlsx.load(buffer as any);
      
      const sheets: Record<string, unknown[]> = {};
      
      parsedWorkbook.eachSheet((worksheet) => {
        const sheetName = worksheet.name;
        const jsonData: unknown[] = [];
        
        worksheet.eachRow((row) => {
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const columnLetter = String.fromCharCode(64 + colNumber);
            rowData[columnLetter] = cell.value;
          });
          if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
          }
        });
        
        sheets[sheetName] = limitExcelSheet(jsonData, 0);
      });
      
      console.log('\n=== MULTIPLE SHEETS TEST ===\n');
      console.log('Sheets:', Object.keys(sheets));
      console.log('Products rows:', sheets['Products'].length);
      console.log('Orders rows:', sheets['Orders'].length);
      console.log('Customers rows:', sheets['Customers'].length);
      
      expect(Object.keys(sheets)).toHaveLength(3);
      expect(sheets['Products']).toHaveLength(3); // Header + 2 rows
      expect(sheets['Orders']).toHaveLength(3);    // Header + 2 rows
      expect(sheets['Customers']).toHaveLength(2); // Header + 1 row
      
      // Check sheet names
      expect(sheets).toHaveProperty('Products');
      expect(sheets).toHaveProperty('Orders');
      expect(sheets).toHaveProperty('Customers');
    });
  });

  describe('Column letter conversion', () => {
    it('should convert column numbers to letters correctly', () => {
      // Testing the conversion logic used in XLSX strategy
      const numberToColumn = (colNumber: number): string => {
        return String.fromCharCode(65 + colNumber); // 0→A, 1→B, etc
      };
      
      expect(numberToColumn(0)).toBe('A');
      expect(numberToColumn(1)).toBe('B');
      expect(numberToColumn(2)).toBe('C');
      expect(numberToColumn(25)).toBe('Z');
      
      console.log('\n=== COLUMN MAPPING ===');
      console.log('Column 1 (index 0) → A');
      console.log('Column 2 (index 1) → B');
      console.log('Column 3 (index 2) → C');
      console.log('...');
      console.log('Column 26 (index 25) → Z');
    });
  });

  describe('Sheet size limiting', () => {
    it('should limit large sheets to 10000 rows', () => {
      const largeSheet = Array.from({ length: 15000 }, (_, i) => ({
        A: `Row${i}`,
        B: i
      }));
      
      const limited = limitExcelSheet(largeSheet, 10000);
      
      console.log('\n=== SIZE LIMITING ===');
      console.log(`Original rows: ${largeSheet.length}`);
      console.log(`Limited rows: ${limited.length}`);
      console.log('Limit: 10,000 rows per sheet');
      
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
  });

  describe('Output format', () => {
    it('should produce correct JSON structure', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('TestSheet');
      
      sheet.addRow(['Name', 'Age', 'City']);
      sheet.addRow(['Alice', 30, 'Moscow']);
      sheet.addRow(['Bob', 25, 'SPB']);
      
      const buffer = await workbook.xlsx.writeBuffer();
      const parsedWorkbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await parsedWorkbook.xlsx.load(buffer as any);
      
      const sheets: Record<string, unknown[]> = {};
      
      parsedWorkbook.eachSheet((worksheet) => {
        const jsonData: unknown[] = [];
        worksheet.eachRow((row) => {
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const columnLetter = String.fromCharCode(64 + colNumber);
            rowData[columnLetter] = cell.value;
          });
          if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
          }
        });
        sheets[worksheet.name] = jsonData;
      });
      
      const result = { sheets };
      
      console.log('\n=== OUTPUT FORMAT ===');
      console.log(JSON.stringify(result, null, 2));
      
      expect(result).toHaveProperty('sheets');
      expect(result.sheets).toHaveProperty('TestSheet');
      expect(result.sheets.TestSheet).toHaveLength(3);
      
      // Check first row (header)
      const firstRow = result.sheets.TestSheet[0] as Record<string, unknown>;
      expect(firstRow).toEqual({ A: 'Name', B: 'Age', C: 'City' });
      
      // Check data row
      const secondRow = result.sheets.TestSheet[1] as Record<string, unknown>;
      expect(secondRow).toEqual({ A: 'Alice', B: 30, C: 'Moscow' });
    });
  });

  describe('Empty cells handling', () => {
    it('should handle rows with sparse data', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sparse');
      
      // Row with gaps: A, skip B, C, skip D, E
      const row1 = sheet.addRow([]);
      row1.getCell(1).value = 'A1'; // Column A
      row1.getCell(3).value = 'C1'; // Column C (skip B)
      row1.getCell(5).value = 'E1'; // Column E (skip D)
      
      const buffer = await workbook.xlsx.writeBuffer();
      const parsedWorkbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await parsedWorkbook.xlsx.load(buffer as any);
      
      const sheets: Record<string, unknown[]> = {};
      
      parsedWorkbook.eachSheet((worksheet) => {
        const jsonData: unknown[] = [];
        worksheet.eachRow((row) => {
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const columnLetter = String.fromCharCode(64 + colNumber);
            rowData[columnLetter] = cell.value;
          });
          if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
          }
        });
        sheets[worksheet.name] = jsonData;
      });
      
      console.log('\n=== SPARSE DATA ===');
      console.log('Input: A1, [skip B], C1, [skip D], E1');
      console.log('Output:', sheets['Sparse'][0]);
      
      const firstRow = sheets['Sparse'][0] as Record<string, unknown>;
      expect(firstRow.A).toBe('A1');
      expect(firstRow.C).toBe('C1');
      expect(firstRow.E).toBe('E1');
      expect(firstRow.B).toBeUndefined(); // Skipped cell
      expect(firstRow.D).toBeUndefined(); // Skipped cell
    });
  });
});
