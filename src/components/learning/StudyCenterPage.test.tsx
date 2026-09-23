// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'profile-1', full_name: 'Ana Estudante' },
  }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'institution-1' }),
}));

vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' }, isLoading: false }),
  useStudentLearningSubjects: () => ({ data: state.subjects, isLoading: false, isError: false }),
  useLearningUnits: () => ({
    data: [{ id: 'unit-1', subject_id: 'subject-math', title: 'Números', description: null, sort_order: 1 }],
    isLoading: false,
  }),
  useLearningSkills: () => ({
    data: [{ id: 'skill-1', unit_id: 'unit-1', title: 'Resolver problemas', description: null, sort_order: 1 }],
    isLoading: false,
  }),
  usePublishedLearningActivities: () => ({
    data: [
      {
        id: 'activity-1',
        subject_id: 'subject-math',
        unit_id: 'unit-1',
        skill_id: 'skill-1',
        teacher_id: 'teacher-1',
        title: 'Revisão de frações',
        description: null,
        activity_type: 'PRACTICE',
        status: 'PUBLISHED',
        subjects: { name: 'Matemática' },
        learning_questions: [],
      },
      {
        id: 'activity-2',
        subject_id: 'subject-portuguese',
        unit_id: null,
        skill_id: null,
        teacher_id: 'teacher-1',
        title: 'Leitura e interpretação',
        description: null,
        activity_type: 'PRACTICE',
        status: 'PUBLISHED',
        subjects: { name: 'Língua Portuguesa' },
        learning_questions: [],
      },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
  useStudentLearningCollections: () => ({
    data: [{
      id: 'collection-1',
      subject_id: 'subject-math',
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      title: 'Apoio de Matemática',
      description: 'Materiais para revisar.',
      status: 'PUBLISHED',
      learning_resources: [{
        id: 'resource-1',
        collection_id: 'collection-1',
        title: 'Abrir material',
        description: null,
        provider: 'Fonte oficial',
        resource_type: 'LINK',
        source_url: 'https://example.com/material',
        thumbnail_url: null,
      }],
    }],
    isLoading: false,
  }),
  useLearningProgress: () => ({
    data: [{ skill_id: 'skill-1', mastery_percent: 60, status: 'IN_PROGRESS' }],
    isLoading: false,
  }),
}));

import StudyCenterPage from './StudyCenterPage';

afterEach(() => {
  cleanup();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <StudyCenterPage />
    </MemoryRouter>,
  );
}

describe('StudyCenterPage', () => {
  it('organizes the mobile journey with section shortcuts and compact progress', () => {
    renderPage();

    expect(screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Práticas' }).getAttribute('href')).toBe('#study-practice');
    expect(screen.getByRole('link', { name: 'Coleções' }).getAttribute('href')).toBe('#study-resources');
    expect(screen.getAllByText('60%')).toHaveLength(2);
    expect(screen.getByText('práticas disponíveis')).toBeTruthy();
  });

  it('selects a subject locally, filters practices and clears the search', () => {
    renderPage();

    const search = screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' });
    fireEvent.change(search, { target: { value: 'mat' } });
    expect(screen.getByRole('button', { name: 'Limpar pesquisa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    expect((search as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));
    expect(screen.getByRole('button', { name: /Matemática/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Minha trilha')).toBeTruthy();
    expect(screen.getByText('Revisão de frações')).toBeTruthy();
    expect(screen.queryByText('Leitura e interpretação')).toBeNull();
  });

  it('finds a subject through the title of an available practice', () => {
    renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' }), {
      target: { value: 'frações' },
    });

    expect(screen.getByRole('button', { name: /Matemática/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Língua Portuguesa/ })).toBeNull();
  });
});
