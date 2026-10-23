// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  journeys: [] as Array<Record<string, unknown> & { journey_id: string; canonical_subject_code: string; subject_code: string; subject_name: string; unit_title: string; title: string; execution_skill_id: string; question_count: number; availability_status: string; pedagogical_review_status: string; active_session_id: string | null; active_session_status: 'ACTIVE' | 'PAUSED' | null }>,
  startJourney: vi.fn().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-1' }),
  gamification: { xp: 120, current_streak: 3, longest_streak: 7, daily_goal_minutes: 15, last_qualified_activity_date: '2026-10-22' } as null | { xp: number; current_streak: number; longest_streak: number; daily_goal_minutes: number; last_qualified_activity_date: string | null },
  dailyPlan: {
    estimated_minutes: 18,
    learning_daily_plan_items: [
      { id: 'plan-item-2', position: 2, title: 'Revisar vocabulário', description: null, estimated_minutes: 8, status: 'PENDING' },
      { id: 'plan-item-1', position: 1, title: 'Ler um texto curto', description: 'Identifique as pistas no texto.', estimated_minutes: 10, status: 'COMPLETED' },
    ],
  } as null | { estimated_minutes: number; learning_daily_plan_items: Array<{ id: string; position: number; title: string; description: string | null; estimated_minutes: number; status: string }> },
  errorNotes: [] as Array<{ id: string; canonical_skill_id: string | null; error_count: number; last_missed_at: string }>,
  errorNotesError: false,
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedDisciplineJourneysV9: () => ({ data: state.journeys, isLoading: false, isError: false }),
  useLearningGamification: () => ({ data: state.gamification }),
  useLearningDailyPlan: () => ({ data: state.dailyPlan, isError: false }),
  useLearningErrorNotebook: () => ({ data: state.errorNotes, isLoading: false, isError: state.errorNotesError }),
  useStartGuidedDisciplineJourneyV9: () => ({ mutateAsync: state.startJourney }),
}));

import EnglishLearningPage from './EnglishLearningPage';

function makeJourney(overrides: Partial<(typeof state.journeys)[number]> = {}) {
  return {
    journey_id: 'journey-english-1', journey_code: 'ENGLISH_READING_1', subject_id: 'subject-english', subject_code: 'ING', subject_name: 'Língua Inglesa', canonical_subject_code: 'ENGLISH', unit_code: 'READING', unit_title: 'Reading', title: 'Find clues in a short text', execution_skill_id: 'skill-english-1', official_codes: [], official_areas: [], mapping_status: 'MAPPING_PENDING', mapping_reason: '', learning_role: 'PRACTICE', availability_status: 'DEMO_PREVIEW', question_count: 12, missing_purposes: [], progress: 0, active_session_id: null, active_session_status: null, pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', reason: '', ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/student/study/english']}><Routes>
    <Route path="/student/study/english" element={<EnglishLearningPage />} />
    <Route path="/student/study/guided" element={<p>Jornada guiada aberta</p>} />
    <Route path="/student/study/error/:errorId" element={<p>Revisão do caderno aberta</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); state.journeys = []; state.errorNotes = []; state.errorNotesError = false; state.gamification = { xp: 120, current_streak: 3, longest_streak: 7, daily_goal_minutes: 15, last_qualified_activity_date: '2026-10-22' }; state.dailyPlan = { estimated_minutes: 18, learning_daily_plan_items: [{ id: 'plan-item-2', position: 2, title: 'Revisar vocabulário', description: null, estimated_minutes: 8, status: 'PENDING' }, { id: 'plan-item-1', position: 1, title: 'Ler um texto curto', description: 'Identifique as pistas no texto.', estimated_minutes: 10, status: 'COMPLETED' }] }; state.startJourney.mockReset().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-1' }); });

describe('EnglishLearningPage', () => {
  it('não libera conteúdo em prévia ou pendente de revisão', () => {
    state.journeys = [makeJourney()];
    renderPage();
    expect(screen.getByText('Este conteúdo está em revisão pedagógica ou ainda não foi publicado. Ele não está liberado para estudo nem gera progresso.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Indisponível durante a revisão' }).hasAttribute('disabled')).toBe(true);
    expect(state.startJourney).not.toHaveBeenCalled();
  });

  it('inicia pela RPC V9 apenas uma trilha aprovada e disponível', async () => {
    state.journeys = [makeJourney({ availability_status: 'AVAILABLE', mapping_status: 'MAPPED', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', progress: 38 })];
    renderPage();
    expect(screen.getByRole('region', { name: 'Seu progresso geral de aprendizagem' })).toBeTruthy();
    expect(screen.getByText('120 XP')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Plano de hoje: 1 de 2 etapas concluídas' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('1 de 2 etapas concluídas')).toBeTruthy();
    expect(screen.getByText('18 min estimados. A duração organiza o plano e não representa tempo cronometrado.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent?.includes('Ler um texto curto'))).toEqual([true, false]);
    expect(screen.getByRole('progressbar', { name: 'Domínio atual: 38%' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar trilha' }));
    await waitFor(() => expect(screen.getByText('Jornada guiada aberta')).toBeTruthy());
    expect(state.startJourney).toHaveBeenCalledWith('journey-english-1');
  });

  it('não inicia uma trilha com mapeamento curricular ainda pendente', () => {
    state.journeys = [makeJourney({ availability_status: 'AVAILABLE', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED' })];
    renderPage();
    expect(screen.getByRole('button', { name: 'Indisponível durante a revisão' }).hasAttribute('disabled')).toBe(true);
    expect(state.startJourney).not.toHaveBeenCalled();
  });

  it('informa indisponibilidade quando a matrícula não recebe jornadas em inglês', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Trilhas ainda não disponíveis' })).toBeTruthy();
    expect(screen.getByText(/Quando houver uma trilha aprovada e publicada/)).toBeTruthy();
  });

  it('mostra revisões do Caderno de Erros apenas para habilidades das trilhas de inglês', async () => {
    state.journeys = [makeJourney()];
    state.errorNotes = [
      { id: 'english-error-1', canonical_skill_id: 'skill-english-1', error_count: 2, last_missed_at: '2026-10-22T12:00:00Z' },
      { id: 'math-error-1', canonical_skill_id: 'skill-math-1', error_count: 4, last_missed_at: '2026-10-22T13:00:00Z' },
      { id: 'unmapped-error', canonical_skill_id: null, error_count: 1, last_missed_at: '2026-10-22T14:00:00Z' },
    ];
    renderPage();

    expect(screen.getByRole('heading', { name: 'Questões de inglês para reforçar' })).toBeTruthy();
    expect(screen.getAllByText('Find clues in a short text')).toHaveLength(2);
    expect(screen.queryByText('skill-math-1')).toBeNull();
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/student/study/error/english-error-1');
    fireEvent.click(screen.getByRole('link', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('Revisão do caderno aberta')).toBeTruthy());
  });

  it('não afirma que as revisões estão vazias quando o Caderno de Erros falha', () => {
    state.journeys = [makeJourney()];
    state.errorNotesError = true;
    renderPage();

    expect(screen.getByText('Não foi possível consultar as revisões agora. Seu progresso continua salvo.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma questão de inglês aguardando reforço no Caderno de Erros.')).toBeNull();
  });
});
