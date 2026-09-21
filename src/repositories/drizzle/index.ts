import type { Database } from '@/db/client';

import type { Repositories } from '../types';
import { createDrizzleBackupRepository } from './backupRepository';
import { createDrizzleEntryRepository } from './entryRepository';
import { createDrizzleHabitRepository } from './habitRepository';
import {
  createDrizzleDayNoteRepository,
  createDrizzleEventRepository,
  createDrizzleGoalRepository,
  createDrizzleTaskRepository,
} from './plannerRepositories';
import { createDrizzleSettingsRepository } from './settingsRepository';

export function createDrizzleRepositories(db: Database): Repositories {
  return {
    habits: createDrizzleHabitRepository(db),
    entries: createDrizzleEntryRepository(db),
    settings: createDrizzleSettingsRepository(db),
    tasks: createDrizzleTaskRepository(db),
    events: createDrizzleEventRepository(db),
    dayNotes: createDrizzleDayNoteRepository(db),
    goals: createDrizzleGoalRepository(db),
    backup: createDrizzleBackupRepository(db),
  };
}
