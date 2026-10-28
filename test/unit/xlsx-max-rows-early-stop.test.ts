/**
 * Regression tests for the spreadsheet row limit:
 *  - once maxRows is reached, traversal must not keep building rowData objects
 *    for every remaining row in the sheet;
 *  - the truncation warning must only fire when a row past the limit actually
 *    held data — a trailing run of rows the output would drop (empty, blank
 *    text, formula errors) must not be reported as truncated.
 */

import type { CellValue, ReadOptions, ReadWarning, Workbook } from 'hucre';

jest.mock('hucre', () => ({ read: jest.fn() }));

import { read } from 'hucre';
import { strategies } from '../../src/strategies';

const ZIP = Buffer.from('504b030414000000', 'hex');
const visited: number[] = [];

function trackedRows(rows: CellValue[][]): CellValue[][] {
  return new Proxy(rows, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) visited.push(Number(property));
      return Reflect.get(target, property, receiver);
    },
  });
}

function workbook(rows: CellValue[][], cells?: Workbook['sheets'][number]['cells']): Workbook {
  return { sheets: [{ name: 'Sheet1', rows: trackedRows(rows), cells }] };
}

describe('xlsx strategy maxRows early stop', () => {
  beforeEach(() => {
    visited.length = 0;
    jest.mocked(read).mockReset();
  });

  it('stops scanning as soon as a non-empty row past the limit confirms truncation', async () => {
    // Rows 0 and 1 fill the limit; row 2 is the first excess row and holds data,
    // so it must be visited once (cheap check, no rowData built) to confirm
    // truncation, then the loop must stop — rows 3 and 4 are never visited.
    jest.mocked(read).mockResolvedValue(workbook([0, 1, 2, 3, 4].map((i) => [`value-${i}`])));

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBe('XLSX sheets truncated to 2 row(s)');
    expect(visited).toEqual([0, 1, 2]);
  });

  it('does not report truncation when every row past the limit is empty', async () => {
    // Rows 0 and 1 fill the limit; rows 2-4 exist in the sheet but every cell
    // is empty, so no data is actually dropped and no warning should appear.
    jest.mocked(read).mockResolvedValue(workbook([['value-0'], ['value-1'], [null], [null], [null]]));

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBeUndefined();
    // Every trailing empty row still had to be checked (cheaply) to be sure
    // none of them held data.
    expect(visited).toEqual([0, 1, 2, 3, 4]);
  });

  it('does not count blank text or formula errors past the limit as data', async () => {
    jest.mocked(read).mockResolvedValue(workbook(
      [['value-0'], ['value-1'], ['   '], ['#DIV/0!']],
      new Map([['3,0', { value: '#DIV/0!', type: 'error' }]]),
    ));

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toEqual([{ A: 'value-0' }, { A: 'value-1' }]);
    expect(result.warning).toBeUndefined();
  });

  it('reports truncation once a non-empty row appears after a run of empty ones', async () => {
    jest.mocked(read).mockResolvedValue(workbook([['value-0'], ['value-1'], [null], ['value-3'], ['value-4']]));

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBe('XLSX sheets truncated to 2 row(s)');
    // Row 2 (empty) is checked and skipped, row 3 (non-empty) confirms
    // truncation and stops the scan — row 4 is never visited.
    expect(visited).toEqual([0, 1, 2, 3]);
  });

  it('processes every row when maxRows is 0 (unlimited)', async () => {
    jest.mocked(read).mockResolvedValue(workbook([0, 1, 2].map((i) => [`value-${i}`])));

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 0 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(3);
    expect(result.warning).toBeUndefined();
    expect(visited).toEqual([0, 1, 2]);
  });

  it('leaves out chart sheets, which hold no cells', async () => {
    jest.mocked(read).mockResolvedValue({
      sheets: [
        { name: 'Data', rows: [['value-0']] },
        { name: 'Chart1', rows: [], kind: 'chartsheet' },
      ],
    });

    const result = await strategies.xlsx(ZIP, 'xlsx');

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets).toEqual({ Data: [{ A: 'value-0' }] });
  });

  it('passes on what the reader could not read, once per kind of problem', async () => {
    const lost = (code: ReadWarning['code'], message: string): ReadWarning => ({ code, message, sheet: 'Sheet1' });
    jest.mocked(read).mockImplementation(async (_input, options?: ReadOptions) => {
      options?.onWarning?.(lost('unresolved-shared-string', 'Cell A1 points at shared string 7. Read as empty.'));
      options?.onWarning?.(lost('unresolved-shared-string', 'Cell A2 points at shared string 8. Read as empty.'));
      options?.onWarning?.(lost('unresolved-shared-string', 'Cell A3 points at shared string 9. Read as empty.'));
      // Гиперссылки и параметры печати в вывод не попадают, их потеря пользователя не касается.
      options?.onWarning?.(lost('unresolved-hyperlink', 'Hyperlink rId4 is missing.'));
      options?.onWarning?.(lost('malformed-cell-ref', 'Cell reference "A0" is malformed; cell skipped.'));
      return workbook([['value-0'], ['value-1']]);
    });

    const result = await strategies.xlsx(ZIP, 'xlsx', { maxRows: 1 });

    expect(result.warning).toBe(
      'XLSX sheets truncated to 1 row(s); ' +
      'unresolved-shared-string: Cell A1 points at shared string 7. Read as empty. (+2 more); ' +
      'malformed-cell-ref: Cell reference "A0" is malformed; cell skipped.',
    );
  });
});
