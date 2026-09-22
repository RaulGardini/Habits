import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDaysLocal, formatShortDate, type LocalDate } from '@/core/dates/localDate';
import {
  newEventDraft,
  REMINDER_OPTIONS,
  reminderLabel,
  REPEAT_OPTIONS,
  repeatLabel,
  repeatShortLabel,
} from '@/core/planner/agenda';
import { minutesOf, TITLE_MAX_LENGTH, validateEventDraft } from '@/core/planner/planner';
import type { EventDraft, PlannerEvent } from '@/core/planner/types';
import { ColorPicker } from '@/features/habits/ColorPicker';
import { goBack } from '@/lib/navigation';
import { plannerActions, useEvent } from '@/stores/plannerStore';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { confirm, showError } from '@/ui/dialogs';
import { EmptyState } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { TimeField } from '@/ui/TimeField';
import { ToggleRow } from '@/ui/ToggleRow';

import { DatePickerField } from './DatePickerField';
import { t } from '@/i18n/i18n';

const DURATIONS = [30, 60, 90, 120] as const;

function addMinutes(time: string, minutes: number): string | null {
  const total = minutesOf(time) + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function NewEventScreen({ date, hour }: { date: LocalDate; hour?: number }) {
  return (
    <EventForm initial={newEventDraft(date, hour ?? Math.min(23, new Date().getHours() + 1))} />
  );
}

/** `date` = the occurrence that was opened (lets a series delete only that day). */
export function EditEventScreen({ id, date }: { id: string; date?: LocalDate }) {
  const event = useEvent(id);
  if (event === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState icon="calendar-search" title={t('Carregando…')} />
      </Screen>
    );
  }
  return <EventForm key={event.id} event={event} initial={event} occurrence={date} />;
}

