import type { BackupRow, BackupTable } from '@/core/backup/backup';
import { addDaysLocal, weekdayOf, type LocalDate } from '@/core/dates/localDate';
import { daysBetween } from '@/core/dates/periods';

/**
 * Realistic, deterministic bulk data for load tests (and manual testing on a dev build):
 * by default 40 habits over 3 years ≈ 45k `habit_entries`, plus tasks, events, day notes,
 * goals and reminders. Rows use the backup format (camelCase columns), so they can be inserted
 * directly or through `backup.importMerge`.
 */
export interface SeedOptions {
  /** Last day with data (inclusive). */
  today: LocalDate;
  habits?: number;
  years?: number;
  /** PRNG seed: the same options always produce the same rows. */
  seed?: number;
}

/** mulberry32: tiny deterministic PRNG. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['violet', 'blue', 'green', 'orange', 'pink', 'teal', 'red', 'yellow'];
const ICONS = ['cup-water', 'run', 'book-open-variant', 'meditation', 'bed', 'food-apple'];
const TIMES = ['morning', 'afternoon', 'evening', 'anytime'] as const;

type HabitKind =
  | { frequency: 'daily' }
  | { frequency: 'weekdays'; days: number }
  | { frequency: 'per_period'; count: number; period: 'week' | 'month' }
  | { frequency: 'interval'; every: number };

/** Mix of frequencies: mostly daily, some specific weekdays, flexible and "every X days". */
function habitKind(index: number): HabitKind {
  switch (index % 20) {
    case 7:
      return { frequency: 'weekdays', days: 0b0111110 }; // Mon–Fri
    case 8:
      return { frequency: 'per_period', count: 3, period: 'week' };
    case 18:
      return { frequency: 'per_period', count: 10, period: 'month' };
    case 9:
      return { frequency: 'interval', every: 2 };
    default:
      return { frequency: 'daily' };
  }
}

