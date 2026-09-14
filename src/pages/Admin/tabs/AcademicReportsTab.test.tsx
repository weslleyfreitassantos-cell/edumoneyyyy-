// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicReportOptions } from '../../../hooks/useAcademicReports';
import { academicReportService } from '../../../services/academicReportService';
import AcademicReportsTab from './AcademicReportsTab';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../../hooks/useAcademicReports', () => ({ useAcademicReportOptions: vi.fn() }));
vi.mock('../../../services/academicReportService', () => ({
  academicReportService: { getAcademicResultsReport: vi.fn(), getEnrollmentReport: vi.fn(), getAttendanceReport: vi.fn() },
  getPreferredAcademicReportSelection: vi.fn((years) => years[0]?.terms[0] ? { academicYearId: years[0].id, termId: years[0].terms[0].id } : null),
}));

const options = {
  academicYears: [{ id: 'year-1', institutionId: 'institution-1', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, terms: [{ id: 'term-1', academicYearId: 'year-1', name: '2º Bimestre', startDate: '2026-04-01', endDate: '2026-06-30', active: true }] }],
  classes: [{ id: 'class-1', label: '2º A', academicYearId: 'year-1' }],
  subjects: [{ id: 'subject-1', label: 'Matemática', academicYearId: 'year-1', termId: 'term-1' }],
  students: [{ id: 'student-1', label: 'Maria Silva · 20260001' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'profile-1', full_name: 'Direção', email: 'director@example.com', role: 'DIRECTOR', platform_role: 'USER', avatar_url: null }, user: null, loading: false, signIn: vi.fn(), signOut: vi.fn() });
  vi.mocked(useCurrentInstitution).mockReturnValue({ data: 'institution-1', institution: null, membership: null, currentInstitution: { id: 'institution-1', name: 'Escola Centro', active: true, account_id: 'account-1' }, currentMembership: null, currentInstitutionId: 'institution-1', currentRole: 'DIRECTOR', isLoading: false, isError: false, error: null, message: null, refetch: vi.fn() });
  vi.mocked(useAcademicReportOptions).mockReturnValue({ data: options, isLoading: false, isError: false, error: null } as never);
});

afterEach(() => {
  cleanup();
});

describe('AcademicReportsTab', () => {
  it('exige turma, preserva snapshot e permite imprimir o resultado', async () => {
    vi.mocked(academicReportService.getAcademicResultsReport).mockResolvedValue([{
      id: 'row-1', studentName: 'Maria Silva', registrationNumber: '20260001', className: '2º A', subjectName: 'Matemática', teacherName: 'Prof. Ana', gradePercentage: 52, recoveryPercentage: 74, finalGradePercentage: 74, attendancePercentage: 90, resultStatus: 'APPROVED', dataStatus: 'OFFICIAL',
    }] as never);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MemoryRouter><AcademicReportsTab /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Gerar relatório' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Turma'), { target: { value: 'class-1' } });
    expect(screen.getByRole('button', { name: 'Gerar relatório' })).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar relatório' }));

    await waitFor(() => expect(screen.getByText('Resultado oficial')).toBeTruthy());
    expect(screen.getAllByText('74%').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('troca para matrículas e limpa filtros incompatíveis', async () => {
    render(<MemoryRouter><AcademicReportsTab /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Turma'), { target: { value: 'class-1' } });
    fireEvent.change(screen.getByLabelText('Tipo de relatório'), { target: { value: 'ENROLLMENTS' } });

    await waitFor(() => expect(screen.queryByLabelText('Período')).toBeNull());
    expect(screen.getByLabelText('Status da matrícula')).toBeTruthy();
    expect(screen.getByText('Selecione os filtros e gere um relatório.')).toBeTruthy();
  });
});
