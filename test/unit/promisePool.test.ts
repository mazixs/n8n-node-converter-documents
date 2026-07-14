import { promisePool } from '../../src/utils/promisePool';

describe('promisePool', () => {
  it('preserves input order while respecting the concurrency limit', async () => {
    const active = new Set<number>();
    let peakConcurrency = 0;

    const result = await promisePool([30, 5, 15, 1], async (delay, index) => {
      active.add(index);
      peakConcurrency = Math.max(peakConcurrency, active.size);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active.delete(index);
      return index;
    }, 2);

    expect(result).toEqual([0, 1, 2, 3]);
    expect(peakConcurrency).toBe(2);
  });

  it('returns an empty result for an empty input', async () => {
    await expect(promisePool([], async () => 'unused', 3)).resolves.toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid concurrency %s',
    async (concurrency) => {
      await expect(promisePool([1], async (value) => value, concurrency))
        .rejects.toThrow('Concurrency must be a positive integer');
    },
  );

  it('propagates worker failures', async () => {
    await expect(promisePool([1, 2, 3], async (value) => {
      if (value === 2) throw new Error('worker failed');
      return value;
    }, 2)).rejects.toThrow('worker failed');
  });
});
