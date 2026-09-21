export type MoveDirection = 'up' | 'down';

/**
 * Moves `id` one position up or down. Returns a copy of `ids` unchanged when the
 * move is not possible (unknown id or already at the edge).
 */
export function moveItem<T>(ids: readonly T[], id: T, direction: MoveDirection): T[] {
  const next = [...ids];
  const from = ids.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return next;
  next[from] = ids[to] as T;
  next[to] = id;
  return next;
}
