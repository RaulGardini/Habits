import type { WidgetSnapshot } from '@/core/widgets/snapshot';
import { resolveHabitColor } from '@/theme/habitColors';
import { themeColors } from '@/theme/tokens';

/** App Group shared by the app and the iOS widget extension (see targets/widget). */
export const APP_GROUP = 'group.dev.habits.app';
/** UserDefaults keys in the App Group. */
export const SNAPSHOT_KEY = 'widgetSnapshot';
export const PENDING_ACTIONS_KEY = 'pendingWidgetActions';

interface ThemePalette {
  background: string;
  text: string;
  textMuted: string;
  primary: string;
  track: string;
  outline: string;
}

/**
 * Snapshot as decoded by the Swift widget (`Snapshot.swift`): colors are resolved to hex
 * for both themes so the widget does not duplicate the app palette.
 */
export interface IosWidgetPayload {
  date: string;
  completed: number;
  total: number;
  habits: {
    id: string;
    name: string;
    done: boolean;
    progress: number;
    detail: string;
    action: string;
    light: { solid: string; onSolid: string };
    dark: { solid: string; onSolid: string };
  }[];
  heatmap: number[][];
  light: ThemePalette;
  dark: ThemePalette;
}

function palette(scheme: 'light' | 'dark'): ThemePalette {
  const colors = themeColors[scheme];
  return {
    background: colors.surface,
    text: colors.text,
    textMuted: colors.textMuted,
    primary: colors.primary,
    track: colors.surfaceMuted,
    outline: colors.border,
  };
}

export function toIosPayload(snapshot: WidgetSnapshot): IosWidgetPayload {
  return {
    date: snapshot.date,
    completed: snapshot.completed,
    total: snapshot.total,
    habits: snapshot.habits.map((habit) => {
      const light = resolveHabitColor(habit.color, 'light');
      const dark = resolveHabitColor(habit.color, 'dark');
      return {
        id: habit.id,
        name: habit.name,
        done: habit.done,
        progress: habit.progress,
        detail: habit.detail,
        action: habit.action,
        light: { solid: light.solid, onSolid: light.onSolid },
        dark: { solid: dark.solid, onSolid: dark.onSolid },
      };
    }),
    heatmap: snapshot.heatmap,
    light: palette('light'),
    dark: palette('dark'),
  };
}

export interface PendingWidgetAction {
  habitId: string;
  date: string;
}

/** Parses the queue written by the Swift `ToggleHabitIntent`; invalid content yields []. */
export function parsePendingActions(json: string | null | undefined): PendingWidgetAction[] {
  if (!json) return [];
  try {
    const data: unknown = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is PendingWidgetAction =>
        typeof item?.habitId === 'string' && typeof item?.date === 'string',
    );
  } catch {
    return [];
  }
}
