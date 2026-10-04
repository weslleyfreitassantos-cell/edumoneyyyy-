// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
  activities: [] as Array<{ id: string; subject_id: string; unit_id: string | null; skill_id: string | null; title: string }>,
  simulations: [{ id: 'simulation-1', title: 'ENEM 2025 · diagnóstico', source_year: 2025 }],
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
  useLearningSimulations: () => ({ data: state.simulations, isLoading: false }),
  useLearningUnits: () => ({ data: [{ id: 'unit-1', subject_id: 'subject-math', title: 'Números', description: 'Conteúdos essenciais', sort_order: 1 }], isLoading: false }),
  useLearningSkills: () => ({ data: [{ id: 'skill-1', unit_id: 'unit-1', title: 'Resolver problemas', description: null, sort_order: 1 }], isLoading: false }),
  useGuidedLearningSessionV2: () => ({ data: state.guidedSession, isLoading: false }),
  useStartGuidedLearningSessionV2: () => ({ mutateAsync: state.startGuidedSession, isPending: false }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useStudentAdaptiveTarget: () => ({ data: state.adaptiveTarget, isLoading: false }),
}));

import StudyCenterPage from './StudyCenterPage';

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
        <Route path="/student/study/activity/:activityId" element={<p>Atividade aberta</p>} />
        <Route path="/student/study/guided" element={<p>Jornada guiada aberta</p>} />
        <Route path="/student/study/simulation" element={<p>Simulado ENEM aberto</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StudyCenterPage', () => {
  it('apresenta matérias e o acesso direto ao simulado ENEM', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Matemática/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Língua Portuguesa/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Começar simulado' }).getAttribute('href')).toBe('/student/study/simulation');
  });

  it('filtra as matérias sem misturar outros conteúdos', () => {
    renderPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar matéria' }), { target: { value: 'mat' } });

    expect(screen.getByRole('button', { name: /Matemática/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Língua Portuguesa/ })).toBeNull();
  });

  it('mostra o conteúdo da matéria escolhida quando não há atividade publicada', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));
    fireEvent.click(screen.getByRole('button', { name: /Números/ }));

    expect(screen.getByRole('region', { name: 'Estudo de Matemática' })).toBeTruthy();
    expect(screen.getByText('Números')).toBeTruthy();
    expect(screen.getByText('Resolver problemas')).toBeTruthy();
  });

  it('abre uma atividade publicada diretamente pela matéria escolhida', () => {
    state.activities = [{ id: 'activity-1', subject_id: 'subject-math', unit_id: 'unit-1', skill_id: 'skill-1', title: 'Porcentagem' }];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));

    expect(screen.getByText('Atividade aberta')).toBeTruthy();
  });

  it('inicia a jornada antes de navegar quando a matéria usa o objetivo adaptativo', async () => {
    state.adaptiveTarget = { canonicalSkillId: 'canonical-skill-1', target: { subjectArea: 'MATEMATICA' } };
    state.startGuidedSession.mockImplementationOnce(async () => {
      state.guidedSession = { id: 'session-1', status: 'ACTIVE' };
      return { session_id: 'session-1' };
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));

    await waitFor(() => expect(state.startGuidedSession).toHaveBeenCalledWith('canonical-skill-1'));
    expect(await screen.findByText('Jornada guiada aberta')).toBeTruthy();
  });

  it('mantém o erro de início visível e não navega quando a jornada falha', async () => {
    state.adaptiveTarget = { canonicalSkillId: 'canonical-skill-1', target: { subjectArea: 'MATEMATICA' } };
    state.startGuidedSession.mockRejectedValueOnce(new Error('start failed'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível abrir esta matéria agora. Tente novamente.');
    expect(screen.queryByText('Jornada guiada aberta')).toBeNull();
  });
});
