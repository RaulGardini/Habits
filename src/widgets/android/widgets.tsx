// react-native-android-widget calls these components as plain functions, so the React
// Compiler's memoization (hooks) must not run: every component opts out with 'use no memo'.

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { heatmapSvg, type WidgetSnapshot } from '@/core/widgets/snapshot';
import { resolveHabitColor } from '@/theme/habitColors';
import { themeColors, type ColorScheme } from '@/theme/tokens';

// Widget JSX is serialized to native Android views: only react-native-android-widget primitives.

export const TODAY_WIDGET = 'Today';
export const HEATMAP_WIDGET = 'Heatmap';
/** clickAction handled by the task handler. */
export const HABIT_ACTION = 'HABIT_ACTION';

type HexColor = `#${string}`;
const hex = (color: string) => color as HexColor;

interface WidgetProps {
  snapshot: WidgetSnapshot;
  scheme: ColorScheme;
  /** Widget height in dp, used to decide how many habits fit. */
  height: number;
}

function ProgressBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  'use no memo';
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 6,
        borderRadius: 3,
        backgroundColor: hex(track),
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {filled > 0 ? (
        <FlexWidget
          style={{ flex: filled, height: 6, borderRadius: 3, backgroundColor: hex(color) }}
        />
      ) : null}
      {filled < 100 ? <FlexWidget style={{ flex: 100 - filled, height: 6 }} /> : null}
    </FlexWidget>
  );
}

export function TodayWidget({ snapshot, scheme, height }: WidgetProps) {
  'use no memo';
  const colors = themeColors[scheme];
  const rows = Math.max(1, Math.floor((height - 64) / 40));
  const habits = snapshot.habits.slice(0, rows);
  const hidden = snapshot.habits.length - habits.length;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: hex(colors.surface),
        borderRadius: 20,
        padding: 12,
        flexDirection: 'column',
        flexGap: 8,
      }}
    >
      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <TextWidget
          text="Hoje"
          style={{ fontSize: 16, fontWeight: '700', color: hex(colors.text) }}
        />
        <TextWidget
          text={snapshot.total > 0 ? `${snapshot.completed}/${snapshot.total}` : ''}
          style={{ fontSize: 14, color: hex(colors.textMuted) }}
        />
      </FlexWidget>
      <ProgressBar
        ratio={snapshot.total > 0 ? snapshot.completed / snapshot.total : 0}
        color={colors.primary}
        track={colors.surfaceMuted}
      />

      {habits.length === 0 ? (
        <TextWidget
          text="Nenhum hábito para hoje"
          style={{ fontSize: 14, color: hex(colors.textMuted) }}
        />
      ) : null}

      {habits.map((habit) => {
        const color = resolveHabitColor(habit.color, scheme);
        const clickable = habit.action !== 'open';
        return (
          <FlexWidget
            key={habit.id}
            clickAction={clickable ? HABIT_ACTION : 'OPEN_APP'}
            clickActionData={clickable ? { habitId: habit.id, date: snapshot.date } : undefined}
            style={{
              width: 'match_parent',
              height: 36,
              flexDirection: 'row',
              alignItems: 'center',
              flexGap: 10,
            }}
          >
            <FlexWidget
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                // No alpha colors here: Android reads 8-digit hex as #AARRGGBB.
                backgroundColor: hex(habit.done ? color.solid : colors.surface),
                borderColor: hex(color.solid),
                borderWidth: 2,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text={habit.done ? '✓' : habit.action === 'increment' ? '+' : ''}
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: hex(habit.done ? color.onSolid : color.solid),
                }}
              />
            </FlexWidget>
            <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
              <TextWidget
                text={habit.name}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 14, fontWeight: '600', color: hex(colors.text) }}
              />
              {habit.detail ? (
                <TextWidget
                  text={habit.detail}
                  maxLines={1}
                  style={{ fontSize: 11, color: hex(colors.textMuted) }}
                />
              ) : null}
            </FlexWidget>
          </FlexWidget>
        );
      })}

      {hidden > 0 ? (
        <TextWidget
          text={`+${hidden} no app`}
          style={{ fontSize: 12, color: hex(colors.textMuted) }}
        />
      ) : null}
    </FlexWidget>
  );
}

export function HeatmapWidget({ snapshot, scheme }: WidgetProps) {
  'use no memo';
  const colors = themeColors[scheme];
  const svg = heatmapSvg(snapshot.heatmap, {
    color: colors.primary,
    empty: colors.surfaceMuted,
    outline: colors.border,
  });
  const width = snapshot.heatmap.length * 13 - 3;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: hex(colors.surface),
        borderRadius: 20,
        padding: 12,
        flexDirection: 'column',
        flexGap: 8,
      }}
    >
      <FlexWidget
        style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <TextWidget
          text="Últimas semanas"
          style={{ fontSize: 14, fontWeight: '700', color: hex(colors.text) }}
        />
        <TextWidget
          text={snapshot.total > 0 ? `Hoje ${snapshot.completed}/${snapshot.total}` : ''}
          style={{ fontSize: 12, color: hex(colors.textMuted) }}
        />
      </FlexWidget>
      <FlexWidget
        style={{ flex: 1, width: 'match_parent', justifyContent: 'center', alignItems: 'center' }}
      >
        <SvgWidget svg={svg} style={{ width, height: 88 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Light and dark versions; Android picks one according to the system theme. */
export function renderWidget(name: string, snapshot: WidgetSnapshot, height: number) {
  const Component = name === HEATMAP_WIDGET ? HeatmapWidget : TodayWidget;
  return {
    light: <Component snapshot={snapshot} scheme="light" height={height} />,
    dark: <Component snapshot={snapshot} scheme="dark" height={height} />,
  };
}
