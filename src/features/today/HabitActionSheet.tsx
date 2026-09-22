import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LocalDate } from '@/core/dates/localDate';
import { formatClock, formatNumber } from '@/core/format';
import {
  entryWithStatus,
  entryWithValue,
  statusForValue,
  toggleEntry,
} from '@/core/habits/entries';
import type { PeriodQuota } from '@/core/habits/quota';
import type { Streaks } from '@/core/habits/streaks';
import type { EntryInput, Habit, HabitEntry } from '@/core/habits/types';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { describeStreak, describeTarget } from '@/features/habits/labels';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { resolveHabitColor } from '@/theme/habitColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Glass, nativeGlass } from '@/ui/Glass';
import { IconButton } from '@/ui/IconButton';
import { t } from '@/i18n/i18n';

export interface HabitActionTarget {
  habit: Habit;
  entry: HabitEntry | undefined;
  quota: PeriodQuota | null;
  streak: Streaks | undefined;
  /** Recorded + running seconds (timer habits). */
  timerSeconds: number | null;
  running: boolean;
}

interface HabitActionSheetProps {
  target: HabitActionTarget | null;
  date: LocalDate;
  onClose: () => void;
  /** Saves the day's entry (`null` removes it). */
  onSave: (habit: Habit, next: EntryInput | null) => void;
  onTimerToggle: (habit: Habit) => void;
}

/** Confirmation sheet shown when a habit circle is tapped. */
export function HabitActionSheet({
  target,
  date,
  onClose,
  onSave,
  onTimerToggle,
}: HabitActionSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('Fechar')}
          />
        </Animated.View>
        {target ? (
          <Animated.View
            entering={SlideInDown.springify().damping(18).stiffness(160)}
            style={[
              styles.sheet,
              {
                backgroundColor: nativeGlass ? 'transparent' : colors.surface,
                paddingBottom: spacing.xl + insets.bottom,
                boxShadow: `0 -8px 32px ${colors.shadow}33`,
              },
            ]}
            accessibilityViewIsModal
          >
            {nativeGlass ? (
              <Glass
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderTopLeftRadius: radius.lg + 6,
                    borderTopRightRadius: radius.lg + 6,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  },
                ]}
              />
            ) : null}
            <SheetContent
              // Fresh local state (e.g. the quantity being edited) for each habit.
              key={target.habit.id}
              target={target}
              date={date}
              onClose={onClose}
              onSave={onSave}
              onTimerToggle={onTimerToggle}
            />
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

