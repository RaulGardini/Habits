/**
 * Flame palette, one entry per tier of `FLAME_TIERS` (0, 10, 30, 50, 100, 200, 300, 500, 1000):
 * the streak gets hotter, so the fire goes ember → yellow → orange → red → blue → violet → white.
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
  { from: '#b4855a', to: '#e0b27a', core: '#f7e3c4', label: 'Faísca' },
  { from: '#f0a41a', to: '#ffd95e', core: '#fff3c4', label: 'Dourada' },
  { from: '#ef7216', to: '#ffb34d', core: '#ffe2ad', label: 'Laranja' },
  { from: '#dc3a20', to: '#ff8a3d', core: '#ffd3a8', label: 'Brasa' },
  { from: '#b3184b', to: '#ff5d7a', core: '#ffc2cf', label: 'Rubro' },
  { from: '#1667c4', to: '#59b8ff', core: '#d3ecff', label: 'Azul' },
  { from: '#5b2bc9', to: '#a884ff', core: '#e4d9ff', label: 'Violeta' },
  { from: '#0e8a8a', to: '#4fe3d0', core: '#d6fff8', label: 'Esmeralda' },
  { from: '#5b6474', to: '#cfe2ff', core: '#ffffff', label: 'Branca' },
];

export function flameColors(tierIndex: number): FlameColors {
  return (
    FLAME_COLORS[Math.min(Math.max(tierIndex, 0), FLAME_COLORS.length - 1)] ?? FLAME_COLORS[0]!
  );
}
