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
    ['missing deadline', null, 'IN_PROGRESS'],
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
});
