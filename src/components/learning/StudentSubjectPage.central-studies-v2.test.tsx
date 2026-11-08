// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const journeys = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useStudentLearningSubjects: () => ({ data: [{ id: 'subject-math', name: 'Matemática', code: 'MAT' }, { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' }], isLoading: false, isError: false }),
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedDisciplineJourneysV9: () => journeys,
}));

import StudentSubjectPage from './StudentSubjectPage';

function renderPage(subject = 'subject-math') {
  return render(<MemoryRouter initialEntries={[`/student/study/subject/${subject}`]}><Routes><Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} /></Routes></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  journeys.data = [];
  journeys.isError = false;
  journeys.isLoading = false;
});

describe('StudentSubjectPage', () => {
  it('exibe resumo de progresso sem lista de aulas selecionáveis', () => {
    journeys.data = [{
      source: 'CENTRAL_STUDIES_V2', journey_id: 'journey-1', subject_id: 'subject-math',
      subject_name: 'Matemática', unit_title: 'Números', title: 'Estratégias com números naturais',
      publication_status: 'PUBLISHED', availability_status: 'AVAILABLE', mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', question_count: 5, progress: 60,
    }];
    renderPage();

    expect(screen.getByText('Acompanhamento de aprendizagem')).toBeTruthy();
    expect(screen.getByText('Estratégias com números naturais')).toBeTruthy();
    expect(screen.getAllByText('60%')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /Iniciar aula|Abrir aula|Continuar aula/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ir para Lista de Exercícios' }).getAttribute('href')).toBe('/student/activities');
  });

  it('não apresenta progresso de conteúdos de prévia ou não publicados', () => {
    journeys.data = [{
      source: 'CENTRAL_STUDIES_V2', journey_id: 'staging', subject_id: 'subject-math',
      subject_name: 'Matemática', unit_title: 'Unidade', title: 'Conteúdo em revisão',
      publication_status: 'STAGING', availability_status: 'AVAILABLE', mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', question_count: 5, progress: 100,
    }];
    renderPage();

    expect(screen.queryByText('Conteúdo em revisão')).toBeNull();
    expect(screen.getByText(/Ainda não há habilidades publicadas e aprovadas/)).toBeTruthy();
  });

  it('mantém Tec Idiomas separado do Estudo Guiado', () => {
    renderPage('subject-english');
    expect(screen.getByRole('link', { name: 'Abrir Tec Idiomas' }).getAttribute('href')).toBe('/student/study/english');
  });
});
