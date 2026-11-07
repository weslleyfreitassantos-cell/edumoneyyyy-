import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tecQuizLiveService, type TecQuizGameState } from '../services/tecQuizLiveService';

type UseTecQuizAutoProgressOptions = {
  gameId: string | null | undefined;
  status: TecQuizGameState['status'] | undefined;
  questionIndex: number | undefined;
  remaining: number | null;
  revealPaused: boolean;
};

export function useTecQuizAutoProgress({
  gameId,
  status,
  questionIndex,
  remaining,
  revealPaused,
}: UseTecQuizAutoProgressOptions) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    mutationFn: () => tecQuizLiveService.tick(gameId!),
    onSuccess: () => {
      if (gameId) {
        void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
      }
    },
  });

  useEffect(() => {
    if (
      !gameId
      || (status !== 'IN_PROGRESS' && status !== 'INTERMISSION')
      || (status === 'INTERMISSION' && revealPaused)
      || (remaining !== null && remaining > 0)
      || isPending
    ) return undefined;

    const timeout = window.setTimeout(() => mutate(), 1000);
    return () => window.clearTimeout(timeout);
  }, [gameId, isPending, mutate, questionIndex, remaining, revealPaused, status]);
}
