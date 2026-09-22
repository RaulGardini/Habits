import { getLanguage, t } from '@/i18n/i18n';

/** Up to 2 decimals, no trailing zeros; the separator follows the language ("2,5" / "2.5"). */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = String(rounded);
  return getLanguage() === 'en' ? text : text.replace('.', ',');
}

/** Parses "2,5" or "2.5". Returns NaN when invalid or empty. */
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(normalized)) return NaN;
  return Number(normalized);
}

/** Human duration: "45 s", "30 min", "1 h", "1 h 5 min". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return t('{seconds} s', { seconds });
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return t('{minutes} min', { minutes });
  return minutes === 0
    ? t('{hours} h', { hours })
    : t('{hours} h {minutes} min', { hours, minutes });
}

/** Stopwatch display: "05:09" or "1:02:03". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 0.756 → "76%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Keeps only digits and inserts the colon while typing a time: "930" → "9:30". */
export function normalizeTimeInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

/** "segunda-feira" → "Segunda-feira". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
