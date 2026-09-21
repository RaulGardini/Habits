export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
}

/** Neutral surfaces so the habit colors stand out. */
export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: '#f5f5f7',
    surface: '#ffffff',
    surfaceMuted: '#ebebef',
    border: '#d9d9e0',
    text: '#17171c',
    textMuted: '#5c5c66',
    primary: '#4f46e5',
    onPrimary: '#ffffff',
    danger: '#c62828',
    onDanger: '#ffffff',
  },
  dark: {
    background: '#0e0e11',
    surface: '#1a1a1f',
    surfaceMuted: '#26262d',
    border: '#34343d',
    text: '#f2f2f5',
    textMuted: '#a3a3ad',
    primary: '#a5b4fc',
    onPrimary: '#0e0e11',
    danger: '#ef9a9a',
    onDanger: '#0e0e11',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Minimum touch target (WCAG / platform guidelines). */
export const MIN_TOUCH_SIZE = 44;

/** Max width of the main content column on wide screens. */
export const MAX_CONTENT_WIDTH = 720;

/** Width from which the web layout switches to a sidebar. */
export const WIDE_BREAKPOINT = 768;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;
