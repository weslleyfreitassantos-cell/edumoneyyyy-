// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  journeys: [] as Array<Record<string, unknown> & { journey_id: string; canonical_subject_code: string; subject_code: string; subject_name: string; unit_title: string; title: string; execution_skill_id: string; question_count: number; availability_status: string; pedagogical_review_status: string; active_session_id: string | null; active_session_status: 'ACTIVE' | 'PAUSED' | null }>,
  startJourney: vi.fn().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-1' }),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedDisciplineJourneysV9: () => ({ data: state.journeys, isLoading: false, isError: false }),
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
  </Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); state.journeys = []; state.startJourney.mockReset().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-1' }); });

describe('EnglishLearningPage', () => {
  it('não libera conteúdo em prévia ou pendente de revisão', () => {
    state.journeys = [makeJourney()];
    renderPage();
    expect(screen.getByText('Este conteúdo está em revisão pedagógica ou ainda não foi publicado. Ele não está liberado para estudo nem gera progresso.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Indisponível durante a revisão' }).hasAttribute('disabled')).toBe(true);
    expect(state.startJourney).not.toHaveBeenCalled();
  });

  it('inicia pela RPC V9 apenas uma trilha aprovada e disponível', async () => {
    state.journeys = [makeJourney({ availability_status: 'AVAILABLE', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED' })];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar trilha' }));
    await waitFor(() => expect(screen.getByText('Jornada guiada aberta')).toBeTruthy());
    expect(state.startJourney).toHaveBeenCalledWith('journey-english-1');
  });

  it('informa indisponibilidade quando a matrícula não recebe jornadas em inglês', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Trilhas ainda não disponíveis' })).toBeTruthy();
    expect(screen.getByText(/Quando houver uma trilha aprovada e publicada/)).toBeTruthy();
  });
});
