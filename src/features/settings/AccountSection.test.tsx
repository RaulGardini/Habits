import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useSyncStore } from '@/stores/syncStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { confirm } from '@/ui/dialogs';

import { AccountSection } from './AccountSection';

jest.setTimeout(30_000);
jest.mock('@/ui/dialogs', () => ({ confirm: jest.fn(async () => true), showError: jest.fn() }));
jest.mock('@/lib/notifications', () => ({ cancelAllReminders: jest.fn(async () => undefined) }));
jest.mock('@/sync/client', () => ({ supabase: null, syncConfigured: true }));
jest.mock('@/lib/authStorage', () => ({ authStorage: {} }));

const resolveFirstSync = jest.fn(async () => undefined);

async function renderAsking() {
  useSyncStore.setState({
    configured: true,
    userId: 'u1',
    email: 'raul@example.com',
    status: 'idle',
    firstSync: { habits: 3, other: 12 },
    resolveFirstSync,
  });
  await render(
    <ThemeProvider>
      <AccountSection />
    </ThemeProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('asks what to do with the data created before signing in', async () => {
  await renderAsking();
  expect(screen.getByText('Esta conta já tem dados')).toBeTruthy();
  expect(screen.getByText(/já tinha 3 hábitos e 12 outros itens/)).toBeTruthy();
});

it('"keep only the account\'s" confirms before deleting this device\'s data', async () => {
  await renderAsking();
  jest.mocked(confirm).mockResolvedValueOnce(false);
  await fireEvent.press(screen.getByText('Usar só os da conta'));
  expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
  expect(resolveFirstSync).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Usar só os da conta'));
  expect(resolveFirstSync).toHaveBeenCalledWith('account');
});

it('"add them to the account" needs no confirmation (nothing is deleted)', async () => {
  await renderAsking();
  await fireEvent.press(screen.getByText('Juntar com a conta'));
  expect(confirm).not.toHaveBeenCalled();
  expect(resolveFirstSync).toHaveBeenCalledWith('merge');
});

it('shows nothing of this when there is no choice to make', async () => {
  await renderAsking();
  await act(() => useSyncStore.setState({ firstSync: null }));
  expect(await screen.findByText('Sincronizar agora')).toBeTruthy();
  expect(screen.queryByText('Esta conta já tem dados')).toBeNull();
});
