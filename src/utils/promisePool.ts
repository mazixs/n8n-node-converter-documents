/**
 * Promise pool для ограничения количества одновременных задач
 * Использует Set вместо Array для корректного удаления (fix race condition)
 */
export async function promisePool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const executing = new Set<Promise<void>>();

  async function enqueue() {
    if (i >= items.length) return;
    const currentIndex = i++;
    const p = worker(items[currentIndex], currentIndex).then((res) => {
      results[currentIndex] = res;
    });
    const wrapped = p.then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);
    if (executing.size < concurrency) {
      await enqueue();
    } else {
      await Promise.race(executing);
      await enqueue();
    }
  }
  await enqueue();
  await Promise.all(executing);
  return results;
}