const iso = (date: LocalDate, hour: number) =>
  `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;

export function generateSeedData({
  today,
  habits: habitCount = 40,
  years = 3,
  seed = 42,
}: SeedOptions): Record<BackupTable, BackupRow[]> {
  const rand = random(seed);
  const start = addDaysLocal(today, -Math.round(365 * years) + 1);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;

  const tables: Record<BackupTable, BackupRow[]> = {
    habits: [],
    habitReminders: [],
    habitEntries: [],
    tasks: [],
    events: [],
    dayNotes: [],
    goals: [],
    settings: [],
  };

  for (let i = 0; i < habitCount; i++) {
    const id = `seed-habit-${i}`;
    const kind = habitKind(i);
    const tracking = i % 5 === 3 ? 'quantity' : i % 10 === 4 ? 'timer' : 'boolean';
    const target = tracking === 'quantity' ? 8 : tracking === 'timer' ? 1200 : null;
    // A few habits started later, and one was archived six months ago.
    const habitStart = i % 20 === 5 ? addDaysLocal(start, 180 + i * 7) : start;
    const archivedOn = i === habitCount - 1 ? addDaysLocal(today, -180) : null;
    const created = iso(habitStart, 8);

    tables.habits.push({
      id,
      name: `Hábito ${i + 1}`,
      icon: pick(ICONS),
      color: pick(COLORS),
      timeOfDay: TIMES[i % TIMES.length],
      frequencyType: kind.frequency,
      frequencyWeekdays: kind.frequency === 'weekdays' ? kind.days : null,
      frequencyCount: kind.frequency === 'per_period' ? kind.count : null,
      frequencyPeriod: kind.frequency === 'per_period' ? kind.period : null,
      frequencyInterval: kind.frequency === 'interval' ? kind.every : null,
      trackingType: tracking,
      targetValue: target,
      unit: tracking === 'quantity' ? 'copos' : null,
      quantityStep: tracking === 'quantity' ? 1 : null,
      startDate: habitStart,
      archivedAt: archivedOn ? iso(archivedOn, 12) : null,
      sortOrder: i,
      goalId: null,
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
    });
    if (i % 4 === 0) {
      tables.habitReminders.push({
        id: `seed-reminder-${i}`,
        habitId: id,
        time: `${String(7 + (i % 12)).padStart(2, '0')}:30`,
        weekdays: null,
        createdAt: created,
        updatedAt: created,
        deletedAt: null,
      });
    }

    const end = archivedOn ?? today;
    const consistency = 0.6 + rand() * 0.35;
    for (let date = habitStart; date <= end; date = addDaysLocal(date, 1)) {
      if (kind.frequency === 'weekdays' && !((kind.days >> weekdayOf(date)) & 1)) continue;
      if (kind.frequency === 'interval' && daysBetween(habitStart, date) % kind.every !== 0) {
        continue;
      }
      if (kind.frequency === 'per_period' && rand() > 0.7) continue;
      const roll = rand();
      const status = roll < consistency ? 'done' : roll < consistency + 0.05 ? 'skipped' : 'missed';
      const value =
        target === null ? null : status === 'done' ? target : Math.floor(rand() * target * 0.8);
      tables.habitEntries.push({
        id: `seed-entry-${i}-${date}`,
        habitId: id,
        date,
        status: status === 'missed' && value ? 'partial' : status,
        value,
        note: rand() < 0.03 ? 'Anotação do dia' : null,
        createdAt: iso(date, 20),
        updatedAt: iso(date, 20),
        deletedAt: null,
      });
    }
  }

  const totalDays = daysBetween(start, today) + 1;
  for (let d = 0; d < totalDays; d++) {
    const date = addDaysLocal(start, d);
    const stamp = iso(date, 9);
    // ~4 tasks a day.
    const taskCount = Math.floor(rand() * 7);
    for (let n = 0; n < taskCount; n++) {
      tables.tasks.push({
        id: `seed-task-${date}-${n}`,
        title: `Tarefa ${n + 1}`,
        date,
        priority: pick(['low', 'normal', 'high'] as const),
        completedAt: date < today && rand() < 0.85 ? iso(date, 18) : null,
        rolledFrom: null,
        sortOrder: n,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
    }
    // ~2 one-off events a week.
    if (rand() < 0.3) {
      const hour = 8 + Math.floor(rand() * 10);
      tables.events.push({
        id: `seed-event-${date}`,
        title: 'Compromisso',
        date,
        startTime: `${String(hour).padStart(2, '0')}:00`,
        endTime: `${String(hour + 1).padStart(2, '0')}:00`,
        color: pick(COLORS),
        note: null,
        allDay: 0,
        location: rand() < 0.3 ? 'Centro' : null,
        repeat: 'none',
        repeatUntil: null,
        excludedDates: '',
        reminderMinutes: rand() < 0.5 ? 15 : null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
    }
    // A journal note every other day.
    if (rand() < 0.5) {
      tables.dayNotes.push({
        id: `seed-note-${date}`,
        date,
        content: 'Hoje foi um dia produtivo. '.repeat(1 + Math.floor(rand() * 8)).trim(),
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
    }
    if (date.endsWith('-01')) {
      tables.goals.push({
        id: `seed-goal-${date}`,
        title: 'Meta do mês',
        scope: 'month',
        period: date.slice(0, 7),
        target: 20,
        unit: null,
        current: Math.floor(rand() * 20),
        habitId: rand() < 0.5 ? 'seed-habit-0' : null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
    }
  }

  // Recurring series (weekly meetings, birthdays…).
  for (let n = 0; n < 12; n++) {
    const date = addDaysLocal(start, n * 30);
    tables.events.push({
      id: `seed-series-${n}`,
      title: `Série ${n + 1}`,
      date,
      startTime: '19:00',
      endTime: '20:00',
      color: pick(COLORS),
      note: null,
      allDay: n % 4 === 0 ? 1 : 0,
      location: null,
      repeat: (['daily', 'weekly', 'monthly', 'yearly'] as const)[n % 4],
      repeatUntil: n % 3 === 0 ? addDaysLocal(date, 200) : null,
      excludedDates: '',
      reminderMinutes: 30,
      createdAt: iso(date, 9),
      updatedAt: iso(date, 9),
      deletedAt: null,
    });
  }

  return tables;
}
