/**
 * Bounded concurrency runner — cap parallelism on N+1 fan-outs so we don't
 * open hundreds of sockets/requests at once when the dashboard scales to
 * many schools, routes, or trips.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const results = new Array<R>(n);
  const cap = Math.max(1, Math.min(limit, n));
  let cursor = 0;
  const runners = Array.from({ length: cap }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= n) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