function EventForm({
  event,
  initial,
  occurrence,
}: {
  event?: PlannerEvent;
  initial: EventDraft;
  occurrence?: LocalDate;
}) {
  const [draft, setDraft] = useState<EventDraft>(() => ({
    title: initial.title,
    date: initial.date,
    allDay: initial.allDay,
    startTime: initial.allDay ? '09:00' : initial.startTime,
    endTime: initial.endTime,
    location: initial.location,
    color: initial.color,
    note: initial.note,
    repeat: initial.repeat,
    repeatUntil: initial.repeatUntil,
    excludedDates: initial.excludedDates,
    reminderMinutes: initial.reminderMinutes,
  }));
  const [endText, setEndText] = useState(initial.endTime ?? '');
  const [errors, setErrors] = useState<Partial<Record<keyof EventDraft, string>>>({});
  const patch = (next: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...next }));
  const isSeries = event !== undefined && event.repeat !== 'none';

  const save = async () => {
    const next = { ...draft, endTime: draft.allDay || !endText.trim() ? null : endText };
    const validation = validateEventDraft(next);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    try {
      if (event) await plannerActions.updateEvent(event.id, next);
      else await plannerActions.createEvent(next);
      goBack();
    } catch (error) {
      showError(t('Não foi possível salvar o evento.'), error);
    }
  };

  const removeAll = async () => {
    if (!event) return;
    const ok = await confirm({
      title: isSeries ? t('Excluir toda a série?') : t('Excluir evento?'),
      message: isSeries
        ? t('Todas as repetições de "{title}" serão removidas.', { title: event.title })
        : t('"{title}" será removido.', { title: event.title }),
      confirmLabel: t('Excluir'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await plannerActions.removeEvent(event.id);
      goBack();
    } catch (error) {
      showError(t('Não foi possível excluir o evento.'), error);
    }
  };

  const removeOne = async () => {
    if (!event || !occurrence) return;
    const ok = await confirm({
      title: t('Excluir só este dia?'),
      message: t('"{title}" continua nos outros dias.', { title: event.title }),
      confirmLabel: t('Excluir este dia'),
      destructive: true,
    });
    if (!ok) return;
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = event;
      await plannerActions.updateEvent(event.id, {
        ...rest,
        excludedDates: [...event.excludedDates, occurrence],
      });
      goBack();
    } catch (error) {
      showError(t('Não foi possível excluir o evento.'), error);
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <TextField
        label={t('Título')}
        value={draft.title}
        onChangeText={(title) => patch({ title })}
        placeholder={t('Ex: Consulta médica')}
        maxLength={TITLE_MAX_LENGTH}
        error={errors.title}
        autoFocus={!event}
      />

      <Card>
        <DatePickerField
          label={draft.repeat === 'none' ? t('Dia') : t('Começa em')}
          value={draft.date}
          onChange={(date) => patch({ date })}
        />
        <ToggleRow
          label={t('Dia inteiro')}
          icon="weather-sunny"
          value={draft.allDay}
          onChange={(allDay) => patch({ allDay })}
        />
        {draft.allDay ? null : (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <TimeField
                  label={t('Início')}
                  value={draft.startTime}
                  onChange={(startTime) => patch({ startTime })}
                  error={errors.startTime}
                />
              </View>
              <View style={styles.flex}>
                <TimeField
                  label={t('Fim (opcional)')}
                  value={endText}
                  onChange={setEndText}
                  placeholder="—"
                  error={errors.endTime}
                />
              </View>
            </View>
            <View style={styles.chips}>
              {DURATIONS.map((minutes) => {
                const end = addMinutes(draft.startTime, minutes);
                if (!end) return null;
                return (
                  <Chip
                    key={minutes}
                    label={
                      minutes < 60 ? `${minutes} min` : `${minutes / 60} h`.replace('.5', ',5')
                    }
                    accessibilityLabel={t('Duração de {minutes} minutos', { minutes })}
                    selected={endText === end}
                    onPress={() => setEndText(end)}
                  />
                );
              })}
            </View>
          </>
        )}
      </Card>

      <TextField
        label={t('Local (opcional)')}
        value={draft.location ?? ''}
        onChangeText={(location) => patch({ location })}
        placeholder={t('Ex: Clínica, Google Meet…')}
        maxLength={200}
      />

      <Card>
        <AppText variant="label" tone="muted">
          {t('Repetir')}
        </AppText>
        <View style={styles.chips}>
          {REPEAT_OPTIONS.map((repeat) => (
            <Chip
              key={repeat}
              label={repeatShortLabel(repeat)}
              accessibilityLabel={repeatLabel(repeat, draft.date)}
              selected={draft.repeat === repeat}
              onPress={() => patch({ repeat })}
            />
          ))}
        </View>
        {draft.repeat !== 'none' ? (
          <>
            <AppText tone="muted">{repeatLabel(draft.repeat, draft.date)}</AppText>
            <ToggleRow
              label={t('Termina em uma data')}
              icon="calendar-end"
              value={draft.repeatUntil !== null}
              onChange={(on) => patch({ repeatUntil: on ? addDaysLocal(draft.date, 30) : null })}
            />
            {draft.repeatUntil !== null ? (
              <DatePickerField
                label={t('Último dia')}
                value={draft.repeatUntil}
                minDate={draft.date}
                onChange={(repeatUntil) => patch({ repeatUntil })}
                error={errors.repeatUntil}
              />
            ) : null}
            {draft.excludedDates.length > 0 ? (
              <View style={styles.excluded}>
                <AppText variant="caption" tone="muted" style={styles.flex}>
                  {draft.excludedDates.length === 1
                    ? t('Sem o dia {date}', {
                        date: formatShortDate(draft.excludedDates[0] ?? draft.date),
                      })
                    : t('{count} dias removidos da série', {
                        count: draft.excludedDates.length,
                      })}
                </AppText>
                <Button
                  variant="ghost"
                  label={t('Restaurar')}
                  onPress={() => patch({ excludedDates: [] })}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <AppText variant="label" tone="muted">
          {t('Lembrete')}
        </AppText>
        <View style={styles.chips}>
          {REMINDER_OPTIONS.map((minutes) => (
            <Chip
              key={String(minutes)}
              label={reminderLabel(minutes, draft.allDay)}
              selected={draft.reminderMinutes === minutes}
              onPress={() => patch({ reminderMinutes: minutes })}
            />
          ))}
        </View>
        <AppText variant="caption" tone="muted">
          {t('Notificação no celular (no navegador os lembretes não disparam).')}
        </AppText>
      </Card>

      <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />

      <TextField
        label={t('Observações (opcional)')}
        value={draft.note ?? ''}
        onChangeText={(note) => patch({ note })}
        multiline
        maxLength={1000}
      />

      <View style={styles.actions}>
        <Button icon="check" label={event ? t('Salvar') : t('Criar evento')} onPress={save} />
        {isSeries && occurrence ? (
          <Button
            variant="secondary"
            icon="calendar-remove-outline"
            label={t('Excluir só este dia')}
            onPress={removeOne}
          />
        ) : null}
        {event ? (
          <Button
            variant="danger"
            icon="trash-can-outline"
            label={isSeries ? t('Excluir toda a série') : t('Excluir')}
            onPress={removeAll}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  excluded: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
