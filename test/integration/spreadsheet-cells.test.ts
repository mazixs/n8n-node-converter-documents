import * as fs from 'fs';
import * as path from 'path';
import { strategies } from '../../src/strategies';
import { ProcessingError } from '../../src/errors';
import type { StrategyFn } from '../../src/types';

// test/samples/sheet-cells.{xlsx,xls,xlsb} — одна книга, сохранённая Excel в трёх форматах
// (test/fixtures/make-sheet-cells.ps1). Ожидания для XLSX сняты с read-excel-file 9.3.10,
// на котором нода читала XLSX до 1.6.0, кроме двух мест, где тот ошибался (см. ниже).
const sample = (extension: string): Buffer =>
  fs.readFileSync(path.join(__dirname, `../samples/sheet-cells.${extension}`));

const strategy = (extension: 'xlsx' | 'xls' | 'xlsb'): StrategyFn =>
  strategies[extension] as unknown as StrategyFn;

const XLSX_CELLS = [
  { A: 'case', B: 'value' },
  // Строки обрезаются по краям, пустые после этого пропадают.
  { A: 'padded text', B: 'padded' },
  { A: 'blank text' },
  // Ошибки формул и константы-ошибки в выводе не появляются.
  { A: 'formula error' },
  { A: 'error constant' },
  { A: 'error-like text', B: '#N/A' },
  // Время без даты стоит на 1899-12-30, как и раньше.
  { A: 'time', B: '1899-12-30T16:00:00.000Z' },
  { A: 'date time', B: '2026-08-13T09:30:00.000Z' },
  { A: 'date', B: '2026-08-13T00:00:00.000Z' },
  { A: 'number', B: 3.14 },
  { A: 'boolean', B: true },
  { A: 'formula', B: 5 },
  { A: 'formula text', B: 'spaced' },
  { A: 'after gap', D: 'wide' },
  { A: 'Кириллица' },
  // read-excel-file давал 14:35:26.999 и 1900-01-31: ошибка округления и сдвиг до 1 марта 1900.
  { A: 'seconds', B: '1952-10-11T14:35:27.000Z' },
  { A: 'early 1900 date', B: '1900-02-01T00:00:00.000Z' },
];

describe('spreadsheet cells', () => {
  it('reads XLSX with the cell rules workflows already rely on', async () => {
    const result = await strategy('xlsx')(sample('xlsx'), 'xlsx');

    if (!('sheets' in result)) throw new Error('Expected sheets result');
    expect(Object.keys(result.sheets)).toEqual(['Cells', 'Second', 'Hidden']);
    expect(result.sheets).toEqual({
      Cells: XLSX_CELLS,
      Second: [{ A: 'x' }],
      Hidden: [{ A: 'secret' }],
    });
    expect(result.warning).toBeUndefined();
  });

  it.each(['xls', 'xlsb'] as const)('reads %s into the same sheets, formula errors as text', async (extension) => {
    const result = await strategy(extension)(sample(extension), extension);

    // XLS и XLSB не говорят, что ячейка — ошибка: hucre отдаёт «#DIV/0!» строкой, неотличимой
    // от введённого текста «#N/A». Выбросить такие строки — значит молча потерять настоящий текст.
    const cells = XLSX_CELLS.flatMap((row) => {
      if (row.A === 'formula error') return [{ A: 'formula error', B: '#DIV/0!' }];
      if (row.A === 'error constant') return [{ A: 'error constant', B: '#N/A' }];
      if (row.A === 'after gap') return [{ C: '#DIV/0!' }, row];
      return [row];
    });

    if (!('sheets' in result)) throw new Error('Expected sheets result');
    expect(Object.keys(result.sheets)).toEqual(['Cells', 'Second', 'Hidden']);
    expect(result.sheets).toEqual({
      Cells: cells,
      Second: [{ A: 'x' }],
      Hidden: [{ A: 'secret' }],
    });
    expect(result.warning).toBeUndefined();
  });

  it('reads the workbook the bytes hold when the extension names another spreadsheet format', async () => {
    const fromXls = await strategy('xlsx')(sample('xls'), 'xlsx');
    const fromXlsx = await strategy('xls')(sample('xlsx'), 'xls');
    const fromXlsb = await strategy('xlsx')(sample('xlsb'), 'xlsx');

    for (const result of [fromXls, fromXlsx, fromXlsb]) {
      if (!('sheets' in result)) throw new Error('Expected sheets result');
      expect(result.sheets.Cells[0]).toEqual({ A: 'case', B: 'value' });
    }
  });

  it('rejects bytes that are not a spreadsheet container', async () => {
    const csv = Buffer.from('case,value\npadded text,padded\n', 'utf8');

    await expect(strategy('xlsx')(csv, 'xlsx')).rejects.toThrow(ProcessingError);
    await expect(strategy('xls')(csv, 'xls')).rejects.toThrow(/^XLS processing error/);
  });

  it('names the format in the row limit warning', async () => {
    const result = await strategy('xls')(sample('xls'), 'xls', { maxRows: 1 });

    if (!('sheets' in result)) throw new Error('Expected sheets result');
    expect(result.sheets.Cells).toEqual([{ A: 'case', B: 'value' }]);
    expect(result.sheets.Second).toEqual([{ A: 'x' }]);
    expect(result.warning).toBe('XLS sheets truncated to 1 row(s)');
  });
});
