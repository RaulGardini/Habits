/** Web: no device authentication — the app lock is not offered. Keep in sync with `localAuth.ts`. */
export async function canLockApp(): Promise<boolean> {
  return false;
}

export async function authenticate(_promptMessage: string): Promise<boolean> {
  return true;
}
