import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TIMES_OF_DAY, type HabitDraft, type TimeOfDay } from '@/core/habits/types';
import {
  HABIT_NAME_MAX_LENGTH,
  hasErrors,
  validateHabitDraft,
  type HabitDraftErrors,
} from '@/core/habits/validation';
import { useToday } from '@/hooks/useNow';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';

import { ColorPicker } from './ColorPicker';
import { DateStepper } from './DateStepper';
import { FrequencyPicker } from './FrequencyPicker';
import { HabitIcon } from './HabitIcon';
import { IconPicker } from './IconPicker';
import { TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL, describeFrequency, describeTarget } from './labels';
import { RemindersEditor } from './RemindersEditor';
import { TrackingPicker } from './TrackingPicker';

interface HabitFormProps {
  initial: HabitDraft;
  submitLabel: string;
  onSubmit: (draft: HabitDraft) => Promise<void>;
}

const TIME_OPTIONS = TIMES_OF_DAY.map((value) => ({
  value,
  label: TIME_OF_DAY_LABEL[value],
  icon: TIME_OF_DAY_ICON[value],
}));

export function HabitForm({ initial, submitLabel, onSubmit }: HabitFormProps) {
  const today = useToday();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<HabitDraftErrors>({});
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      key === 'tracking'
        ? { ...current, tracking: undefined, unit: undefined, step: undefined }
        : { ...current, [key]: undefined },
    );
  };

  const submit = async () => {
    const nextErrors = validateHabitDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      await onSubmit(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Card style={styles.preview}>
        <HabitIcon icon={draft.icon} color={draft.color} size={48} />
        <View style={styles.previewText}>
          <AppText variant="heading" numberOfLines={1}>
            {draft.name.trim() || 'Novo hábito'}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[describeFrequency(draft.frequency, weekStartsOn), describeTarget(draft.tracking)]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </Card>

      <TextField
        label="Nome"
        value={draft.name}
        onChangeText={(name) => update('name', name)}
        placeholder="Ex: Beber água"
        maxLength={HABIT_NAME_MAX_LENGTH + 10}
        error={errors.name}
        autoFocus={initial.name === ''}
        returnKeyType="done"
      />

      <ColorPicker value={draft.color} onChange={(color) => update('color', color)} />
      <IconPicker
        value={draft.icon}
        color={draft.color}
        onChange={(icon) => update('icon', icon)}
      />

      <SegmentedControl<TimeOfDay>
        label="Momento do dia"
        options={TIME_OPTIONS}
        value={draft.timeOfDay}
        onChange={(timeOfDay) => update('timeOfDay', timeOfDay)}
      />

      <FrequencyPicker
        value={draft.frequency}
        onChange={(frequency) => update('frequency', frequency)}
        weekStartsOn={weekStartsOn}
        error={errors.frequency}
      />

      <TrackingPicker
        value={draft.tracking}
        onChange={(tracking) => update('tracking', tracking)}
        errors={errors}
      />

      <RemindersEditor
        value={draft.reminders}
        onChange={(reminders) => update('reminders', reminders)}
        error={errors.reminders}
      />

      <DateStepper
        label="Data de início"
        value={draft.startDate}
        today={today}
        onChange={(startDate) => update('startDate', startDate)}
        error={errors.startDate}
      />

      {hasErrors(errors) ? (
        <AppText tone={colors.danger} accessibilityLiveRegion="polite">
          Corrija os campos destacados acima.
        </AppText>
      ) : null}
      <Button label={saving ? 'Salvando…' : submitLabel} onPress={submit} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  preview: { flexDirection: 'row', alignItems: 'center' },
  previewText: { flex: 1 },
});
