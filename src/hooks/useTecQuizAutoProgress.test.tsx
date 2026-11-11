// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tick = vi.hoisted(() => vi.fn());

vi.mock('../services/tecQuizLiveService', () => ({
  tecQuizLiveService: { tick },
}));

import { useTecQuizAutoProgress } from './useTecQuizAutoProgress';

function setup(
  remaining: number | null,
  status: 'IN_PROGRESS' | 'INTERMISSION' = 'IN_PROGRESS',
  revealPaused = false,
  sync: { serverClockReady?: boolean; deadlineMissing?: boolean } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useTecQuizAutoProgress({
    gameId: 'game-1',
    status,
    questionIndex: 2,
    remaining,
    serverClockReady: sync.serverClockReady ?? true,
    deadlineMissing: sync.deadlineMissing ?? remaining === null,
    revealPaused,
  }), { wrapper });
}

describe('useTecQuizAutoProgress', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not tick before the server deadline', async () => {
    vi.useFakeTimers();
    setup(3);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });

    expect(tick).not.toHaveBeenCalled();
  });

  it('does not tick while the teacher has paused the reveal', async () => {
    vi.useFakeTimers();
    setup(0, 'INTERMISSION', true);

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

    expect(tick).not.toHaveBeenCalled();
  });

  it.each([
    ['expired question', 0, 'IN_PROGRESS'],
    ['expired reveal window', 0, 'INTERMISSION'],
  ] as const)('ticks the game after an automatic transition is due (%s)', async (_case, remaining, status) => {
    vi.useFakeTimers();
    tick.mockResolvedValue({
      game_id: 'game-1',
      status: status === 'INTERMISSION' ? 'FINISHED' : 'INTERMISSION',
      question_index: 2,
      round_deadline_at: null,
      reveal_started_at: null,
    });
    setup(remaining, status);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(tick).toHaveBeenCalledWith('game-1');
  });

  it('repairs a server-confirmed missing deadline', async () => {
    vi.useFakeTimers();
    tick.mockResolvedValue({
      game_id: 'game-1', status: 'IN_PROGRESS', question_index: 2,
      round_deadline_at: '2026-11-10T12:00:20.000Z', reveal_started_at: null,
    });
    setup(null, 'IN_PROGRESS', false, { serverClockReady: true, deadlineMissing: true });

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(tick).toHaveBeenCalledWith('game-1');
  });

  it('never ticks when the server clock is unavailable, even if the local display is expired', async () => {
    vi.useFakeTimers();
    setup(null, 'IN_PROGRESS', false, { serverClockReady: false, deadlineMissing: false });

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(tick).not.toHaveBeenCalled();
  });

  it('backs off automatic retries and stops after five failed attempts', async () => {
    vi.useFakeTimers();
    tick.mockRejectedValue(new Error('temporary network failure'));
    const { result } = setup(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(tick).toHaveBeenCalledTimes(1);
    expect(result.current.failedAttempts).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(tick).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(tick).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(tick).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(tick).toHaveBeenCalledTimes(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(tick).toHaveBeenCalledTimes(5);
    expect(result.current.failedAttempts).toBe(5);
    expect(result.current.isRetrying).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it('allows an immediate manual retry after automatic attempts stop', async () => {
    vi.useFakeTimers();
    tick.mockRejectedValue(new Error('temporary network failure'));
    const { result } = setup(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(result.current.failedAttempts).toBe(5);

    tick.mockResolvedValue({
      game_id: 'game-1',
      status: 'INTERMISSION',
      question_index: 2,
      round_deadline_at: null,
      reveal_started_at: null,
    });
    await act(async () => { result.current.retryNow(); });

    expect(tick).toHaveBeenCalledTimes(6);
    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
