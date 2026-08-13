/**
 * Regression tests for the xlsx strategy row limit:
 *  - once maxRows is reached, traversal must not keep building rowData objects
 *    for every remaining row in the sheet;
 *  - the truncation warning must only fire when a row past the limit actually
 *    held data — a trailing run of fully empty rows must not be reported as
 *    truncated (matches the pre-optimization behavior).
 */

const callLog: number[] = [];

function makeRow(value: unknown, index: number) {
  return {
    forEach(callback: (cell: unknown, colIndex: number) => void) {
      callLog.push(index);
      callback(value, 0);
    },
  };
}

jest.mock('read-excel-file/node', () => jest.fn());

import readXlsxFile from 'read-excel-file/node';
import { strategies } from '../../src/strategies';

describe('xlsx strategy maxRows early stop', () => {
  beforeEach(() => {
    callLog.length = 0;
    jest.mocked(readXlsxFile).mockReset();
  });

  it('stops scanning as soon as a non-empty row past the limit confirms truncation', async () => {
    // Rows 0 and 1 fill the limit; row 2 is the first excess row and holds data,
    // so it must be visited once (cheap check, no rowData built) to confirm
    // truncation, then the loop must stop — rows 3 and 4 are never visited.
    const rows = [0, 1, 2, 3, 4].map((i) => makeRow(`value-${i}`, i));
    jest.mocked(readXlsxFile).mockResolvedValue([
      { sheet: 'Sheet1', data: rows as never },
    ] as never);

    const result = await strategies.xlsx(Buffer.from(''), 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBe('XLSX sheets truncated to 2 row(s)');
    expect(callLog).toEqual([0, 1, 2]);
  });

  it('does not report truncation when every row past the limit is empty', async () => {
    // Rows 0 and 1 fill the limit; rows 2-4 exist in the sheet but every cell
    // is empty, so no data is actually dropped and no warning should appear.
    const rows = [
      makeRow('value-0', 0),
      makeRow('value-1', 1),
      makeRow(null, 2),
      makeRow(undefined, 3),
      makeRow(null, 4),
    ];
    jest.mocked(readXlsxFile).mockResolvedValue([
      { sheet: 'Sheet1', data: rows as never },
    ] as never);

    const result = await strategies.xlsx(Buffer.from(''), 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBeUndefined();
    // Every trailing empty row still had to be checked (cheaply) to be sure
    // none of them held data.
    expect(callLog).toEqual([0, 1, 2, 3, 4]);
  });

  it('reports truncation once a non-empty row appears after a run of empty ones', async () => {
    const rows = [
      makeRow('value-0', 0),
      makeRow('value-1', 1),
      makeRow(null, 2),
      makeRow('value-3', 3),
      makeRow('value-4', 4),
    ];
    jest.mocked(readXlsxFile).mockResolvedValue([
      { sheet: 'Sheet1', data: rows as never },
    ] as never);

    const result = await strategies.xlsx(Buffer.from(''), 'xlsx', { maxRows: 2 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(2);
    expect(result.warning).toBe('XLSX sheets truncated to 2 row(s)');
    // Row 2 (empty) is checked and skipped, row 3 (non-empty) confirms
    // truncation and stops the scan — row 4 is never visited.
    expect(callLog).toEqual([0, 1, 2, 3]);
  });

  it('processes every row when maxRows is 0 (unlimited)', async () => {
    const rows = [0, 1, 2].map((i) => makeRow(`value-${i}`, i));
    jest.mocked(readXlsxFile).mockResolvedValue([
      { sheet: 'Sheet1', data: rows as never },
    ] as never);

    const result = await strategies.xlsx(Buffer.from(''), 'xlsx', { maxRows: 0 });

    if (!('sheets' in result) || !result.sheets) throw new Error('Expected sheets result');
    expect(result.sheets.Sheet1).toHaveLength(3);
    expect(result.warning).toBeUndefined();
    expect(callLog).toEqual([0, 1, 2]);
  });
});
