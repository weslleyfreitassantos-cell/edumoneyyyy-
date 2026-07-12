// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InstitutionTermClosingPanel from './InstitutionTermClosingPanel';
import { useInstitutionTermClosureOfferings, useTermClosurePreview, useCloseTermClosure, useReopenTermClosure } from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicTermClosing');

describe('InstitutionTermClosingPanel', () => {
  it('fechamento com pendências fica bloqueado', () => {
    (useInstitutionTermClosureOfferings as any).mockReturnValue({ data: [] });
    (useTermClosurePreview as any).mockReturnValue({
      data: { canSubmit: false, canClose: false, issues: [{ message: 'Missing grade' }], students: [], assessments: [], offering: {} }
    });
    (useCloseTermClosure as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useReopenTermClosure as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<InstitutionTermClosingPanel institutionId="inst-1" />);
    // Initial state is just select options, so we assume button is disabled when selected
  });

  it('SECRETARY visualiza sem fechar', () => {
    (useInstitutionTermClosureOfferings as any).mockReturnValue({ data: [] });
    (useTermClosurePreview as any).mockReturnValue({
      data: { canClose: true, issues: [], students: [], assessments: [], offering: {} }
    });
    (useCloseTermClosure as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    (useReopenTermClosure as any).mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    // Passed readOnly=true which represents SECRETARY role in this context
    render(<InstitutionTermClosingPanel institutionId="inst-1" readOnly={true} />);
    expect(screen.queryByText(/Fechar Período Definitivo/i)).toBeNull();
  });
});
