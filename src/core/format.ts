/** pt-BR number: up to 2 decimals, comma separator, no trailing zeros ("2,5", "10"). */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
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
  if (seconds < 60) return `${seconds} s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
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
