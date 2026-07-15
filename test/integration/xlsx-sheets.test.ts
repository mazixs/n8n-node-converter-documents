import * as fs from 'fs';
import * as path from 'path';
import { strategies } from '../../src/strategies';
import { numberToColumn } from '../../src/utils/columns';
import type { StrategyFn } from '../../src/types';

describe('XLSX Sheets Processing', () => {
  describe('Real XLSX file structure', () => {
    it('should convert all sheets from sample2.xlsx', async () => {
      const filePath = path.join(__dirname, '../samples/sample2.xlsx');
      const buffer = fs.readFileSync(filePath);
      const result = await strategies.xlsx(buffer);

      if (!('sheets' in result)) throw new Error('Expected sheet result');
      expect(Object.keys(result.sheets)).toEqual(['Sheet1']);
      expect(result.sheets.Sheet1).toHaveLength(4);
      expect(result.sheets.Sheet1[0]).toEqual(expect.objectContaining({ A: expect.anything() }));
    });

    it('limits rows per sheet when configured', async () => {
      const buffer = fs.readFileSync(path.join(__dirname, '../samples/sample2.xlsx'));

      const strategy = strategies.xlsx as unknown as StrategyFn;
      const result = await strategy(buffer, 'xlsx', { maxRows: 1 });

      if (!('sheets' in result)) throw new Error('Expected sheets result');
      expect(Object.values(result.sheets).every((rows) => rows.length <= 1)).toBe(true);
      expect(result.warning).toMatch(/1 row/i);
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

});
