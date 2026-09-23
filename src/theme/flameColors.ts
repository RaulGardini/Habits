/**
 * Flame palette, one entry per tier of `FLAME_TIERS` (0, 5, 10, 30, 50, 100, 200, 300, 500, 1000):
 * the streak gets hotter, so the fire goes warm bronze → orange → gold → green → teal → blue → purple → pink → ruby → white.
 * `label` is the pt-BR name (translated by `t`).
 */
export interface FlameColors {
  /** Outer flame gradient, bottom → top. */
  from: string;
  to: string;
  /** Inner core. */
  core: string;
  label: string;
}

export const FLAME_COLORS: readonly FlameColors[] = [
  { from: '#a98457', to: '#d9b184', core: '#f3e2c9', label: 'Faísca' },
  { from: '#f47b00', to: '#ffa41b', core: '#ffd23f', label: 'Laranja' },
  { from: '#e8a400', to: '#ffd12e', core: '#fff0a8', label: 'Dourada' },
  { from: '#2e8b3d', to: '#67cc63', core: '#c8f5c0', label: 'Verde' },
  { from: '#0f8f8f', to: '#3fd6c6', core: '#cdfff6', label: 'Turquesa' },
  { from: '#1663c9', to: '#57b4ff', core: '#d4ecff', label: 'Azul' },
  { from: '#5f2ecb', to: '#a882ff', core: '#e6dbff', label: 'Roxo' },
  { from: '#b81b7a', to: '#ff6fc2', core: '#ffd4ec', label: 'Rosa' },
  { from: '#b3121f', to: '#ff5a54', core: '#ffc9c0', label: 'Rubi' },
  { from: '#6b7180', to: '#dfe9f7', core: '#ffffff', label: 'Branca' },
];

export function flameColors(tierIndex: number): FlameColors {
  return (
    FLAME_COLORS[Math.min(Math.max(tierIndex, 0), FLAME_COLORS.length - 1)] ?? FLAME_COLORS[0]!
  );
}
