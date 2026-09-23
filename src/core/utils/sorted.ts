/** First index in the ascending `items` whose value is ≥ `value` (binary search). */
export function lowerBound(items: readonly string[], value: string): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((items[mid] ?? '') < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** How many of the ascending `items` fall in the inclusive range [from, to]. */
export function countInRange(items: readonly string[], from: string, to: string): number {
  return Math.max(0, lowerBound(items, `${to}￿`) - lowerBound(items, from));
}
