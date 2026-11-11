// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTecQuizCountdown } from './useTecQuizCountdown';

describe('useTecQuizCountdown', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses server time instead of a client clock that is ahead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:05:00.000Z'));

    const { result } = renderHook(() => useTecQuizCountdown(
      '2026-11-10T12:00:20.000Z',
      '2026-11-10T12:00:00.000Z',
    ));

    expect(result.current).toBe(20);
    act(() => vi.advanceTimersByTime(1_250));
    expect(result.current).toBe(19);
  });

  it('keeps an expired server deadline at zero even when the client clock is behind', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T11:55:00.000Z'));

    const { result } = renderHook(() => useTecQuizCountdown(
      '2026-11-10T11:59:50.000Z',
      '2026-11-10T12:00:00.000Z',
    ));

    expect(result.current).toBe(0);
  });

  it('reproduces a false zero when server time is missing and the device clock is ahead, then blocks the fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:05:00.000Z'));

    const { result } = renderHook(() => useTecQuizCountdown(
      '2026-11-10T12:00:20.000Z',
      null,
    ));

    expect(result.current).toBeNull();
  });

  it('ignores local wall-clock changes and advances only on monotonic elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));

    const { result } = renderHook(() => useTecQuizCountdown(
      '2026-11-10T12:00:20.000Z',
      '2026-11-10T12:00:00.000Z',
    ));
    expect(result.current).toBe(20);

    act(() => vi.setSystemTime(new Date('2026-11-10T15:00:00.000Z')));
    expect(result.current).toBe(20);

    act(() => vi.advanceTimersByTime(1_250));
    expect(result.current).toBe(19);
  });

  it('freezes the reveal clock at the server pause time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:05:00.000Z'));

    const { result } = renderHook(() => useTecQuizCountdown(
      '2026-11-10T12:00:15.000Z',
      '2026-11-10T12:00:00.000Z',
      '2026-11-10T12:00:10.000Z',
    ));

    expect(result.current).toBe(5);
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current).toBe(5);
  });
});
