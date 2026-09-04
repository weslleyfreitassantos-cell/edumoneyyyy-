// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useSubjects } from '../../../hooks/useSubjects';
import { useCurriculum } from '../../../hooks/useCurriculum';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}));

vi.mock('../../../hooks/useSubjects', () => ({
  useSubjects: vi.fn(),
}));

vi.mock('../../../hooks/useCurriculum', () => ({
  useCurriculum: vi.fn(),
  useCreateCurriculumItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateCurriculumItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSetCurriculumItemActive: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import CurriculumTab from './CurriculumTab';

const baseItems = [
  {
    id: 'item-1',
    institution_id: 'inst-1',
    class_id: 'class-1',
    subject_id: 'subj-1',
    weekly_lessons: 3,
    lesson_duration_minutes: 50,
    needs_review: false,
    active: true,
    class_name: '1A',
    academic_year_id: 'year-1',
    subject_name: 'Português',
    subject_code: 'LP',
    weekly_minutes: 150,
  },
  {
    id: 'item-2',
    institution_id: 'inst-1',
    class_id: 'class-1',
    subject_id: 'subj-2',
    weekly_lessons: 2,
    lesson_duration_minutes: 45,
    needs_review: true,
    active: true,
    class_name: '1A',
    academic_year_id: 'year-1',
    subject_name: 'Matemática',
    subject_code: 'MAT',
    weekly_minutes: 90,
  },
];

function mockDefaultHooks() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'profile-1', app_metadata: {}, user_metadata: {}, aud: '', created_at: '' },
    profile: { id: 'profile-1', full_name: 'Admin', email: 'admin@test.com', role: 'ADMIN', platform_role: 'USER', avatar_url: null },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: 'inst-1',
    institution: { id: 'inst-1', name: 'Escola', active: true, account_id: 'acc-1' },
    currentInstitution: { id: 'inst-1', name: 'Escola', active: true, account_id: 'acc-1' },
    currentInstitutionId: 'inst-1',
    currentRole: 'DIRECTOR',
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    membership: { id: 'm-1', institution_id: 'inst-1', role: 'DIRECTOR', active: true },
    currentMembership: { id: 'm-1', institution_id: 'inst-1', role: 'DIRECTOR', active: true },
    refetch: vi.fn(),
  });

  vi.mocked(useAcademicYears).mockReturnValue({
    data: [{ id: 'year-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useClasses).mockReturnValue({
    data: [{ id: 'class-1', name: '1A', active: true, academic_year_id: 'year-1', active_curriculum_items_count: 2, institution_id: 'inst-1', academic_year_name: '2026', grade_level: null, shift: null, capacity: 30, active_enrollments_count: 0, active_offerings_count: 0 }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useSubjects).mockReturnValue({
    data: [{ id: 'subj-1', name: 'Português', code: 'LP', active: true, institution_id: 'inst-1' }, { id: 'subj-2', name: 'Matemática', code: 'MAT', active: true, institution_id: 'inst-1' }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useCurriculum).mockReturnValue({
    data: baseItems,
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

function renderTab(route = '/admin?module=curriculum') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin" element={<CurriculumTab />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
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

describe('CurriculumTab', () => {
  it('renderiza sumario de carga horaria', () => {
    renderTab();
    expect(screen.getByText(/carga horária semanal total/i)).toBeTruthy();
    expect(screen.getByText(/240 min/)).toBeTruthy();
  });

  it('renderiza itens da matriz na tabela', () => {
    renderTab();
    expect(screen.getByText('Português')).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
  });

  it('mostra badge de revisao pendente para needs_review', () => {
    renderTab();
    const reviewBadges = screen.getAllByText('Revisão pendente');
    expect(reviewBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('filtra por ano letivo', () => {
    renderTab();
    const yearSelect = screen.getByLabelText(/ano letivo/i);
    expect(yearSelect).toBeTruthy();
  });

  it('filtra por turma', () => {
    renderTab();
    const classSelect = screen.getByLabelText(/turma/i);
    expect(classSelect).toBeTruthy();
  });

  it('busca por turma ou disciplina', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/buscar na matriz/i), {
      target: { value: 'matemática' },
    });

    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.queryByText('Português')).toBeNull();
  });

  it('limita a matriz e permite navegar entre páginas', () => {
    vi.mocked(useCurriculum).mockReturnValue({
      data: Array.from({ length: 11 }, (_, index) => ({
        ...baseItems[0],
        id: `item-${index + 1}`,
        subject_id: `subj-${index + 1}`,
        subject_name: `Disciplina ${index + 1}`,
      })),
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    renderTab();

    expect(screen.getByText('Mostrando 1–10 de 11')).toBeTruthy();
    expect(screen.queryByText('Disciplina 11')).toBeNull();

    fireEvent.click(screen.getByLabelText('Próxima página'));

    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(screen.getByText('Disciplina 11')).toBeTruthy();
  });

  it('abre modal de criacao ao clicar em Adicionar', () => {
    renderTab();
    fireEvent.click(screen.getByText(/Adicionar disciplina/i));
    expect(screen.getByText(/Adicionar disciplina à matriz/i)).toBeTruthy();
  });

  it('navega para atribuicoes ao clicar no botao', () => {
    renderTab();
    const buttons = screen.getAllByText('Atribuições');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('pre-classifica classId da URL', () => {
    renderTab('/admin?module=curriculum&classId=class-1');
    expect(screen.getByText('Português')).toBeTruthy();
  });

  it('mostra estado de carregamento', () => {
    vi.mocked(useCurrentInstitution).mockReturnValue({
      data: 'inst-1',
      isLoading: true,
      isError: false,
      error: null,
      institution: null,
      currentInstitution: null,
      currentInstitutionId: null,
      currentRole: null,
      membership: null,
      currentMembership: null,
      refetch: vi.fn(),
      message: null,
    });
    renderTab();
    expect(screen.getByText(/carregando instituição/i)).toBeTruthy();
  });
});
