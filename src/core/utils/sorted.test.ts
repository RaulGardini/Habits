import { countInRange, lowerBound } from './sorted';

const days = ['2026-01-01', '2026-01-03', '2026-01-03', '2026-01-10'];

describe('lowerBound', () => {
  it('finds the first index not below the value', () => {
    expect(lowerBound(days, '2025-12-31')).toBe(0);
    expect(lowerBound(days, '2026-01-03')).toBe(1);
    expect(lowerBound(days, '2026-01-04')).toBe(3);
    expect(lowerBound(days, '2026-02-01')).toBe(4);
    expect(lowerBound([], '2026-01-01')).toBe(0);
  });
});

describe('countInRange', () => {
  it('counts inclusive ranges, duplicates included', () => {
    expect(countInRange(days, '2026-01-01', '2026-01-03')).toBe(3);
    expect(countInRange(days, '2026-01-04', '2026-01-09')).toBe(0);
    expect(countInRange(days, '2026-01-10', '2026-01-10')).toBe(1);
    expect(countInRange(days, '2026-01-10', '2026-01-01')).toBe(0);
  });
});
