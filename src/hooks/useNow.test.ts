import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useNow, useToday } from './useNow';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 22, 23, 59, 40) });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useToday with the app open over midnight', () => {
  it('rolls over right at midnight, not up to a minute later', async () => {
    const { result } = await renderHook(() => useToday());
    expect(result.current).toBe('2026-09-22');
    await act(async () => {
      jest.advanceTimersByTime(19_000);
    }); // 23:59:59
    expect(result.current).toBe('2026-09-22');
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    }); // 00:00:00
    expect(result.current).toBe('2026-09-23');
  });

  it('catches up when the app returns from the background', async () => {
    let onChange: ((status: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      onChange = handler as (status: string) => void;
      return { remove: jest.fn() } as never;
    });
    const { result } = await renderHook(() => useToday());
    // Timers do not run while the app is suspended: the clock jumps to the next morning.
    jest.setSystemTime(new Date(2026, 8, 23, 7, 30));
    await act(async () => {
      onChange?.('active');
    });
    expect(result.current).toBe('2026-09-23');
  });
});

it('ticks on minute boundaries', async () => {
  const { result } = await renderHook(() => useNow());
  await act(async () => {
    jest.advanceTimersByTime(20_000);
  });
  expect(result.current.getMinutes()).toBe(0);
  expect(result.current.getSeconds()).toBe(0);
});
