import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tecQuizLiveService, type TecQuizGameState } from '../services/tecQuizLiveService';

const MAX_AUTO_PROGRESS_ATTEMPTS = 5;

type UseTecQuizAutoProgressOptions = {
  gameId: string | null | undefined;
  status: TecQuizGameState['status'] | undefined;
  questionIndex: number | undefined;
  remaining: number | null;
  serverClockReady: boolean;
  deadlineMissing: boolean;
  revealPaused: boolean;
};

export function useTecQuizAutoProgress({
  gameId,
  status,
  questionIndex,
  remaining,
  serverClockReady,
  deadlineMissing,
  revealPaused,
}: UseTecQuizAutoProgressOptions) {
  const queryClient = useQueryClient();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastError, setLastError] = useState<unknown>(null);
  const previousGameId = useRef(gameId);
  const { isPending, mutate } = useMutation({
    mutationFn: () => tecQuizLiveService.tick(gameId!),
    onSuccess: () => {
      setFailedAttempts(0);
      setLastError(null);
      if (gameId) {
        void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
      }
    },
    onError: (error: unknown) => {
      setFailedAttempts((attempts) => attempts + 1);
      setLastError(error);
    },
  });

  useEffect(() => {
    if (previousGameId.current === gameId) return;
    previousGameId.current = gameId;
    setFailedAttempts(0);
    setLastError(null);
  }, [gameId]);

  const retryNow = () => {
    setFailedAttempts(0);
    setLastError(null);
    mutate();
  };
  const autoRetryStopped = failedAttempts >= MAX_AUTO_PROGRESS_ATTEMPTS;
  const retryDelay = lastError
    ? Math.min(1000 * (2 ** Math.max(0, failedAttempts - 1)), 16_000)
    : 1000;

  useEffect(() => {
    if (
      !gameId
      || (status !== 'IN_PROGRESS' && status !== 'INTERMISSION')
      || (status === 'INTERMISSION' && revealPaused)
      || !serverClockReady
      || (remaining === null && !deadlineMissing)
      || (remaining !== null && remaining > 0)
      || isPending
      || autoRetryStopped
    ) return undefined;

    const timeout = window.setTimeout(() => mutate(), retryDelay);
    return () => window.clearTimeout(timeout);
  }, [autoRetryStopped, deadlineMissing, failedAttempts, gameId, isPending, mutate, questionIndex, remaining, retryDelay, revealPaused, serverClockReady, status]);

  return {
    error: lastError,
    failedAttempts,
    isRetrying: lastError !== null && !autoRetryStopped,
    retryNow,
    maxAttempts: MAX_AUTO_PROGRESS_ATTEMPTS,
  };
}
