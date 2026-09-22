import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { weeksGrid } from '@/core/dates/calendar';
import { parseLocalDate, type LocalDate } from '@/core/dates/localDate';
import type { DateRange } from '@/core/dates/periods';
import { orderedWeekdays, weekdayLetter } from '@/core/dates/weekdays';
import type { WeekStartsOn } from '@/core/habits/types';
import { intensityLevel } from '@/core/stats/stats';
import { withAlpha } from '@/theme/contrast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { t } from '@/i18n/i18n';

export type HeatmapMode = 'week' | 'month' | 'year';

/** Opacity of the series color for intensity levels 1..4 (sequential, one hue). */
const LEVEL_ALPHA = [0.3, 0.5, 0.75, 1] as const;

/** SVG text defaults to a serif font on web. */
const SVG_FONT = Platform.select({
  web: `${fonts.regular}, system-ui, sans-serif`,
  default: undefined,
});

export interface HeatmapProps {
  mode: HeatmapMode;
  range: DateRange;
  /** 0..1 per day; `null` = the day does not count (not scheduled, skipped, future…). */
  values: ReadonlyMap<LocalDate, number | null>;
  /** Series color (habit color, or primary for the overall heatmap). */
  color: string;
  /** Text color on the strongest cells. */
  onColor: string;
  weekStartsOn: WeekStartsOn;
  today: LocalDate;
  selected: LocalDate | null;
  onSelect: (date: LocalDate) => void;
  /** Summary for screen readers (the grid itself is visual). */
  accessibilityLabel: string;
}

function useCellColors(color: string) {
  const { colors } = useTheme();
  return (value: number | null | undefined, future: boolean) => {
    if (future || value === null || value === undefined) {
      return { fill: 'transparent', stroke: colors.border };
    }
    const level = intensityLevel(value);
    if (level === 0) return { fill: colors.surfaceMuted, stroke: colors.surfaceMuted };
    const fill = withAlpha(color, LEVEL_ALPHA[level - 1] ?? 1);
    return { fill, stroke: fill };
  };
}

export function Heatmap(props: HeatmapProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={props.accessibilityLabel}
    >
      {width > 0 ? (
        props.mode === 'year' ? (
          <YearGrid {...props} />
        ) : (
          <CalendarGrid {...props} width={width} />
        )
      ) : null}
    </View>
  );
}

/** Week (one row) and month (calendar rows) views, with day numbers. */
function CalendarGrid({
  mode,
  range,
  values,
  color,
  onColor,
  weekStartsOn,
  today,
  selected,
  onSelect,
  width,
}: HeatmapProps & { width: number }) {
  const { colors } = useTheme();
  const cellColors = useCellColors(color);
  const gap = 6;
  const cell = Math.min(56, Math.floor((width - gap * 6) / 7));
  const header = 20;
  const weeks = weeksGrid(range.from, range.to, weekStartsOn);
  const gridWidth = cell * 7 + gap * 6;
  const height = header + weeks.length * (cell + gap);

  const hitTest = (x: number, y: number) =>
    weeks[Math.floor((y - header) / (cell + gap))]?.[Math.floor(x / (cell + gap))] ?? null;

  return (
    <HitArea hitTest={hitTest} onSelect={onSelect} style={styles.center}>
      <Svg width={gridWidth} height={height}>
        {orderedWeekdays(weekStartsOn).map((weekday, column) => (
          <SvgText
            key={weekday}
            x={column * (cell + gap) + cell / 2}
            y={14}
            fontSize={11}
            fill={colors.textMuted}
            textAnchor="middle"
            fontFamily={SVG_FONT}
          >
            {weekdayLetter(weekday)}
          </SvgText>
        ))}
        {weeks.map((week, row) =>
          week.map((date, column) => {
            if (!date) return null;
            const value = values.get(date);
            const { fill, stroke } = cellColors(value, date > today);
            const x = column * (cell + gap);
            const y = header + row * (cell + gap);
            const strong = value !== null && value !== undefined && intensityLevel(value) >= 3;
            const isSelected = date === selected;
            return (
              <Cell
                key={date}
                x={x}
                y={y}
                size={cell}
                fill={fill}
                stroke={isSelected ? colors.text : stroke}
                strokeWidth={isSelected ? 2 : 1}
                label={
                  mode === 'month' || mode === 'week'
                    ? String(parseLocalDate(date).getDate())
                    : undefined
                }
                labelColor={strong ? onColor : date > today ? colors.textMuted : colors.text}
                bold={date === today}
              />
            );
          }),
        )}
      </Svg>
    </HitArea>
  );
}

