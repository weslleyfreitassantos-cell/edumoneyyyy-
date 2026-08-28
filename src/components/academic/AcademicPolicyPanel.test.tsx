// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcademicPolicyPanel from './AcademicPolicyPanel';
import {
  useAcademicPolicy,
  useAcademicShiftSettings,
  useAcademicYears,
  useSaveAcademicPolicy,
  useSaveAcademicShiftSettings,
} from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicTermClosing');

describe('AcademicPolicyPanel', () => {
  it('SECRETARY visualiza somente', () => {
    (useAcademicYears as any).mockReturnValue({ data: [] });
    (useAcademicPolicy as any).mockReturnValue({ data: null });
    (useAcademicShiftSettings as any).mockReturnValue({
      data: ['MATUTINO'],
      isLoading: false,
      isError: false,
    });
    (useSaveAcademicPolicy as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useSaveAcademicShiftSettings as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false });

    // readOnly=true representa secretaria. O formulário deve estar desabilitado ou botão ausente.
    render(<AcademicPolicyPanel institutionId="inst-1" readOnly={true} />);
    const button = screen.queryByText(/Salvar Política/i);
    if (button) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    } else {
      expect(button).toBeNull();
    }
  });

  // percentual abaixo de zero é rejeitado - a UI (input max/min) + schema/hook barram isso
});
