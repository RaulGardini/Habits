import { create } from 'zustand';

import type { WeekStartsOn } from '@/core/habits/types';
import { getRepositories } from '@/repositories';
import type { ThemePreference } from '@/theme/tokens';

const THEME_KEY = 'theme';
const WEEK_STARTS_ON_KEY = 'weekStartsOn';
const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

interface SettingsState {
  themePreference: ThemePreference;
  weekStartsOn: WeekStartsOn;
  load(): Promise<void>;
  setThemePreference(preference: ThemePreference): Promise<void>;
  setWeekStartsOn(weekStartsOn: WeekStartsOn): Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  /** Optimistically sets a value and persists it, rolling back on failure. */
  async function persist<K extends 'themePreference' | 'weekStartsOn'>(
    field: K,
    key: string,
    value: SettingsState[K],
  ) {
    const previous = get()[field];
    set({ [field]: value } as Pick<SettingsState, K>);
    try {
      await getRepositories().settings.set(key, value);
    } catch (error) {
      set({ [field]: previous } as Pick<SettingsState, K>);
      throw error;
    }
  }

  return {
    themePreference: 'system',
    weekStartsOn: 0,

    async load() {
      const { settings } = getRepositories();
      const [theme, weekStartsOn] = await Promise.all([
        settings.get<string>(THEME_KEY),
        settings.get<number>(WEEK_STARTS_ON_KEY),
      ]);
      set({
        themePreference: THEME_PREFERENCES.find((p) => p === theme) ?? 'system',
        weekStartsOn: weekStartsOn === 1 ? 1 : 0,
      });
    },

    setThemePreference: (preference) => persist('themePreference', THEME_KEY, preference),
    setWeekStartsOn: (weekStartsOn) => persist('weekStartsOn', WEEK_STARTS_ON_KEY, weekStartsOn),
  };
});
