import type { Repositories } from './types';

export type * from './types';

let current: Repositories | null = null;

/** Called once at startup (after migrations) and by tests with fakes. */
export function setRepositories(repositories: Repositories): void {
  current = repositories;
}

export function getRepositories(): Repositories {
  if (!current) throw new Error('Repositories not initialized. Call setRepositories() first.');
  return current;
}
