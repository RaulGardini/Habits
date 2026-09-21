import { eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { settings } from '@/db/schema';
import { nowIso } from '@/lib/id';

import type { SettingsRepository } from '../types';

export function createDrizzleSettingsRepository(db: Database): SettingsRepository {
  return {
    async get<T>(key: string) {
      const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
      return row ? (JSON.parse(row.value) as T) : null;
    },

    async set<T>(key: string, value: T) {
      const now = nowIso();
      const encoded = JSON.stringify(value);
      await db
        .insert(settings)
        .values({ key, value: encoded, updatedAt: now })
        .onConflictDoUpdate({ target: settings.key, set: { value: encoded, updatedAt: now } });
    },
  };
}
