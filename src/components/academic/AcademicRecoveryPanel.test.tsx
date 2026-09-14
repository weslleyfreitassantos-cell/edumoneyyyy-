// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AcademicRecoveryPanel from './AcademicRecoveryPanel';
import { useAcademicRecoveryCandidates, useCancelAcademicRecovery, useSaveAcademicRecovery } from '../../hooks/useAcademicRecovery';
import { useTeacherTermClosureOfferings } from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicRecovery', () => ({
  useAcademicRecoveryCandidates: vi.fn(),
  useCancelAcademicRecovery: vi.fn(),
  useSaveAcademicRecovery: vi.fn(),
}));

vi.mock('../../hooks/useAcademicTermClosing', () => ({
  useTeacherTermClosureOfferings: vi.fn(),
}));

describe('AcademicRecoveryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('mostra elegibilidade, prévia e ações de recuperação', () => {
    vi.mocked(useTeacherTermClosureOfferings).mockReturnValue({
      data: [{ id: 'offering-1', academicYearId: 'year-1', termId: 'term-1', subjectName: 'Matemática', className: '1A', termName: '1º bimestre', closure: { status: 'REOPENED' } }],
    } as never);
    vi.mocked(useAcademicRecoveryCandidates).mockReturnValue({
      data: [{
        student: { id: 'student-1', fullName: 'Ana Silva', registrationNumber: 'RA-1' },
        originalGradePercentage: 50,
        attendancePercentage: 90,
        originalResultStatus: 'FAILED_BY_GRADE',
        recovery: null,
        policy: { minimumGradePercentage: 60, minimumAttendancePercentage: 75, decimalPlaces: 1 },
        closureStatus: 'REOPENED',
      }],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useSaveAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useCancelAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);

    render(<AcademicRecoveryPanel profileId="teacher-1" institutionId="inst-1" />);

    expect(screen.getByText('Recuperação acadêmica')).toBeTruthy();
    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(screen.getByText('Média original')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' }).getAttribute('disabled')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Recuperação (%)'), { target: { value: '75' } });
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publicar recuperação' }).getAttribute('disabled')).toBeNull();
  });

  it('fica somente leitura quando o período está fechado', () => {
    vi.mocked(useTeacherTermClosureOfferings).mockReturnValue({
      data: [{ id: 'offering-1', academicYearId: 'year-1', termId: 'term-1', subjectName: 'Matemática', className: '1A', termName: '1º bimestre', closure: { status: 'CLOSED' } }],
    } as never);
    vi.mocked(useAcademicRecoveryCandidates).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useSaveAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useCancelAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);

    render(<AcademicRecoveryPanel profileId="teacher-1" institutionId="inst-1" />);

    expect(screen.getByText(/O período está fechado/)).toBeTruthy();
  });

  it('não oferece operação antes de um fechamento reaberto', () => {
    vi.mocked(useTeacherTermClosureOfferings).mockReturnValue({
      data: [{ id: 'offering-1', academicYearId: 'year-1', termId: 'term-1', subjectName: 'Matemática', className: '1A', termName: '1º bimestre', closure: null }],
    } as never);
    vi.mocked(useAcademicRecoveryCandidates).mockReturnValue({
      data: [{
        student: { id: 'student-1', fullName: 'Ana Silva', registrationNumber: 'RA-1' },
        originalGradePercentage: 50,
        attendancePercentage: 90,
        originalResultStatus: 'FAILED_BY_GRADE',
        recovery: null,
        policy: { minimumGradePercentage: 60, minimumAttendancePercentage: 75, decimalPlaces: 1 },
        closureStatus: 'OPEN',
      }],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useSaveAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useCancelAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);

    render(<AcademicRecoveryPanel profileId="teacher-1" institutionId="inst-1" />);

    expect(screen.getByText(/A recuperação ficará disponível/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' }).getAttribute('disabled')).not.toBeNull();
  });

  it('bloqueia o input quando a recuperação já foi publicada', () => {
    vi.mocked(useTeacherTermClosureOfferings).mockReturnValue({
      data: [{ id: 'offering-1', academicYearId: 'year-1', termId: 'term-1', subjectName: 'Matemática', className: '1A', termName: '1º bimestre', closure: { status: 'REOPENED' } }],
    } as never);
    vi.mocked(useAcademicRecoveryCandidates).mockReturnValue({
      data: [{
        student: { id: 'student-1', fullName: 'Ana Silva', registrationNumber: 'RA-1' },
        originalGradePercentage: 50,
        attendancePercentage: 90,
        originalResultStatus: 'FAILED_BY_GRADE',
        recovery: { id: 'recovery-1', recoveryPercentage: 75, status: 'PUBLISHED', notes: null },
        policy: { minimumGradePercentage: 60, minimumAttendancePercentage: 75, decimalPlaces: 1 },
        closureStatus: 'REOPENED',
      }],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useSaveAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useCancelAcademicRecovery).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as never);

    render(<AcademicRecoveryPanel profileId="teacher-1" institutionId="inst-1" />);

    expect(screen.getByLabelText('Recuperação (%)').getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Publicar recuperação' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  });
});
