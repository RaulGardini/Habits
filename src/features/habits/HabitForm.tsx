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
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';

import { ColorPicker } from './ColorPicker';
import { DateStepper } from './DateStepper';
import { HabitIcon } from './HabitIcon';
import { IconPicker } from './IconPicker';
import { TIME_OF_DAY_ICON, TIME_OF_DAY_LABEL } from './labels';

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
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<HabitDraftErrors>({});
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
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
        <AppText variant="heading" numberOfLines={1} style={styles.previewName}>
          {draft.name.trim() || 'Novo hábito'}
        </AppText>
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

      <DateStepper
        label="Data de início"
        value={draft.startDate}
        today={today}
        onChange={(startDate) => update('startDate', startDate)}
        error={errors.startDate}
      />

      <Button label={saving ? 'Salvando…' : submitLabel} onPress={submit} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  preview: { flexDirection: 'row', alignItems: 'center' },
  previewName: { flex: 1 },
});
