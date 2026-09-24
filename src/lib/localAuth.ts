import * as LocalAuthentication from 'expo-local-authentication';

import { t } from '@/i18n/i18n';

/**
 * Device authentication for the app lock: Face ID / fingerprint, falling back to the device
 * passcode. (Face ID needs a development/store build; in Expo Go iOS uses the passcode.)
 * Web has no equivalent: see `localAuth.web.ts`.
 */

/** Can this device protect the app (biometrics or at least a passcode)? */
export async function canLockApp(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Asks the user to authenticate. True when they did. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: t('Cancelar'),
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
