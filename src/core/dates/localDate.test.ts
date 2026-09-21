import {
  addDaysLocal,
  formatDayLabel,
  formatShortDate,
  isLocalDate,
  parseLocalDate,
  toLocalDate,
  todayLocal,
  weekdayOf,
} from './localDate';

describe('toLocalDate', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local time must still be the same local day.
    expect(toLocalDate(new Date(2026, 8, 21, 23, 30))).toBe('2026-09-21');
    expect(toLocalDate(new Date(2026, 8, 21, 0, 5))).toBe('2026-09-21');
  });

  it('pads month and day', () => {
    expect(toLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('todayLocal uses the injected clock', () => {
    expect(todayLocal(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });
});

describe('isLocalDate', () => {
  it.each(['2026-09-21', '2024-02-29'])('accepts %s', (value) => {
    expect(isLocalDate(value)).toBe(true);
  });

  it.each(['2026-9-21', '2026-02-30', '2025-02-29', '21/09/2026', '', '2026-09-21T00:00'])(
    'rejects %s',
    (value) => {
      expect(isLocalDate(value)).toBe(false);
    },
  );
});

describe('parseLocalDate', () => {
  it('returns local midnight', () => {
    const date = parseLocalDate('2026-09-21');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 8, 21, 0,
    ]);
  });

  it('throws on invalid input', () => {
    expect(() => parseLocalDate('2026-13-01')).toThrow('Invalid local date');
  });
});

describe('addDaysLocal', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysLocal('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysLocal('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysLocal('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysLocal('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('handles zero and large offsets', () => {
    expect(addDaysLocal('2026-09-21', 0)).toBe('2026-09-21');
    expect(addDaysLocal('2026-01-01', 365)).toBe('2027-01-01');
  });
});

describe('weekdayOf', () => {
  it('returns 0 for Sunday and 1 for Monday', () => {
    expect(weekdayOf('2026-09-20')).toBe(0);
    expect(weekdayOf('2026-09-21')).toBe(1);
  });
});

describe('formatDayLabel', () => {
  const today = '2026-09-21';

  it('uses relative labels around today', () => {
    expect(formatDayLabel('2026-09-21', today)).toBe('Hoje');
    expect(formatDayLabel('2026-09-20', today)).toBe('Ontem');
    expect(formatDayLabel('2026-09-22', today)).toBe('Amanhã');
  });

  it('uses the pt-BR weekday and month otherwise', () => {
    expect(formatDayLabel('2026-09-15', today)).toBe('terça-feira, 15 de setembro');
  });

  it('includes the year when it differs', () => {
    expect(formatDayLabel('2025-12-25', today)).toBe('quinta-feira, 25 de dezembro de 2025');
  });
});

describe('formatShortDate', () => {
  it('formats in pt-BR', () => {
    expect(formatShortDate('2026-09-21')).toBe('21 de set de 2026');
  });
});
