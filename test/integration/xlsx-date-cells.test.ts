import * as fs from 'fs';
import * as path from 'path';
import readXlsxFile from 'read-excel-file/node';
import { strategies } from '../../src/strategies';

// test/samples/dates.xlsx содержит настоящие date-типизированные ячейки:
// числовой serial + встроенный числовой формат даты (numFmtId 14 и 22),
// а в колонке D — заведомо строковая дата для контраста.
const samplePath = path.join(__dirname, '../samples/dates.xlsx');

describe('XLSX date-typed cells', () => {
  it('read-excel-file returns real Date objects for date-formatted cells', async () => {
    const workbook = await readXlsxFile(fs.readFileSync(samplePath), { dateFormat: 'YYYY-MM-DD' });

    expect(workbook.map((entry) => entry.sheet)).toEqual(['Dates']);
    const [, valueRow] = workbook[0].data;
    expect(valueRow[1]).toBeInstanceOf(Date);
    expect(valueRow[2]).toBeInstanceOf(Date);
    expect(typeof valueRow[3]).toBe('string');
  });

  it('converts date cells to ISO strings and leaves string cells untouched', async () => {
    const result = await strategies.xlsx(fs.readFileSync(samplePath));

    if (!('sheets' in result)) throw new Error('Expected sheets result');
    expect(Object.keys(result.sheets)).toEqual(['Dates']);

    const rows = result.sheets.Dates as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ A: 'name', B: 'due', C: 'createdAt', D: 'createdAt' });
    expect(rows[1]).toEqual({
      A: 'invoice',
      B: '2026-08-13T00:00:00.000Z',
      C: '2026-08-13T09:30:00.000Z',
      D: '2026-08-13',
    });
    for (const value of Object.values(rows[1])) {
      expect(value).not.toBeInstanceOf(Date);
      expect(typeof value).toBe('string');
    }
  });
});
