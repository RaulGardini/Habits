import { withAlpha } from './contrast';
import type { ColorScheme } from './tokens';

export interface HabitColorVariant {
  /** Filled backgrounds: icon badge, checked state, heatmap max. */
  solid: string;
  /** Icons/text drawn on top of `solid`. */
  onSolid: string;
}

export interface HabitColorDefinition {
  key: string;
  /** pt-BR name for accessibility labels. */
  label: string;
  light: HabitColorVariant;
  dark: HabitColorVariant;
}

const onLight = '#ffffff';
const onDark = '#111114';

/** Vibrant palette. Contrast is enforced by `habitColors.test.ts`. */
export const HABIT_COLORS: readonly HabitColorDefinition[] = [
  {
    key: 'red',
    label: 'Vermelho',
    light: { solid: '#dc2626', onSolid: onLight },
    dark: { solid: '#f87171', onSolid: onDark },
  },
  {
    key: 'orange',
    label: 'Laranja',
    light: { solid: '#c2410c', onSolid: onLight },
    dark: { solid: '#fb923c', onSolid: onDark },
  },
  {
    key: 'amber',
    label: 'Âmbar',
    light: { solid: '#b45309', onSolid: onLight },
    dark: { solid: '#fbbf24', onSolid: onDark },
  },
  {
    key: 'lime',
    label: 'Lima',
    light: { solid: '#4d7c0f', onSolid: onLight },
    dark: { solid: '#a3e635', onSolid: onDark },
  },
  {
    key: 'green',
    label: 'Verde',
    light: { solid: '#047857', onSolid: onLight },
    dark: { solid: '#34d399', onSolid: onDark },
  },
  {
    key: 'teal',
    label: 'Turquesa',
    light: { solid: '#0f766e', onSolid: onLight },
    dark: { solid: '#2dd4bf', onSolid: onDark },
  },
  {
    key: 'cyan',
    label: 'Ciano',
    light: { solid: '#0e7490', onSolid: onLight },
    dark: { solid: '#22d3ee', onSolid: onDark },
  },
  {
    key: 'blue',
    label: 'Azul',
    light: { solid: '#2563eb', onSolid: onLight },
    dark: { solid: '#60a5fa', onSolid: onDark },
  },
  {
    key: 'indigo',
    label: 'Anil',
    light: { solid: '#4f46e5', onSolid: onLight },
    dark: { solid: '#818cf8', onSolid: onDark },
  },
  {
    key: 'violet',
    label: 'Violeta',
    light: { solid: '#7c3aed', onSolid: onLight },
    dark: { solid: '#a78bfa', onSolid: onDark },
  },
  {
    key: 'fuchsia',
    label: 'Fúcsia',
    light: { solid: '#a21caf', onSolid: onLight },
    dark: { solid: '#e879f9', onSolid: onDark },
  },
  {
    key: 'pink',
    label: 'Rosa',
    light: { solid: '#db2777', onSolid: onLight },
    dark: { solid: '#f472b6', onSolid: onDark },
  },
];

export const DEFAULT_HABIT_COLOR = 'amber';

const byKey = new Map(HABIT_COLORS.map((color) => [color.key, color]));

export interface ResolvedHabitColor extends HabitColorVariant {
  /** Translucent tint for card backgrounds / unchecked states. */
  soft: string;
  label: string;
}

export function resolveHabitColor(key: string, scheme: ColorScheme): ResolvedHabitColor {
  const definition = byKey.get(key) ?? byKey.get(DEFAULT_HABIT_COLOR);
  if (!definition) throw new Error('Default habit color missing from palette');
  const variant = definition[scheme];
  return {
    ...variant,
    soft: withAlpha(variant.solid, scheme === 'light' ? 0.12 : 0.2),
    label: definition.label,
  };
}
