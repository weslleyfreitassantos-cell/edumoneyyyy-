// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const journeys = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false }));
const pageData = vi.hoisted(() => ({
  links: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
  targets: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
  canonicalProgress: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
  activities: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
  activityProgress: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useStudentLearningSubjects: () => ({ data: [{ id: 'subject-math', name: 'Matemática', code: 'MAT' }, { id: 'subject-history', name: 'História', code: 'HIS' }, { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' }], isLoading: false, isError: false }),
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedDisciplineJourneysV9: () => journeys,
  useLearningCurriculumSubjectLinks: () => pageData.links,
  useStudentGuidedLearningTargets: () => pageData.targets,
  useLearningCanonicalProgress: () => pageData.canonicalProgress,
  usePublishedLearningActivities: () => pageData.activities,
  useLearningProgress: () => pageData.activityProgress,
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
  for (const query of Object.values(pageData)) {
    query.data = [];
    query.isLoading = false;
    query.isError = false;
  }
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
    expect(screen.getByText('Jornadas publicadas da matéria (1)')).toBeTruthy();
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
    expect(screen.getByText(/não há habilidades publicadas e elegíveis/)).toBeTruthy();
    expect(screen.getByText(/não há atividades ou jornadas publicadas especificamente/)).toBeTruthy();
  });

  it('apresenta conteúdo V13, estado real e evidências sem confundir área BNCC com matéria', () => {
    pageData.targets.data = [{
      target_canonical_skill_id: 'skill-his', subject_id: null, catalog_id: 'bncc', catalog_code: 'BNCC_2018',
      official_code: 'EM13CHS103', title: 'Analisar fontes e interpretações históricas', subject_area: 'CIENCIAS_HUMANAS',
      stage: 'ENSINO_MEDIO', grade_level: 1, availability_status: 'READY', progress: 35, has_lesson: true,
      question_count: 6, active_session_id: null, active_session_status: null, reason: '',
    }];
    pageData.canonicalProgress.data = [{
      canonical_skill_id: 'skill-his', skill_title: 'Analisar fontes e interpretações históricas', state: 'LEARNING',
      mastery_estimate: 35, evidence_count: 2, confidence: 0.8, updated_at: '2026-11-09T10:00:00.000Z',
    }];
    pageData.links.data = [{ subject_id: 'subject-history', subject_area: 'CIENCIAS_HUMANAS' }];
    renderPage('subject-history');

    expect(screen.getByRole('heading', { name: 'Conteúdo disponível na área BNCC' })).toBeTruthy();
    expect(screen.getByText('Analisar fontes e interpretações históricas')).toBeTruthy();
    expect(screen.getByText(/não são atribuídas automaticamente, de forma exclusiva, a História/)).toBeTruthy();
    expect(screen.getByText(/Em andamento · 2 evidências/)).toBeTruthy();
    expect(screen.getAllByText('35%')).toHaveLength(2);
  });

  it('shows a query failure instead of claiming that there is no published content', () => {
    pageData.targets.isError = true;
    renderPage();

    expect(screen.getByText(/consulta falhou; isso não significa que a matéria esteja sem conteúdo/)).toBeTruthy();
    expect(screen.queryByText(/O banco confirmou que não há habilidades/)).toBeNull();
  });

  it('does not label progress as not started while the student state is loading', () => {
    pageData.targets.data = [{
      target_canonical_skill_id: 'skill-pending', subject_area: 'MATEMATICA', availability_status: 'READY',
      has_lesson: true, question_count: 2, progress: 0,
    }];
    pageData.canonicalProgress.isLoading = true;
    renderPage();

    expect(screen.getByText('Progresso e evidências carregando...')).toBeTruthy();
    expect(screen.queryByText('Ainda não iniciada · 0 evidências · 2 questões adaptativas disponíveis')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('mantém Tec Idiomas separado do Estudo Guiado', () => {
    renderPage('subject-english');
    expect(screen.getByRole('link', { name: 'Abrir Tec Idiomas' }).getAttribute('href')).toBe('/student/study/english');
  });
});
