// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  useAcademicDocumentStudent,
  useAcademicDocumentStudents,
} from '../../../hooks/useAcademicDocuments';
import { formatLocalIssueDate } from '../../../components/documents/AcademicDocumentPreview';
import type { AcademicDocumentStudent } from '../../../services/academicDocumentService';

import AcademicDocumentsTab from './AcademicDocumentsTab';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../../hooks/useAcademicDocuments', () => ({
  useAcademicDocumentStudent: vi.fn(),
  useAcademicDocumentStudents: vi.fn(),
}));

const student: AcademicDocumentStudent = {
  id: 'student-1',
  institutionId: 'institution-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '(00) 99999-0000',
  registrationNumber: '20260001',
  birthDate: '2010-05-10',
  cpf: '000.000.000-00',
  active: true,
  details: { sex: 'Feminino', nationality: 'Brasileira' },
  address: null,
  guardians: [{
    profileId: 'guardian-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    phone: null,
    relationship: 'Mãe',
    primary: true,
  }],
  enrollments: [{
    id: 'enrollment-1',
    classId: 'class-1',
    className: '1º A',
    gradeLevel: '1º ano',
    shift: 'Matutino',
    academicYearId: 'year-1',
    academicYearName: '2026',
    status: 'ACTIVE',
    active: true,
    enrolledAt: '2026-02-01',
  }],
  currentEnrollment: null,
};

function mockState(selected: AcademicDocumentStudent | null = student) {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    profile: { id: 'profile-1', full_name: 'Direção', email: 'director@example.com', role: 'DIRECTOR', platform_role: 'USER', avatar_url: null },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: 'institution-1',
    institution: { id: 'institution-1', name: 'Escola Centro', active: true, account_id: 'account-1' },
    membership: null,
    currentInstitution: { id: 'institution-1', name: 'Escola Centro', active: true, account_id: 'account-1' },
    currentMembership: null,
    currentInstitutionId: 'institution-1',
    currentRole: 'DIRECTOR',
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    refetch: vi.fn(),
  });
  vi.mocked(useAcademicDocumentStudents).mockReturnValue({
    data: [{ id: 'student-1', name: 'Ana Silva', email: 'ana@example.com', registrationNumber: '20260001', cpf: '000.000.000-00', active: true }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useAcademicDocumentStudent).mockImplementation((_institutionId, studentId) => ({
    data: studentId ? selected : undefined,
    isLoading: false,
    isError: false,
    error: null,
  } as never));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState();
});

afterEach(() => {
  cleanup();
});

describe('AcademicDocumentsTab', () => {
  it('seleciona aluno, mostra declaração e encaminha para impressão', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const currentStudent = { ...student, currentEnrollment: student.enrollments[0] ?? null };
    mockState(currentStudent);

    render(<AcademicDocumentsTab />);
    fireEvent.click(screen.getByRole('button', { name: /Ana Silva/ }));

    expect(screen.getByRole('heading', { name: 'Declaração de matrícula' })).toBeTruthy();
    expect(screen.getByText('1º A')).toBeTruthy();
    expect(screen.getByText('Matutino')).toBeTruthy();
    expect(screen.getByText('Data da matrícula')).toBeTruthy();
    expect(screen.getByTestId('academic-document-preview').classList.contains('academic-document-printable')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Imprimir documento/ }));
    expect(print).toHaveBeenCalledTimes(1);

    print.mockRestore();
  });

  it('calcula a data de emissão com a data civil local sem serializar para UTC', () => {
    const date = new Date(2026, 8, 14, 22, 0, 0);
    const toISOString = vi.spyOn(Date.prototype, 'toISOString');

    expect(formatLocalIssueDate(date)).toBe(new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date));
    expect(toISOString).not.toHaveBeenCalled();

    toISOString.mockRestore();
  });

  it('mantém ficha disponível sem matrícula e bloqueia declaração', () => {
    render(<AcademicDocumentsTab />);
    fireEvent.click(screen.getByRole('button', { name: /Ana Silva/ }));

    expect(screen.getByText(/não possui matrícula ativa/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Imprimir documento/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Ficha de matrícula/ }));
    expect(screen.getByText('Sem matrícula ativa')).toBeTruthy();
    expect(screen.getByText('Maria Silva')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Imprimir documento/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
