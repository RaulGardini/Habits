import type { Database } from '@/db/client';

import type { Repositories } from '../types';
import { createDrizzleEntryRepository } from './entryRepository';
import { createDrizzleHabitRepository } from './habitRepository';
import { createDrizzleSettingsRepository } from './settingsRepository';

export function createDrizzleRepositories(db: Database): Repositories {
  return {
    habits: createDrizzleHabitRepository(db),
    entries: createDrizzleEntryRepository(db),
    settings: createDrizzleSettingsRepository(db),
  };
}
