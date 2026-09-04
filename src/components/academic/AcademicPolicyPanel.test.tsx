// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AcademicPolicyPanel from './AcademicPolicyPanel';
import {
  useAcademicPolicy,
  useAcademicShiftSettings,
  useAcademicYears,
  useSchoolScheduleBreaks,
  useSaveAcademicPolicy,
  useSaveSchoolScheduleBreaks,
  useSaveAcademicShiftSettings,
} from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicTermClosing');

afterEach(() => {
  cleanup();
});

describe('AcademicPolicyPanel', () => {
  it('SECRETARY visualiza somente', () => {
    (useAcademicYears as any).mockReturnValue({ data: [] });
    (useAcademicPolicy as any).mockReturnValue({ data: null });
    (useAcademicShiftSettings as any).mockReturnValue({
      data: ['MATUTINO'],
      isLoading: false,
      isError: false,
    });
    (useSchoolScheduleBreaks as any).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    (useSaveAcademicPolicy as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useSaveAcademicShiftSettings as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });
    (useSaveSchoolScheduleBreaks as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });

    // readOnly=true representa secretaria. O formulário deve estar desabilitado ou botão ausente.
    render(<AcademicPolicyPanel institutionId="inst-1" readOnly={true} />);
    const button = screen.queryByText(/Salvar Política/i);
    if (button) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    } else {
      expect(button).toBeNull();
    }
  });

  it('edita os bloqueios por semana e expande os dias ao salvar', async () => {
    const saveBreaks = vi.fn().mockResolvedValue([]);
    (useAcademicYears as any).mockReturnValue({ data: [] });
    (useAcademicPolicy as any).mockReturnValue({ data: null });
    (useAcademicShiftSettings as any).mockReturnValue({
      data: ['INTEGRAL'],
      isLoading: false,
      isError: false,
    });
    (useSchoolScheduleBreaks as any).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    (useSaveAcademicPolicy as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useSaveAcademicShiftSettings as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });
    (useSaveSchoolScheduleBreaks as any).mockReturnValue({ mutateAsync: saveBreaks, isPending: false, isError: false });

    render(<AcademicPolicyPanel institutionId="inst-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar sugestão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Integral' }));

    await waitFor(() => expect(saveBreaks).toHaveBeenCalledTimes(1));
    const input = saveBreaks.mock.calls[0][0];

    expect(input.breaks).toHaveLength(15);
    expect(input.breaks).toEqual(expect.arrayContaining([
      { day_of_week: 1, name: 'Intervalo', start_time: '10:30', end_time: '10:50' },
      { day_of_week: 5, name: 'Almoço', start_time: '11:40', end_time: '13:00' },
      { day_of_week: 3, name: 'Intervalo', start_time: '14:40', end_time: '14:50' },
    ]));
  });

  it('consolida bloqueios iguais de segunda a sexta na mesma linha', async () => {
    const blocks = [
      { name: 'Intervalo', start_time: '10:30', end_time: '10:50' },
      { name: 'Almoço', start_time: '11:40', end_time: '13:00' },
      { name: 'Intervalo', start_time: '14:40', end_time: '14:50' },
    ].flatMap((block) =>
      [1, 2, 3, 4, 5].map((day_of_week) => ({
        id: `${block.name}-${day_of_week}-${block.start_time}`,
        institution_id: 'inst-1',
        shift: 'INTEGRAL',
        day_of_week,
        ...block,
        active: true,
      })),
    );

    (useAcademicYears as any).mockReturnValue({ data: [] });
    (useAcademicPolicy as any).mockReturnValue({ data: null });
    (useAcademicShiftSettings as any).mockReturnValue({
      data: ['INTEGRAL'],
      isLoading: false,
      isError: false,
    });
    (useSchoolScheduleBreaks as any).mockReturnValue({
      data: blocks,
      isLoading: false,
      isError: false,
    });
    (useSaveAcademicPolicy as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useSaveAcademicShiftSettings as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });
    (useSaveSchoolScheduleBreaks as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });

    render(<AcademicPolicyPanel institutionId="inst-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remover intervalo/ })).toHaveLength(3);
    });
    expect((screen.getByLabelText('Segunda para o intervalo 1') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Sábado para o intervalo 1') as HTMLInputElement).checked).toBe(false);
  });

  // percentual abaixo de zero é rejeitado - a UI (input max/min) + schema/hook barram isso
});
