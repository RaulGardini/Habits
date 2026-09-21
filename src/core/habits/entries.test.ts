import {
  entryFromSheet,
  entryProgress,
  entryWithStatus,
  entryWithValue,
  incrementEntry,
  statusForValue,
  toggleEntry,
} from './entries';
import { makeEntry, makeHabit } from './testing';

const water = makeHabit({ tracking: { type: 'quantity', target: 2, unit: 'L', step: 0.25 } });
const reading = makeHabit({ tracking: { type: 'timer', targetSeconds: 1800 } });

describe('statusForValue', () => {
  it('is done at or above the target, partial below, null at zero', () => {
    expect(statusForValue(water.tracking, 2)).toBe('done');
    expect(statusForValue(water.tracking, 3)).toBe('done');
    expect(statusForValue(water.tracking, 0.5)).toBe('partial');
    expect(statusForValue(water.tracking, 0)).toBeNull();
    expect(statusForValue(reading.tracking, 1800)).toBe('done');
  });
});

describe('entryProgress', () => {
  it('uses value / target for partial entries', () => {
    expect(entryProgress(water, makeEntry({ status: 'partial', value: 0.5 }))).toBe(0.25);
  });

  it('is 1 when done and 0 otherwise', () => {
    expect(entryProgress(water, makeEntry({ status: 'done', value: 2 }))).toBe(1);
    expect(entryProgress(water, makeEntry({ status: 'skipped' }))).toBe(0);
    expect(entryProgress(water, undefined)).toBe(0);
  });
});

describe('incrementEntry', () => {
  it('adds the step and derives the status', () => {
    expect(incrementEntry(water, undefined, 1)).toEqual({
      status: 'partial',
      value: 0.25,
      note: null,
    });
    const almost = makeEntry({ status: 'partial', value: 1.75 });
    expect(incrementEntry(water, almost, 1)).toMatchObject({ status: 'done', value: 2 });
  });

  it('removes the entry when going back to zero', () => {
    expect(incrementEntry(water, makeEntry({ status: 'partial', value: 0.25 }), -1)).toBeNull();
  });

  it('never goes negative', () => {
    expect(incrementEntry(water, undefined, -1)).toBeNull();
  });

  it('avoids floating point drift', () => {
    const e = makeEntry({ status: 'partial', value: 0.1 });
    const tenths = makeHabit({ tracking: { type: 'quantity', target: 1, unit: 'L', step: 0.2 } });
    expect(incrementEntry(tenths, e, 1)?.value).toBe(0.3);
  });
});

describe('entryWithValue', () => {
  it('keeps a note as a missed entry when the value is cleared', () => {
    const e = makeEntry({ status: 'partial', value: 10, note: 'dor de cabeça' });
    expect(entryWithValue(reading, e, 0)).toEqual({
      status: 'missed',
      value: 0,
      note: 'dor de cabeça',
    });
  });
});

describe('toggleEntry', () => {
  it('toggles between done and no entry', () => {
    expect(toggleEntry(undefined)).toEqual({ status: 'done', value: null, note: null });
    expect(toggleEntry(makeEntry({ status: 'done' }))).toBeNull();
  });

  it('marks done from skipped/missed and keeps notes', () => {
    expect(toggleEntry(makeEntry({ status: 'skipped', note: 'viagem' }))).toEqual({
      status: 'done',
      value: null,
      note: 'viagem',
    });
  });

  it('keeps the note when unchecking', () => {
    expect(toggleEntry(makeEntry({ status: 'done', note: 'ok' }))).toEqual({
      status: 'missed',
      value: null,
      note: 'ok',
    });
  });
});

describe('entryWithStatus', () => {
  it('fills the value up to the target when marking done', () => {
    expect(entryWithStatus(water, makeEntry({ status: 'partial', value: 1 }), 'done')).toEqual({
      status: 'done',
      value: 2,
      note: null,
    });
  });

  it('keeps the value when skipping', () => {
    expect(entryWithStatus(water, makeEntry({ status: 'partial', value: 1 }), 'skipped')).toEqual({
      status: 'skipped',
      value: 1,
      note: null,
    });
  });

  it('works for yes/no habits', () => {
    expect(entryWithStatus(makeHabit(), undefined, 'missed')).toEqual({
      status: 'missed',
      value: null,
      note: null,
    });
  });
});

describe('entryFromSheet', () => {
  it('clears the entry', () => {
    expect(entryFromSheet(water, { choice: 'clear', value: 1, note: 'x' })).toBeNull();
  });

  it('derives the status from the value', () => {
    expect(entryFromSheet(water, { choice: 'byValue', value: 1, note: '' })).toEqual({
      status: 'partial',
      value: 1,
      note: null,
    });
    expect(entryFromSheet(reading, { choice: 'byValue', value: 1800, note: ' ótimo ' })).toEqual({
      status: 'done',
      value: 1800,
      note: 'ótimo',
    });
    expect(entryFromSheet(water, { choice: 'byValue', value: 0, note: '' })).toBeNull();
  });

  it('marks done filling the value up to the target', () => {
    expect(entryFromSheet(water, { choice: 'done', value: 0.5, note: '' })).toEqual({
      status: 'done',
      value: 2,
      note: null,
    });
    expect(entryFromSheet(makeHabit(), { choice: 'done', value: NaN, note: 'ok' })).toEqual({
      status: 'done',
      value: null,
      note: 'ok',
    });
  });

  it('skips or marks as not done keeping value and note', () => {
    expect(entryFromSheet(water, { choice: 'skipped', value: 0.5, note: 'viagem' })).toEqual({
      status: 'skipped',
      value: 0.5,
      note: 'viagem',
    });
    expect(entryFromSheet(makeHabit(), { choice: 'missed', value: 3, note: '' })).toEqual({
      status: 'missed',
      value: null,
      note: null,
    });
  });
});