function SheetContent({
  target,
  date,
  onClose,
  onSave,
  onTimerToggle,
}: Omit<HabitActionSheetProps, 'target'> & { target: HabitActionTarget }) {
  const { colors } = useTheme();
  const { habit, entry, quota, streak } = target;
  const done = entry?.status === 'done';
  const subtitle = [
    describeTarget(habit.tracking)
      ? t('Meta: {target}', { target: describeTarget(habit.tracking) ?? '' })
      : null,
    quota
      ? quota.unit === 'week'
        ? t('{done} de {target} nesta semana', { done: quota.done, target: quota.target })
        : t('{done} de {target} neste mês', { done: quota.done, target: quota.target })
      : null,
    streak && streak.current > 0 ? `🔥 ${describeStreak(streak.current, streak.unit)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const save = (next: EntryInput | null, success: boolean) => {
    if (success) hapticSuccess();
    else hapticLight();
    onSave(habit, next);
    onClose();
  };

  const more = () => {
    onClose();
    router.push({ pathname: '/entry', params: { habitId: habit.id, date } });
  };

  return (
    <>
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      <View style={styles.header}>
        <HabitIcon icon={habit.icon} color={habit.color} size={52} />
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={2}>
            {habit.name}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      {habit.tracking.type === 'boolean' ? (
        <View style={styles.actions}>
          <AppText tone="muted">
            {done ? t('Você já marcou este hábito. Quer desmarcar?') : t('Marcar como feito?')}
          </AppText>
          {done ? (
            <Button
              variant="secondary"
              icon="undo"
              label={t('Desmarcar')}
              onPress={() => save(toggleEntry(entry), false)}
            />
          ) : (
            <Button
              icon="check-bold"
              label={t('Concluir')}
              onPress={() => save(entryWithStatus(habit, entry, 'done'), true)}
            />
          )}
        </View>
      ) : null}

      {habit.tracking.type === 'quantity' ? (
        <QuantityEditor
          habit={habit}
          entry={entry}
          onSave={(next, success) => save(next, success)}
        />
      ) : null}

      {habit.tracking.type === 'timer' ? (
        <View style={styles.actions}>
          <AppText variant="title" style={styles.center}>
            {formatClock(target.timerSeconds ?? 0)}
          </AppText>
          <Button
            icon={target.running ? 'pause' : 'play'}
            label={target.running ? 'Pausar timer' : 'Iniciar timer'}
            onPress={() => {
              hapticLight();
              onTimerToggle(habit);
              onClose();
            }}
          />
          {!done ? (
            <Button
              variant="secondary"
              icon="check-bold"
              label={t('Marcar como feito')}
              onPress={() => save(entryWithStatus(habit, entry, 'done'), true)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        {entry?.status !== 'skipped' ? (
          <Button
            variant="ghost"
            icon="skip-next-circle-outline"
            label={t('Pular hoje')}
            onPress={() => save(entryWithStatus(habit, entry, 'skipped'), false)}
          />
        ) : (
          <Button
            variant="ghost"
            icon="restore"
            label={t('Voltar a contar')}
            onPress={() => save(null, false)}
          />
        )}
        <Button variant="ghost" icon="note-edit-outline" label={t('Nota e mais')} onPress={more} />
      </View>
      <Button variant="ghost" label={t('Cancelar')} onPress={onClose} />
    </>
  );
}

function QuantityEditor({
  habit,
  entry,
  onSave,
}: {
  habit: Habit;
  entry: HabitEntry | undefined;
  onSave: (next: EntryInput | null, success: boolean) => void;
}) {
  const { scheme } = useTheme();
  const initial = entry?.value ?? 0;
  const [value, setValue] = useState(initial);
  if (habit.tracking.type !== 'quantity') return null;
  const { step, target, unit } = habit.tracking;
  const color = resolveHabitColor(habit.color, scheme);
  const reaches = statusForValue(habit.tracking, value) === 'done';

  return (
    <View style={styles.actions}>
      <View style={styles.stepper}>
        <IconButton
          icon="minus"
          label={`Remover ${formatNumber(step)} ${unit}`}
          onPress={() => setValue((v) => Math.max(0, Math.round((v - step) * 1000) / 1000))}
          disabled={value <= 0}
          color={color.solid}
          size={30}
        />
        <View style={styles.valueBox}>
          <AppText variant="title" accessibilityLiveRegion="polite">
            {formatNumber(value)}
          </AppText>
          <AppText variant="caption" tone="muted">
            de {formatNumber(target)} {unit}
          </AppText>
        </View>
        <IconButton
          icon="plus"
          label={`Adicionar ${formatNumber(step)} ${unit}`}
          onPress={() => setValue((v) => Math.round((v + step) * 1000) / 1000)}
          color={color.solid}
          size={30}
        />
      </View>
      {value < target ? (
        <Button
          variant="secondary"
          label={t('Completar a meta')}
          onPress={() => setValue(target)}
        />
      ) : null}
      <Button
        icon="check-bold"
        label={t('Salvar')}
        onPress={() =>
          onSave(entryWithValue(habit, entry, value), reaches && entry?.status !== 'done')
        }
        disabled={value === initial}
      />
      <AppText variant="caption" tone="muted" style={styles.center}>
        Passo de {formatNumber(step)} {unit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  actions: { gap: spacing.md },
  center: { textAlign: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  valueBox: { alignItems: 'center', minWidth: 100 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
});
