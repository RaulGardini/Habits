import { t } from '@/i18n/i18n';

/** Rules for account e-mail/passwords, sign-in throttling and e-mail links. Pure. */

export const MIN_PASSWORD_LENGTH = 8;
/** Supabase (bcrypt) ignores anything past 72 bytes. */
export const MAX_PASSWORD_LENGTH = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  return EMAIL_PATTERN.test(email.trim()) ? null : t('Informe um e-mail válido.');
}

/** Sign-in: only the shape (older accounts may have passwords from looser rules). */
export function validateSignIn(email: string, password: string): string | null {
  return validateEmail(email) ?? (password ? null : t('Informe a senha.'));
}

/** A new password (sign-up, reset). Leaked passwords are checked separately (`isPwned`). */
export function validateNewPassword(password: string, email = ''): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return t('A senha precisa ter pelo menos {count} caracteres.', { count: MIN_PASSWORD_LENGTH });
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return t('A senha pode ter no máximo {count} caracteres.', { count: MAX_PASSWORD_LENGTH });
  }
  if (new Set(password).size < 4) return t('Use uma senha menos repetitiva.');
  const name = email.trim().toLowerCase().split('@')[0] ?? '';
  if (name.length >= 4 && password.toLowerCase().includes(name)) {
    return t('A senha não pode conter o seu e-mail.');
  }
  return null;
}

/**
 * Wait before the next sign-in attempt after `failures` wrong passwords in a row: free for
 * the first 3, then 30 s, 1 min, 2 min… up to 15 min. The server has its own limits too.
 */
export function signInCooldownMs(failures: number): number {
  if (failures < 3) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (failures - 3));
}

/** Minimum interval between e-mails the app asks the server to send (confirmation, reset). */
export const EMAIL_COOLDOWN_MS = 60_000;

/** "Muitas tentativas. Tente de novo em 1 min 30 s." */
export function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const time =
    minutes > 0 ? (rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`) : `${rest} s`;
  return t('Muitas tentativas. Tente de novo em {time}.', { time });
}

export interface AuthCallback {
  /** One-time PKCE code to exchange for a session. */
  code: string | null;
  /** What the link was for: `reset` (password) or `confirm` (new account). */
  next: 'reset' | 'confirm';
  /** Friendly message when the link is invalid/expired. */
  error: string | null;
}

/** Reads an auth e-mail link as it reaches the app (errors may come in the query or the hash). */
export function parseAuthCallback(url: string): AuthCallback {
  const [beforeHash = '', hash = ''] = url.split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const errorCode = params.get('error_code') ?? params.get('error');
  return {
    code: params.get('code'),
    next: params.get('next') === 'reset' ? 'reset' : 'confirm',
    error: errorCode ? authLinkError(errorCode) : null,
  };
}

/** Friendly message for an error code (from the link, or from exchanging its code). */
export function authLinkError(code: string): string {
  if (/otp_expired|access_denied|expired/i.test(code)) {
    return t('Este link expirou ou já foi usado. Peça um novo.');
  }
  if (/flow.?state|code.?verifier|pkce/i.test(code)) {
    return t('Abra o link no mesmo aparelho em que você fez o pedido.');
  }
  return t('Não foi possível validar o link. Peça um novo.');
}

/**
 * HaveIBeenPwned "range" answer (k-anonymity: only the first 5 hex chars of the SHA-1 were
 * sent): does it list our hash suffix with at least one breach? Padding lines have count 0.
 */
export function isSuffixInRange(rangeText: string, suffix: string): boolean {
  const wanted = suffix.toUpperCase();
  return rangeText.split('\n').some((line) => {
    const [hashSuffix, count] = line.trim().split(':');
    return hashSuffix === wanted && Number(count) > 0;
  });
}
