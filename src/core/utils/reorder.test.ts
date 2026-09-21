import { moveItem } from './reorder';

describe('moveItem', () => {
  const ids = ['a', 'b', 'c'];

  it('moves an item up', () => {
    expect(moveItem(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(moveItem(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('keeps order at the edges', () => {
    expect(moveItem(ids, 'a', 'up')).toEqual(ids);
    expect(moveItem(ids, 'c', 'down')).toEqual(ids);
  });

  it('keeps order for unknown ids', () => {
    expect(moveItem(ids, 'z', 'up')).toEqual(ids);
  });

  it('does not mutate the input', () => {
    moveItem(ids, 'b', 'up');
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
