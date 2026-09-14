// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useStudentAcademicRecord } from '../../../hooks/useStudentAcademicRecord';
import StudentAcademicRecordTab from './StudentAcademicRecordTab';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../../hooks/useStudentAcademicRecord', () => ({ useStudentAcademicRecord: vi.fn() }));

const record = {
  student: {
    id: 'student-1', institutionId: 'institution-1', name: 'Ana Silva', email: 'ana@example.com', phone: '(00) 99999-0000', registrationNumber: '20260012', birthDate: '2010-05-10', cpf: '000.000.000-00', active: true,
    details: { social_name: 'Ana S.' }, address: { postalCode: null, street: 'Rua A', number: '10', complement: null, neighborhood: 'Centro', city: 'Salvador', state: 'BA' },
    guardians: [{ profileId: 'guardian-1', name: 'Maria Silva', email: 'maria@example.com', phone: null, relationship: 'Mãe', primary: true }],
    enrollments: [{ id: 'enrollment-1', classId: 'class-1', className: '2º A', gradeLevel: '2º ano', shift: 'Matutino', academicYearId: 'year-1', academicYearName: '2026', status: 'ACTIVE', active: true, enrolledAt: '2026-02-01' }],
    currentEnrollment: { id: 'enrollment-1', classId: 'class-1', className: '2º A', gradeLevel: '2º ano', shift: 'Matutino', academicYearId: 'year-1', academicYearName: '2026', status: 'ACTIVE', active: true, enrolledAt: '2026-02-01' },
  },
  academicYears: [{ id: 'year-1', institutionId: 'institution-1', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, terms: [{ id: 'term-1', academicYearId: 'year-1', name: '1º Bimestre', startDate: '2026-01-01', endDate: '2026-04-01', active: true }] }],
  selectedAcademicYearId: 'year-1', selectedTermId: 'term-1',
  reportCard: { institutionId: 'institution-1', studentId: 'student-1', closedCount: 1, openCount: 0, subjects: [{ key: 'offering-1:term-1', institutionId: 'institution-1', academicYearId: 'year-1', academicYearName: '2026', termId: 'term-1', termName: '1º Bimestre', subjectOfferingId: 'offering-1', subjectName: 'Matemática', subjectCode: null, className: '2º A', teacherName: 'Prof. Ana', teacherEmail: 'prof@example.com', gradePercentage: 52, recoveryPercentage: 74, finalGradePercentage: 74, originalResultStatus: 'FAILED_BY_GRADE', compositionRule: null, attendancePercentage: 90, resultStatus: 'APPROVED', finalizedAt: '2026-05-01T00:00:00Z', isClosed: true, assessments: [{ id: 'assessment-1', title: 'Prova 1', assessmentType: 'TEST', assessmentDate: '2026-03-01', maxScore: 10, weight: 1, score: 7.4, status: 'GRADED', percentage: 74, feedback: null }] }] },
  attendance: { summary: { totalRecords: 1, presentRecords: 1, absentRecords: 0, lateRecords: 0, excusedRecords: 0, attendanceRate: 100 }, records: [], recentRecords: [] },
  monitoring: { studentId: 'student-1', fullName: 'Ana Silva', registrationNumber: '20260012', classId: 'class-1', className: '2º A', averageGrade: 74, attendancePercentage: 90, pendingItems: 1, lowPerformanceSubjects: 1, lowAttendanceSubjects: 0, dataStatus: 'OFFICIAL', risk: { level: 'ATTENTION', reasons: ['1 disciplina abaixo da média.'] }, subjects: [] },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'profile-1', full_name: 'Direção', email: 'director@example.com', role: 'DIRECTOR', platform_role: 'USER', avatar_url: null }, user: null, loading: false, signIn: vi.fn(), signOut: vi.fn() });
  vi.mocked(useCurrentInstitution).mockReturnValue({ data: 'institution-1', institution: null, membership: null, currentInstitution: null, currentMembership: null, currentInstitutionId: 'institution-1', currentRole: 'DIRECTOR', isLoading: false, isError: false, error: null, message: null, refetch: vi.fn() });
  vi.mocked(useStudentAcademicRecord).mockReturnValue({ data: record, isLoading: false, isError: false, error: null } as never);
});

