import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { authenticate } from '@/lib/localAuth';
import { useAppLockStore } from '@/stores/appLockStore';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AppLockGate } from './AppLockGate';

jest.setTimeout(30_000);
jest.mock('@/lib/localAuth', () => ({
  canLockApp: jest.fn(async () => true),
  authenticate: jest.fn(async () => false),
}));

const renderGate = () =>
  render(
    <ThemeProvider>
      <AppLockGate>
        <Text>Meus hábitos secretos</Text>
      </AppLockGate>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

it('hides the app while locked and asks to unlock right away', async () => {
  useAppLockStore.setState({ available: true, enabled: true, locked: true });
  await renderGate();
  expect(await screen.findByText('O app está bloqueado.')).toBeTruthy();
  expect(authenticate).toHaveBeenCalledTimes(1);
  // The content is still mounted underneath, but hidden from screen readers.
  expect(screen.queryByText('Meus hábitos secretos')).toBeNull();
  expect(screen.getByText('Meus hábitos secretos', { includeHiddenElements: true })).toBeTruthy();

  jest.mocked(authenticate).mockResolvedValueOnce(true);
  await fireEvent.press(screen.getByText('Desbloquear'));
  expect(await screen.findByText('Meus hábitos secretos')).toBeTruthy();
  expect(screen.queryByText('O app está bloqueado.')).toBeNull();
});

it('shows the app normally when the lock is off', async () => {
  useAppLockStore.setState({ available: true, enabled: false, locked: false });
  await renderGate();
  expect(await screen.findByText('Meus hábitos secretos')).toBeTruthy();
  expect(authenticate).not.toHaveBeenCalled();
});

it('covers the content in the app switcher when the lock is on', async () => {
  let onChange: ((status: string) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    onChange = handler as (status: string) => void;
    return { remove: jest.fn() } as never;
  });
  useAppLockStore.setState({ available: true, enabled: true, locked: false });
  await renderGate();
  expect(await screen.findByText('Meus hábitos secretos')).toBeTruthy();

  await act(async () => onChange?.('inactive'));
  expect(screen.queryByText('Meus hábitos secretos')).toBeNull();
  await act(async () => onChange?.('active'));
  expect(screen.getByText('Meus hábitos secretos')).toBeTruthy();
});
