import { contrastRatio, withAlpha } from './contrast';
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, resolveHabitColor } from './habitColors';
import { themeColors } from './tokens';

// WCAG 1.4.11: graphical objects / UI components need 3:1.
const MIN_GRAPHIC_CONTRAST = 3;

describe('habit palette', () => {
  it('has unique keys', () => {
    const keys = HABIT_COLORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(['light', 'dark'] as const)('%s scheme', (scheme) => {
    it.each(HABIT_COLORS.map((c) => [c.key, c] as const))(
      '%s has enough contrast',
      (_key, color) => {
        const { solid, onSolid } = color[scheme];
        expect(contrastRatio(solid, onSolid)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
        expect(contrastRatio(solid, themeColors[scheme].surface)).toBeGreaterThanOrEqual(
          MIN_GRAPHIC_CONTRAST,
        );
      },
    );
  });
});

describe('resolveHabitColor', () => {
  it('falls back to the default color for unknown keys', () => {
    expect(resolveHabitColor('nope', 'light').solid).toBe(
      resolveHabitColor(DEFAULT_HABIT_COLOR, 'light').solid,
    );
  });
});

describe('theme text contrast', () => {
  it.each(['light', 'dark'] as const)('%s text meets WCAG AA', (scheme) => {
    const colors = themeColors[scheme];
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onDanger, colors.danger)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('withAlpha', () => {
  it('appends an alpha byte', () => {
    expect(withAlpha('#000000', 1)).toBe('#000000ff');
    expect(withAlpha('#000000', 0)).toBe('#00000000');
  });
});
