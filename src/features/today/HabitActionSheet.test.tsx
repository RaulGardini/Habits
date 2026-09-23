import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeHabit } from '@/core/habits/testing';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { HabitActionSheet } from './HabitActionSheet';

// The first render loads the whole UI kit (icons, fonts…), slow on a busy machine.
jest.setTimeout(30_000);

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function renderSheet(habit = makeHabit()) {
  const onSave = jest.fn();
  const onTimerToggle = jest.fn();
  const onClose = jest.fn();
  const target = {
    habit,
    date: '2026-09-23',
    entry: undefined,
    quota: null,
    streak: undefined,
    timerSeconds: 0,
    running: false,
  };
  return {
    onSave,
    onTimerToggle,
    onClose,
    view: await render(
      <ThemeProvider>
        <HabitActionSheet
          target={target}
          date="2026-09-23"
          onClose={onClose}
          onSave={onSave}
          onTimerToggle={onTimerToggle}
        />
      </ThemeProvider>,
    ),
  };
}

it('saves once when "Concluir" is tapped twice quickly', async () => {
  const { onSave } = await renderSheet();
  const button = await screen.findByText('Concluir');
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'habit-1' }), {
    status: 'done',
    value: null,
    note: null,
  });
});

it('ignores a second, different action while the sheet closes', async () => {
  const { onSave } = await renderSheet();
  await fireEvent.press(await screen.findByText('Concluir'));
  await fireEvent.press(await screen.findByText('Pular hoje'));
  expect(onSave).toHaveBeenCalledTimes(1);
});

it('toggles a timer once on a double tap', async () => {
  const { onTimerToggle } = await renderSheet(
    makeHabit({ tracking: { type: 'timer', targetSeconds: 600 } }),
  );
  const button = await screen.findByText('Iniciar timer');
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(onTimerToggle).toHaveBeenCalledTimes(1);
});