afterEach(() => cleanup());

describe('StudentAcademicRecordTab', () => {
  it('apresenta contexto, recuperação, risco, responsáveis e matrícula', () => {
    render(<MemoryRouter initialEntries={['/admin?module=student-record&student=student-1']}><StudentAcademicRecordTab /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Ana Silva' })).toBeTruthy();
    expect(screen.getByText('2º A · 2º ano · Matutino · 2026')).toBeTruthy();
    expect(screen.getAllByText('74%').length).toBeGreaterThan(0);
    expect(screen.getByText('1 disciplina abaixo da média.')).toBeTruthy();
    expect(screen.getByText('Original', { exact: false })).toBeTruthy();
    expect(screen.getByText('Maria Silva · Principal')).toBeTruthy();
    expect(screen.getAllByText('Resultado oficial').length).toBeGreaterThan(0);
  });

  it('mantém um período selecionado e mostra valores parciais do monitoramento', () => {
    const partialRecord = {
      ...record,
      selectedTermId: 'term-1',
      reportCard: {
        ...record.reportCard,
        closedCount: 0,
        openCount: 2,
        subjects: [
          {
            ...record.reportCard.subjects[0],
            subjectName: 'Matemática',
            gradePercentage: 68,
            recoveryPercentage: null,
            finalGradePercentage: 68,
            attendancePercentage: null,
            resultStatus: 'PENDING' as const,
            finalizedAt: null,
            isClosed: false,
          },
          {
            ...record.reportCard.subjects[0],
            key: 'offering-2:term-2',
            subjectOfferingId: 'offering-2',
            subjectName: 'História',
            termId: 'term-2',
            termName: '2º Bimestre',
          },
        ],
      },
      monitoring: {
        ...record.monitoring!,
        averageGrade: 68,
        attendancePercentage: 92,
        pendingItems: 0,
        dataStatus: 'PARTIAL' as const,
        risk: { level: 'NORMAL' as const, reasons: [] },
        subjects: [{
          subjectOfferingId: 'offering-1',
          subjectId: 'subject-1',
          subjectName: 'Matemática',
          classId: 'class-1',
          className: '2º A',
          teacherProfileId: 'teacher-1',
          teacherName: 'Prof. Ana',
          gradePercentage: 68,
          attendancePercentage: 92,
          pendingItems: 0,
          isClosed: false,
          dataStatus: 'PARTIAL' as const,
        }],
      },
    };
    vi.mocked(useStudentAcademicRecord).mockReturnValue({ data: partialRecord, isLoading: false, isError: false, error: null } as never);

    render(<MemoryRouter initialEntries={['/admin?module=student-record&student=student-1']}><StudentAcademicRecordTab /></MemoryRouter>);

    expect(screen.queryByRole('option', { name: 'Todos os períodos' })).toBeNull();
    expect((screen.getByLabelText('Período') as HTMLSelectElement).value).toBe('term-1');
    expect(screen.getByText('Média parcial')).toBeTruthy();
    expect(screen.getByText('Frequência parcial')).toBeTruthy();
    expect(screen.getAllByText('68%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('92%').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'História' })).toBeNull();
  });

  it('mostra estado seguro quando o student id não está presente', () => {
    render(<MemoryRouter initialEntries={['/admin?module=student-record']}><StudentAcademicRecordTab /></MemoryRouter>);

    expect(screen.getByText('Selecione um aluno para visualizar o prontuário acadêmico.')).toBeTruthy();
    expect(useStudentAcademicRecord).toHaveBeenCalledWith('institution-1', null, {
      academicYearId: undefined,
      termId: undefined,
    });
  });

  it('encaminha para documentos acadêmicos com o aluno selecionado', () => {
    render(<MemoryRouter initialEntries={['/admin?module=student-record&student=student-1']}><StudentAcademicRecordTab /><LocationProbe /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Documentos acadêmicos' }));
    expect(screen.getByTestId('location-search').textContent).toContain('module=academic-documents');
    expect(screen.getByTestId('location-search').textContent).toContain('student=student-1');
  });
});
