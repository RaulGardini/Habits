import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDayLabel, todayLocal, type LocalDate } from '@/core/dates/localDate';
import { formatNumber, parseDecimal } from '@/core/format';
import { entryFromSheet, type EntrySheetChoice } from '@/core/habits/entries';
import type { Habit, HabitEntry } from '@/core/habits/types';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { describeTarget } from '@/features/habits/labels';
import { goBack } from '@/lib/navigation';
import { useDayEntries, useEntriesStore } from '@/stores/entriesStore';
import { useHabitsStore } from '@/stores/habitsStore';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { SegmentedControl, type SegmentOption } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';
import { t } from '@/i18n/i18n';
import { hapticSuccess } from '@/lib/haptics';

export const NOTE_MAX_LENGTH = 500;

export function EntryScreen({ habitId, date }: { habitId: string; date: LocalDate }) {
  const habit = useHabitsStore((state) => state.habits.find((h) => h.id === habitId));
  const { entries, loaded } = useDayEntries(date);
  const entry = entries[habitId];

  if (!habit) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title={t('Hábito não encontrado')} />
      </Screen>
    );
  }
  if (!loaded) return <Screen edges={['bottom', 'left', 'right']}>{null}</Screen>;
  return <EntryForm key={entry?.updatedAt ?? 'new'} habit={habit} date={date} entry={entry} />;
}

function initialChoice(habit: Habit, entry: HabitEntry | undefined): EntrySheetChoice {
  if (entry?.status === 'skipped' || entry?.status === 'missed') return entry.status;
  if (habit.tracking.type !== 'boolean') return 'byValue';
  return entry?.status === 'done' ? 'done' : 'clear';
}

function EntryForm({ habit, date, entry }: { habit: Habit; date: LocalDate; entry?: HabitEntry }) {
  const save = useEntriesStore((state) => state.save);
  const measurable = habit.tracking.type !== 'boolean';
  const isTimer = habit.tracking.type === 'timer';
  const [choice, setChoice] = useState<EntrySheetChoice>(() => initialChoice(habit, entry));
  const [valueText, setValueText] = useState(() => {
    const value = entry?.value ?? 0;
    return formatNumber(isTimer ? value / 60 : value);
  });
  const [note, setNote] = useState(entry?.note ?? '');
  const [saving, setSaving] = useState(false);

  const options: SegmentOption<EntrySheetChoice>[] = measurable
    ? [
        { value: 'byValue', label: t('Pelo valor'), icon: 'counter' },
        { value: 'done', label: t('Concluído'), icon: 'check-circle-outline' },
        { value: 'skipped', label: t('Pular'), icon: 'skip-next-circle-outline' },
        { value: 'missed', label: t('Não feito'), icon: 'close-circle-outline' },
      ]
    : [
        { value: 'done', label: t('Concluído'), icon: 'check-circle-outline' },
        { value: 'skipped', label: t('Pular'), icon: 'skip-next-circle-outline' },
        { value: 'missed', label: t('Não feito'), icon: 'close-circle-outline' },
        { value: 'clear', label: t('Sem registro'), icon: 'circle-outline' },
      ];

  const parsed = parseDecimal(valueText || '0');
  const valueError = measurable && !Number.isFinite(parsed) ? t('Número inválido.') : undefined;

  const submit = async (overrideChoice?: EntrySheetChoice) => {
    if (valueError) return;
    const next = entryFromSheet(habit, {
      choice: overrideChoice ?? choice,
      value: isTimer ? Math.round(parsed * 60) : parsed,
      note,
    });
    setSaving(true);
    try {
      await save(habit.id, date, next);
      hapticSuccess();
      goBack();
    } catch (error) {
      showError(t('Não foi possível salvar o registro.'), error);
    } finally {
      setSaving(false);
    }
  };

  const target = describeTarget(habit.tracking);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Card style={styles.header}>
        <HabitIcon icon={habit.icon} color={habit.color} size={48} />
        <View style={styles.headerText}>
          <AppText variant="heading" numberOfLines={2}>
            {habit.name}
          </AppText>
          <AppText tone="muted">
            {formatDayLabel(date, todayLocal())}
            {target ? ` · ${t('meta {target}', { target })}` : ''}
          </AppText>
        </View>
      </Card>

      <SegmentedControl<EntrySheetChoice>
        label={t('Status')}
        options={options}
        value={choice}
        onChange={setChoice}
      />
      {choice === 'skipped' ? (
        <AppText variant="caption" tone="muted">
          {t('Dias pulados não quebram a sequência e não contam contra a taxa de conclusão.')}
        </AppText>
      ) : null}

      {measurable ? (
        <TextField
          label={
            isTimer
              ? t('Tempo (minutos)')
              : t('Quantidade ({unit})', {
                  unit: habit.tracking.type === 'quantity' ? habit.tracking.unit : '',
                })
          }
          value={valueText}
          onChangeText={setValueText}
          keyboardType="decimal-pad"
          error={valueError}
        />
      ) : null}

      <TextField
        label={t('Nota (opcional)')}
        value={note}
        onChangeText={setNote}
        placeholder={t('Como foi?')}
        multiline
        maxLength={NOTE_MAX_LENGTH}
      />

      <View style={styles.actions}>
        <Button
          label={saving ? t('Salvando…') : t('Salvar')}
          onPress={() => submit()}
          disabled={saving}
        />
        {entry && measurable ? (
          <Button
            variant="ghost"
            label={t('Apagar registro do dia')}
            onPress={() => submit('clear')}
            disabled={saving}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  actions: { gap: spacing.sm },
});
