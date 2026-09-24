import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { ScreenErrorFallback } from './ErrorFallback';

jest.setTimeout(30_000);
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

let broken = true;

function Broken(): never {
  throw new Error('render failed');
}

// Same setup as src/app/_layout.tsx.
const routes = {
  _layout: {
    default: () => (
      <ThemeProvider>
        <Stack />
      </ThemeProvider>
    ),
    unstable_settings: { screenErrorBoundary: ScreenErrorFallback },
  },
  index: () => <Text>Tela Hoje</Text>,
  stats: () => (broken ? <Broken /> : <Text>Estatísticas</Text>),
};

beforeEach(() => {
  broken = true;
  // React reports every error caught by a boundary; this one is on purpose.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('replaces only the screen that crashed and can render it again', async () => {
  const { logError } = jest.requireMock<{ logError: jest.Mock }>('@/lib/log');
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('Tela Hoje')).toBeTruthy();

  await act(() => router.push('/stats'));
  expect(await screen.findByText('Algo deu errado')).toBeTruthy();
  expect(logError).toHaveBeenCalledWith('Screen crashed', expect.any(Error));

  broken = false;
  await fireEvent.press(screen.getByText('Tentar de novo'));
  expect(await screen.findByText('Estatísticas')).toBeTruthy();

  // The navigator survived: going back still works.
  await act(() => router.back());
  expect(await screen.findByText('Tela Hoje')).toBeTruthy();
});
