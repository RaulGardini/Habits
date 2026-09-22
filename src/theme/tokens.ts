export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  /** Brand yellow, for fills (buttons, selected chips, progress, heatmap). */
  primary: string;
  onPrimary: string;
  /** Text-safe version of the brand color (links, active tabs, icons on surfaces). */
  accent: string;
  /** Soft brand tint for highlighted backgrounds (today, current period). */
  primarySoft: string;
  /** Translucent bar/sheet background where a real glass effect is not available. */
  glass: string;
  shadow: string;
  danger: string;
  onDanger: string;
}

/** Warm neutrals (paper / charcoal) with a sunny yellow accent. */
export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: '#faf6ee',
    surface: '#fffdf8',
    surfaceMuted: '#f1ebdf',
    border: '#e7dfcf',
    text: '#2b2620',
    textMuted: '#6e6558',
    primary: '#f6c343',
    onPrimary: '#2b2200',
    accent: '#8f5f00',
    primarySoft: '#fdf1cc',
    glass: '#fffdf8cc',
    shadow: '#5a4a2a',
    danger: '#b3261e',
    onDanger: '#ffffff',
  },
  dark: {
    background: '#15130f',
    surface: '#201d18',
    surfaceMuted: '#2b2720',
    border: '#38322a',
    text: '#f5efe4',
    textMuted: '#b3a999',
    primary: '#f7cd4f',
    onPrimary: '#231c00',
    accent: '#f7cd4f',
    primarySoft: '#3a3120',
    glass: '#201d18cc',
    shadow: '#000000',
    danger: '#f1a097',
    onDanger: '#15130f',
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
  sm: 10,
  md: 14,
  lg: 22,
  full: 999,
} as const;

/** Soft two-layer shadow for cards (`boxShadow` works on native and web). */
export function softShadow(color: string): string {
  return `0 1px 2px ${color}14, 0 6px 20px ${color}12`;
}

/** Minimum touch target (WCAG / platform guidelines). */
export const MIN_TOUCH_SIZE = 44;

/** Max width of the main content column on wide screens. */
export const MAX_CONTENT_WIDTH = 720;

/** Width from which the web layout switches to a sidebar. */
export const WIDE_BREAKPOINT = 768;

/** Nunito (rounded, friendly), loaded by `useFonts` in the root layout. */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

export const typography = {
  title: { fontSize: 30, lineHeight: 36, fontFamily: fonts.extrabold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontFamily: fonts.bold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold },
} as const;

export type TypographyVariant = keyof typeof typography;
