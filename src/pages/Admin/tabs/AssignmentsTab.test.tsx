// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useAssignments } from '../../../hooks/useAssignments';
import { useClasses } from '../../../hooks/useClasses';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useSubjects } from '../../../hooks/useSubjects';
import { useTeachers } from '../../../hooks/useTeachers';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../../hooks/useAcademicAutomation', () => ({
  useCreateWholeYearAssignment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../../hooks/useAssignments', () => ({
  useAssignments: vi.fn(),
  useCreateAssignment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSetAssignmentActive: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateAssignment: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useSubjects', () => ({
  useSubjects: vi.fn(),
}));

vi.mock('../../../hooks/useTeachers', () => ({
  useTeachers: vi.fn(),
}));

import AssignmentsTab from './AssignmentsTab';

const terms = [
  { id: 'term-1', academic_year_id: 'year-1', name: '1º Bimestre', active: true },
];

const assignments = Array.from({ length: 11 }, (_, index) => ({
  id: `assignment-${index + 1}`,
  class_id: 'class-1',
  subject_id: `subject-${index + 1}`,
  teacher_profile_id: `teacher-${index + 1}`,
  term_id: 'term-1',
  active: true,
  class_name: '1º A',
  class_grade_level: '1 EM',
  class_shift: 'MATUTINO',
  subject_name: `Disciplina ${index + 1}`,
  subject_code: `D${index + 1}`,
  teacher_name: `Professor ${index + 1}`,
  teacher_email: `professor.${index + 1}@school-tv.test`,
  term_name: '1º Bimestre',
  academic_year_id: 'year-1',
}));

function mockDefaultHooks() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    profile: { id: 'profile-1' } as never,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  } as never);

  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: 'inst-1',
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useAcademicYears).mockReturnValue({
    data: [{
      id: 'year-1',
      name: '2026',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      active: true,
      terms,
    }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useAssignments).mockReturnValue({
    data: assignments,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useClasses).mockReturnValue({
    data: [{
      id: 'class-1',
      name: '1º A',
      active: true,
      academic_year_id: 'year-1',
    }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useSubjects).mockReturnValue({
    data: assignments.map((assignment) => ({
      id: assignment.subject_id,
      name: assignment.subject_name,
      code: assignment.subject_code,
      active: true,
    })),
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useTeachers).mockReturnValue({
    data: assignments.map((assignment) => ({
      id: `teacher-row-${assignment.teacher_profile_id}`,
      profile_id: assignment.teacher_profile_id,
      active: true,
      profiles: {
        full_name: assignment.teacher_name,
        email: assignment.teacher_email,
        active: true,
      },
    })),
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/admin?module=assignments']}>
      <Routes>
        <Route path="/admin" element={<AssignmentsTab />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaultHooks();
});

afterEach(() => {
  cleanup();
});

describe('AssignmentsTab', () => {
  it('busca atribuições por disciplina, turma ou professor', () => {
    renderTab();

    fireEvent.change(screen.getByLabelText('Buscar atribuição'), {
      target: { value: 'Professor 11' },
    });

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Disciplina 11')).toBeTruthy();
    expect(table.queryByText('Disciplina 1')).toBeNull();
  });

  it('limita a lista e permite navegar entre páginas', () => {
    renderTab();

    expect(screen.getByText('Mostrando 1–10 de 11')).toBeTruthy();
    expect(within(screen.getByRole('table')).queryByText('Disciplina 11')).toBeNull();

    fireEvent.click(screen.getByLabelText('Próxima página'));

    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Disciplina 11')).toBeTruthy();
  });
});
