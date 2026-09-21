import { randomUUID } from 'expo-crypto';

export function newId(): string {
  return randomUUID();
}

/** Current instant as an ISO-8601 UTC string (for created_at / updated_at / deleted_at). */
export function nowIso(): string {
  return new Date().toISOString();
}
