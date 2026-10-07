// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
  activities: [] as Array<{ id: string; subject_id: string; unit_id: string | null; skill_id: string | null; title: string }>,
  simulations: [{ id: 'simulation-1', title: 'Matemática', simulation_type: 'SUBJECT', area: null, subject: 'MATEMATICA', question_count: 10, duration_minutes: 20, available_count: 10, language_options: [], metadata: {} }],
  adaptiveTarget: null as null | { canonicalSkillId: string; target: { subjectArea: string } },
  guidedSession: null as null | { id: string; status: string },
  startGuidedSession: vi.fn().mockResolvedValue({ session_id: 'session-1' }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'institution-1' }),
}));

vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' }, isLoading: false }),
  useStudentLearningSubjects: () => ({ data: state.subjects, isLoading: false, isError: false }),
  usePublishedLearningActivities: () => ({ data: state.activities, isLoading: false, isError: false }),
  useEnemSimulationTemplates: () => ({ data: state.simulations, isLoading: false }),
  useLearningUnits: () => ({ data: [{ id: 'unit-1', subject_id: 'subject-math', title: 'Números', description: 'Conteúdos essenciais', sort_order: 1 }], isLoading: false }),
  useLearningSkills: () => ({ data: [{ id: 'skill-1', unit_id: 'unit-1', title: 'Resolver problemas', description: null, sort_order: 1 }], isLoading: false }),
  useGuidedLearningSessionV2: () => ({ data: state.guidedSession, isLoading: false }),
  useStartGuidedLearningSessionV2: () => ({ mutateAsync: state.startGuidedSession, isPending: false }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useStudentAdaptiveTarget: () => ({ data: state.adaptiveTarget, isLoading: false }),
}));

import StudyCenterPage from './StudyCenterPage';
import StudentSubjectPage from './StudentSubjectPage';

afterEach(() => {
  cleanup();
  state.activities = [];
  state.adaptiveTarget = null;
  state.guidedSession = null;
  state.startGuidedSession.mockReset().mockResolvedValue({ session_id: 'session-1' });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/student/study']}>
      <Routes>
        <Route path="/student/study" element={<StudyCenterPage />} />
        <Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} />
        <Route path="/student/study/activity/:activityId" element={<p>Atividade aberta</p>} />
        <Route path="/student/study/guided" element={<p>Jornada guiada aberta</p>} />
        <Route path="/student/study/simulation" element={<p>Simulado ENEM aberto</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StudyCenterPage', () => {
  it('mantém a home enxuta, com ENEM antes das matérias', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Língua Portuguesa/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Praticar/ }).getAttribute('href')).toBe('/student/study/simulation?simulation=simulation-1');
    expect(screen.queryByText('Central de Estudos')).toBeNull();
    expect(screen.queryByText('Seu próximo passo')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Práticas oficiais' }).compareDocumentPosition(screen.getByRole('region', { name: 'Matérias' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('filtra as matérias sem misturar outros conteúdos', () => {
    renderPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar matéria' }), { target: { value: 'mat' } });

    expect(screen.getAllByRole('link', { name: /Matemática/ }).some((link) => link.getAttribute('href') === '/student/study/subject/subject-math')).toBe(true);
    expect(screen.queryByRole('link', { name: /Língua Portuguesa/ })).toBeNull();
  });

  it('abre a área própria da matéria ao clicar no card', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('region', { name: 'Estudo de Matemática' })).toBeTruthy();
    expect(screen.getByText('Números')).toBeTruthy();
    expect(screen.queryByText('O que você quer estudar?')).toBeNull();
  });
});
