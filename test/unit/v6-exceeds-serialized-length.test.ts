import { exceedsSerializedLength } from '../../src/pipeline/v6';

/**
 * Property test: for a variety of "sheets" shapes, `exceedsSerializedLength(sheets, limit)`
 * must agree with the reference `JSON.stringify(sheets).length > limit` for every limit
 * from 0 up to (real length + 2), i.e. straddling the exact boundary from both sides.
 *
 * This directly guards the bug found in review: the length accumulator previously added
 * array brackets before confirming the value was actually an array, and did not account
 * for JSON.stringify dropping `undefined`/function/symbol object properties entirely.
 */
describe('exceedsSerializedLength property test', () => {
  const datasets: Record<string, Record<string, unknown>> = {
    'non-array sheet value (object instead of array)': { S: { A: 1 } },
    'undefined sheet value (property JSON.stringify drops)': { S: undefined },
    'empty object': {},
    'empty sheets record with only omitted properties': { S: undefined, T: undefined },
    'single empty array': { S: [] },
    'nested arrays and objects': { S: [{ A: { nested: [1, 2, 3] } }] },
    'quotes and newlines inside strings': { S: [{ A: 'hello "world"\nline two\tindented' }] },
    'unicode content': { S: [{ A: 'юникод 😀 текст' }] },
    'multiple sheets': {
      Sheet1: [{ A: 1 }, { A: 2 }],
      Sheet2: [{ B: 'x' }],
    },
    'row with undefined cell inside array (becomes null)': { S: [[1, undefined, 3]] },
    'row with function/symbol values dropped from object': {
      S: [{ A: 1, fn: () => 1, sym: Symbol('x'), B: 2 }],
    },
    'array containing function (becomes null)': { S: [[1, () => 1, 3]] },
    'null values': { S: [{ A: null, B: null }] },
    'boolean values': { S: [{ A: true, B: false }] },
    'non-finite numbers (NaN/Infinity become null)': { S: [{ A: NaN, B: Infinity, C: -Infinity }] },
    'date value': { S: [{ A: new Date('2024-01-15T12:00:00.000Z') }] },
    'deeply nested structure': {
      S: [{ A: { B: { C: { D: [1, 2, { E: 'deep' }] } } } }],
    },
  };

  for (const [name, sheets] of Object.entries(datasets)) {
    it(`matches JSON.stringify(sheets).length > limit for every limit around the boundary — ${name}`, () => {
      const real = JSON.stringify(sheets).length;
      for (let limit = 0; limit <= real + 2; limit++) {
        const expected = real > limit;
        const actual = exceedsSerializedLength(sheets, limit);
        expect(actual).toBe(expected);
      }
    });
  }
});
