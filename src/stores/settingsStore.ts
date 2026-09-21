import { create } from 'zustand';

import { getRepositories } from '@/repositories';
import type { ThemePreference } from '@/theme/tokens';

const THEME_KEY = 'theme';
const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

interface SettingsState {
  themePreference: ThemePreference;
  load(): Promise<void>;
  setThemePreference(preference: ThemePreference): Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  themePreference: 'system',

  async load() {
    const stored = await getRepositories().settings.get<string>(THEME_KEY);
    const preference = THEME_PREFERENCES.find((p) => p === stored);
    if (preference) set({ themePreference: preference });
  },

  async setThemePreference(preference) {
    const previous = get().themePreference;
    set({ themePreference: preference });
    try {
      await getRepositories().settings.set(THEME_KEY, preference);
    } catch (error) {
      set({ themePreference: previous });
      throw error;
    }
  },
}));
