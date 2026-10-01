// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { classCouncilService } from '../services/classCouncilService';
import { useRemoveClassCouncilParticipant } from './useClassCouncils';

vi.mock('../services/classCouncilService', () => ({
  classCouncilService: {
    removeParticipant: vi.fn(),
  },
}));

describe('useRemoveClassCouncilParticipant', () => {
  it('removes the participant and invalidates the council detail query', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(classCouncilService.removeParticipant).mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRemoveClassCouncilParticipant(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ participantId: 'participant-1', councilId: 'council-1' });
    });

    expect(classCouncilService.removeParticipant).toHaveBeenCalledWith('participant-1');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['class-councils'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['class-council', 'council-1'] });
  });
});
