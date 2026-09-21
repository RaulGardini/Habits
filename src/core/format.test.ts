import { formatClock, formatDuration, formatNumber, formatPercent, parseDecimal } from './format';

describe('formatNumber', () => {
  it('uses a comma and at most 2 decimals', () => {
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(10)).toBe('10');
    expect(formatNumber(0.3333)).toBe('0,33');
  });
});

describe('parseDecimal', () => {
  it.each([
    ['2,5', 2.5],
    ['2.5', 2.5],
    [' 10 ', 10],
    [',5', 0.5],
  ])('parses %s', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['', 'abc', '1,2,3', '-1'])('rejects "%s"', (text) => {
    expect(parseDecimal(text)).toBeNaN();
  });
});

describe('formatDuration', () => {
  it.each([
    [45, '45 s'],
    [60, '1 min'],
    [1800, '30 min'],
    [3600, '1 h'],
    [3900, '1 h 5 min'],
  ])('%i s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('formatClock', () => {
  it('pads minutes and seconds', () => {
    expect(formatClock(309)).toBe('05:09');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent', () => {
    expect(formatPercent(0.756)).toBe('76%');
  });
});