/** GitHub-style year view: weeks as columns, weekdays as rows. Scrolls horizontally. */
function YearGrid({ range, values, color, weekStartsOn, today, selected, onSelect }: HeatmapProps) {
  const { colors } = useTheme();
  const cellColors = useCellColors(color);
  const cell = 12;
  const gap = 3;
  const labelWidth = 16;
  const header = 16;
  const weeks = weeksGrid(range.from, range.to, weekStartsOn);
  const width = labelWidth + weeks.length * (cell + gap);
  const height = header + 7 * (cell + gap);
  const weekdays = orderedWeekdays(weekStartsOn);

  // When the current year is shown, scroll so today's week is visible.
  const scrollRef = useRef<ScrollView>(null);
  const todayColumn = weeks.findIndex((week) => week.includes(today));
  useEffect(() => {
    if (todayColumn < 0) return;
    const x = labelWidth + todayColumn * (cell + gap);
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 240), animated: false });
  }, [todayColumn]);

  const hitTest = (x: number, y: number) =>
    weeks[Math.floor((x - labelWidth) / (cell + gap))]?.[Math.floor((y - header) / (cell + gap))] ??
    null;

  // Month label above the first column containing the 1st of each month.
  const monthLabels: { x: number; text: string }[] = [];
  weeks.forEach((week, column) => {
    const first = week.find((d) => d?.endsWith('-01'));
    if (first) {
      monthLabels.push({
        x: labelWidth + column * (cell + gap),
        text: format(parseLocalDate(first), 'MMM', { locale: ptBR }),
      });
    }
  });

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
      <HitArea hitTest={hitTest} onSelect={onSelect}>
        <Svg width={width} height={height}>
          {monthLabels.map((label) => (
            <SvgText
              key={label.x}
              x={label.x}
              y={11}
              fontSize={10}
              fill={colors.textMuted}
              fontFamily={SVG_FONT}
            >
              {label.text}
            </SvgText>
          ))}
          {[1, 3, 5].map((row) => (
            <SvgText
              key={row}
              x={0}
              y={header + row * (cell + gap) + cell - 2}
              fontSize={9}
              fill={colors.textMuted}
              fontFamily={SVG_FONT}
            >
              {weekdayLetter(weekdays[row] ?? 0)}
            </SvgText>
          ))}
          {weeks.map((week, column) =>
            week.map((date, row) => {
              if (!date) return null;
              const { fill, stroke } = cellColors(values.get(date), date > today);
              const isSelected = date === selected;
              return (
                <Cell
                  key={date}
                  x={labelWidth + column * (cell + gap)}
                  y={header + row * (cell + gap)}
                  size={cell}
                  fill={fill}
                  stroke={isSelected ? colors.text : stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  radius={2}
                />
              );
            }),
          )}
        </Svg>
      </HitArea>
    </ScrollView>
  );
}

/**
 * One press handler for the whole grid: maps the touch position to a day. (Per-element
 * `onPress` on react-native-svg shapes leaks responder props to the DOM on web.)
 */
function HitArea({
  hitTest,
  onSelect,
  style,
  children,
}: {
  hitTest: (x: number, y: number) => LocalDate | null;
  onSelect: (date: LocalDate) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessible={false}
      style={style}
      onPress={(event) => {
        const { x, y } = localPoint(event);
        const date = hitTest(x, y);
        if (date) onSelect(date);
      }}
    >
      {children}
    </Pressable>
  );
}

/** Touch position relative to the pressed element. */
function localPoint(event: GestureResponderEvent): { x: number; y: number } {
  if (Platform.OS !== 'web') {
    return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
  }
  // react-native-web does not fill locationX/Y for press events: use the DOM event.
  const native = event.nativeEvent as unknown as { clientX: number; clientY: number };
  const target = event.currentTarget as unknown as { getBoundingClientRect(): DOMRect };
  const rect = target.getBoundingClientRect();
  return { x: native.clientX - rect.left, y: native.clientY - rect.top };
}

interface CellProps {
  x: number;
  y: number;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  label?: string;
  labelColor?: string;
  bold?: boolean;
  radius?: number;
}

function Cell({
  x,
  y,
  size,
  fill,
  stroke,
  strokeWidth,
  label,
  labelColor,
  bold,
  radius,
}: CellProps) {
  return (
    <>
      <Rect
        x={x + strokeWidth / 2}
        y={y + strokeWidth / 2}
        width={size - strokeWidth}
        height={size - strokeWidth}
        rx={radius ?? 6}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {label ? (
        <SvgText
          x={x + size / 2}
          y={y + size / 2 + 4}
          fontSize={Math.min(13, size / 3)}
          fontWeight={bold ? '700' : '400'}
          fill={labelColor}
          textAnchor="middle"
          fontFamily={SVG_FONT}
        >
          {label}
        </SvgText>
      ) : null}
    </>
  );
}

/** "Menos ▢▢▢▢▢ Mais" legend for the intensity levels. */
export function HeatmapLegend({ color }: { color: string }) {
  const { colors } = useTheme();
  const swatches = [colors.surfaceMuted, ...LEVEL_ALPHA.map((alpha) => withAlpha(color, alpha))];
  return (
    <View
      style={styles.legend}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant="caption" tone="muted">
        {t('Menos')}
      </AppText>
      {swatches.map((fill) => (
        <View key={fill} style={[styles.swatch, { backgroundColor: fill }]} />
      ))}
      <AppText variant="caption" tone="muted">
        {t('Mais')}
      </AppText>
      <View style={[styles.swatch, styles.emptySwatch, { borderColor: colors.border }]} />
      <AppText variant="caption" tone="muted">
        {t('Não conta')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignSelf: 'center' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  emptySwatch: { borderWidth: 1, marginLeft: spacing.sm },
});
