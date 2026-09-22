import { getRepositories, setRepositories, type Repositories } from '@/repositories';
import { createDrizzleRepositories } from '@/repositories/drizzle';

import { openDatabase } from './client';

let initializing: Promise<Repositories> | null = null;

/**
 * Opens the database (running migrations) and registers the repositories — once per JS context.
 * Shared by the app bootstrap and the Android widget headless task, which may start together.
 */
export function initRepositories(): Promise<Repositories> {
  initializing ??= openDatabase().then((db) => {
    setRepositories(createDrizzleRepositories(db));
    return getRepositories();
  });
  initializing.catch(() => {
    initializing = null; // allow a retry after a failure
  });
  return initializing;
}
