import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { todayLocal, type LocalDate } from '@/core/dates/localDate';
import { TITLE_MAX_LENGTH, validateEventDraft } from '@/core/planner/planner';
import type { EventDraft, PlannerEvent } from '@/core/planner/types';
import { ColorPicker } from '@/features/habits/ColorPicker';
import { DateStepper } from '@/features/habits/DateStepper';
import { goBack } from '@/lib/navigation';
import { plannerActions, useEvent } from '@/stores/plannerStore';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { confirm, showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { TimeField } from '@/ui/TimeField';

/** Next round hour, e.g. 14:20 → "15:00". */
function nextHour(): string {
  const hour = Math.min(23, new Date().getHours() + 1);
  return `${String(hour).padStart(2, '0')}:00`;
}

export function NewEventScreen({ date }: { date: LocalDate }) {
  return (
    <EventForm
      initial={{
        title: '',
        date,
        startTime: nextHour(),
        endTime: null,
        color: 'blue',
        note: null,
      }}
    />
  );
}

export function EditEventScreen({ id }: { id: string }) {
  const event = useEvent(id);
  if (event === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="help-circle-outline" title="Carregando…" />
      </Screen>
    );
  }
  return <EventForm key={event.id} event={event} initial={event} />;
}

function EventForm({ event, initial }: { event?: PlannerEvent; initial: EventDraft }) {
  const [draft, setDraft] = useState<EventDraft>({
    title: initial.title,
    date: initial.date,
    startTime: initial.startTime,
    endTime: initial.endTime,
    color: initial.color,
    note: initial.note,
  });
  const [endText, setEndText] = useState(initial.endTime ?? '');
  const [errors, setErrors] = useState<Partial<Record<keyof EventDraft, string>>>({});

  const save = async () => {
    const next = { ...draft, endTime: endText.trim() ? endText : null };
    const validation = validateEventDraft(next);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    try {
      if (event) await plannerActions.updateEvent(event.id, next);
      else await plannerActions.createEvent(next);
      goBack();
    } catch (error) {
      showError('Não foi possível salvar o evento.', error);
    }
  };

  const remove = async () => {
    if (!event) return;
    const ok = await confirm({
      title: 'Excluir evento?',
      message: `"${event.title}" será removido.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await plannerActions.removeEvent(event.id);
      goBack();
    } catch (error) {
      showError('Não foi possível excluir o evento.', error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <TextField
        label="Título"
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
        placeholder="Ex: Consulta médica"
        maxLength={TITLE_MAX_LENGTH}
        error={errors.title}
        autoFocus={!event}
      />
      <DateStepper
        label="Dia"
        value={draft.date}
        today={todayLocal()}
        onChange={(date) => setDraft({ ...draft, date })}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TimeField
            label="Início"
            value={draft.startTime}
            onChange={(startTime) => setDraft({ ...draft, startTime })}
            error={errors.startTime}
          />
        </View>
        <View style={styles.flex}>
          <TimeField
            label="Fim (opcional)"
            value={endText}
            onChange={setEndText}
            placeholder="—"
            error={errors.endTime}
          />
        </View>
      </View>
      <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
      <TextField
        label="Observações (opcional)"
        value={draft.note ?? ''}
        onChangeText={(note) => setDraft({ ...draft, note })}
        multiline
        maxLength={500}
      />
      <View style={styles.actions}>
        <Button label={event ? 'Salvar' : 'Criar evento'} onPress={save} />
        {event ? (
          <Button variant="danger" icon="trash-can-outline" label="Excluir" onPress={remove} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
