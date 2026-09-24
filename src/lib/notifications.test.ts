import { makeHabit } from '@/core/habits/testing';

import { syncReminders } from './notifications';

/** In-memory stand-in for the OS notification center. */
const mockCenter = new Map<string, { trigger: { type: string; weekday?: number } }>();
const mockCalls: string[] = [];
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
  getPermissionsAsync: async () => ({ status: 'granted' }),
  getAllScheduledNotificationsAsync: async () =>
    [...mockCenter.keys()].map((identifier) => ({ identifier })),
  cancelScheduledNotificationAsync: async (id: string) => {
    mockCalls.push(`cancel ${id}`);
    mockCenter.delete(id);
  },
  scheduleNotificationAsync: async ({
    identifier,
    trigger,
  }: {
    identifier: string;
    trigger: { type: string };
  }) => {
    mockCalls.push(`add ${trigger.type}`);
    mockCenter.set(identifier, { trigger });
    return identifier;
  },
}));

const read = makeHabit({ id: 'read', reminders: ['23:58'] });
const walk = makeHabit({ id: 'walk', reminders: ['23:59'] });

beforeEach(() => {
  mockCenter.clear();
  mockCalls.length = 0;
  jest.useFakeTimers({
    now: new Date(2026, 8, 21, 10, 0),
    doNotFake: ['nextTick', 'setImmediate'],
  });
});

afterEach(() => jest.useRealTimers());

it("checking a habit first cancels today's reminder, and touches nothing else", async () => {
  await syncReminders([read, walk]);
  expect([...mockCenter.values()].map((n) => n.trigger.type)).toEqual(['daily', 'daily']);
  mockCalls.length = 0;

  await syncReminders([read, walk], [], new Set(['read']));
  expect(mockCalls[0]).toMatch(/^cancel /); // the reminder that must not fire goes first
  expect(mockCalls.filter((call) => call.startsWith('cancel'))).toHaveLength(1);
  const types = [...mockCenter.values()].map((n) => n.trigger.type);
  expect(types.filter((type) => type === 'daily')).toHaveLength(1); // walk's, untouched
  expect(types.filter((type) => type === 'weekly')).toHaveLength(6); // read, other weekdays

  // Re-planning again with nothing new makes no call at all.
  mockCalls.length = 0;
  await syncReminders([read, walk], [], new Set(['read']));
  expect(mockCalls).toEqual([]);
});
