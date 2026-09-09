// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Profile } from '../../contexts/AuthContext';
import type {
  BookRecommendation,
  BookRecommendationOffering,
} from '../../services/bookRecommendationService';

const state = vi.hoisted(() => ({
  role: 'TEACHER' as 'TEACHER' | 'STUDENT',
  teacherRecommendations: [] as BookRecommendation[],
  studentRecommendations: [] as BookRecommendation[],
  offerings: [] as BookRecommendationOffering[],
  create: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  setActive: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'teacher-1',
      full_name: 'Professor de teste',
      email: 'teacher@example.com',
      role: state.role,
      platform_role: 'USER',
      avatar_url: null,
    } satisfies Profile,
  }),
}));

vi.mock('../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: () => ({
    currentInstitutionId: 'institution-1',
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../hooks/useBookRecommendations', () => ({
  useTeacherBookRecommendations: (_institutionId: string, _profileId: string, filters: { search?: string }) => ({
    data: state.teacherRecommendations.filter((recommendation) =>
      !filters.search || recommendation.title.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()),
    ),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useStudentBookRecommendations: () => ({
    data: state.studentRecommendations,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTeacherBookOfferings: () => ({
    data: state.offerings,
    isLoading: false,
    isError: false,
  }),
  useCreateBookRecommendation: () => ({ isPending: false, mutateAsync: state.create }),
  useUpdateBookRecommendation: () => ({ isPending: false, mutateAsync: state.update }),
  useSetBookRecommendationActive: () => ({ isPending: false, mutate: state.setActive }),
}));

import LibraryPage from './LibraryPage';

const offering: BookRecommendationOffering = {
  id: 'offering-1',
  classId: 'class-1',
  subjectId: 'subject-1',
  teacherProfileId: 'teacher-1',
  className: '1º ano A',
  gradeLevel: '1º ano do Ensino Médio',
  shift: 'MATUTINO',
  subjectName: 'Ciências',
  subjectCode: 'CIE',
  termName: '1º Bimestre',
  active: true,
};

function recommendation(overrides: Partial<BookRecommendation> = {}): BookRecommendation {
  return {
    id: 'recommendation-1',
    institutionId: 'institution-1',
    subjectOfferingId: offering.id,
    title: 'O mundo assombrado pelos demônios',
    author: 'Carl Sagan',
    isbn: null,
    note: 'Leitura para pensamento crítico.',
    active: true,
    createdBy: 'teacher-1',
    createdAt: '2026-09-09T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
    offering,
    ...overrides,
  };
}

function renderLibrary() {
  return render(<LibraryPage />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.create.mockClear();
  state.update.mockClear();
  state.setActive.mockClear();
});

beforeEach(() => {
  state.role = 'TEACHER';
  state.teacherRecommendations = [recommendation()];
  state.studentRecommendations = [];
  state.offerings = [offering];
});

describe('LibraryPage', () => {
  it('carrega indicações persistidas e usa sempre o placeholder local sem fetch externo', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderLibrary();

    expect(screen.getByRole('heading', { name: 'O mundo assombrado pelos demônios' })).toBeTruthy();
    expect(screen.getByTestId('book-cover-placeholder')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('permite criar uma indicação escolhendo uma oferta ativa do professor', () => {
    renderLibrary();

    fireEvent.click(screen.getByRole('button', { name: 'Indicar livro' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Dom Casmurro' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Autor' }), { target: { value: 'Machado de Assis' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Turma e disciplina' }), { target: { value: offering.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar indicação' }));

    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'teacher-1',
      input: expect.objectContaining({
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        subjectOfferingId: offering.id,
      }),
    }));
  });

  it('mantém editar, desativar e reativar no escopo das indicações do professor', () => {
    state.teacherRecommendations = [recommendation(), recommendation({ id: 'recommendation-2', title: 'O homem que calculava', active: false })];
    renderLibrary();

    fireEvent.click(screen.getByRole('button', { name: 'Editar O mundo assombrado pelos demônios' }));
    expect(screen.getByRole('region', { name: 'Editar indicação' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar formulário' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desativar O mundo assombrado pelos demônios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reativar O homem que calculava' }));

    expect(state.setActive).toHaveBeenNthCalledWith(1, { id: 'recommendation-1', institutionId: 'institution-1', active: false });
    expect(state.setActive).toHaveBeenNthCalledWith(2, { id: 'recommendation-2', institutionId: 'institution-1', active: true });
  });

  it('filtra por título e mantém os links diretos para as lojas', () => {
    state.teacherRecommendations = [recommendation(), recommendation({ id: 'recommendation-2', title: 'Dom Casmurro', author: 'Machado de Assis' })];
    renderLibrary();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar indicação' }), { target: { value: 'Dom Casmurro' } });
    expect(screen.getByRole('heading', { name: 'Dom Casmurro' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'O mundo assombrado pelos demônios' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Amazon' })[0].getAttribute('target')).toBe('_blank');
    expect(screen.getAllByRole('link', { name: 'Mercado Livre' })[0].getAttribute('rel')).toContain('noopener');
  });

  it('mostra aos alunos somente indicações ativas e nenhum controle de professor', () => {
    state.role = 'STUDENT';
    state.studentRecommendations = [recommendation({ createdBy: 'teacher-1' })];
    renderLibrary();

    expect(screen.getByRole('heading', { name: 'O mundo assombrado pelos demônios' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Indicar livro' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Desativar/ })).toBeNull();
  });
});
