import { useEffect, useRef, useState } from 'react';

import type { LocalDate } from '@/core/dates/localDate';
import { plannerActions, useDayNote } from '@/stores/plannerStore';
import { AppText } from '@/ui/AppText';
import { TextField } from '@/ui/TextField';

const SAVE_DELAY_MS = 800;
export const DAY_NOTE_MAX_LENGTH = 5000;

/** Free-form journal of the day, autosaved while typing. */
export function DayNoteEditor({ date }: { date: LocalDate }) {
  const note = useDayNote(date);
  if (note === undefined) return null; // loading
  return <Editor key={date} date={date} initial={note?.content ?? ''} />;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: ' ',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Não foi possível salvar',
};

function Editor({ date, initial }: { date: LocalDate; initial: string }) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const toSave = pending.current;
    pending.current = null;
    if (toSave === null) return;
    setStatus('saving');
    plannerActions
      .saveDayNote(date, toSave)
      .then(() => setStatus('saved'))
      .catch((error: unknown) => {
        console.error('Failed to save day note', error);
        setStatus('error');
      });
  };

  // Save whatever is pending when leaving the day or the screen (the editor is keyed by date).
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  const onChange = (value: string) => {
    setText(value);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return (
    <>
      <TextField
        label="Notas do dia"
        value={text}
        onChangeText={onChange}
        onBlur={flush}
        placeholder="Como foi o seu dia? Ideias, gratidão, aprendizados…"
        multiline
        maxLength={DAY_NOTE_MAX_LENGTH}
      />
      <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">
        {STATUS_TEXT[status]}
      </AppText>
    </>
  );
}
