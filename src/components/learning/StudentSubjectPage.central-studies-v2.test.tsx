// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: {
    data: [
      { id: 'subject-physics', name: 'Física', code: 'FIS' },
      { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' },
    ],
    isLoading: false,
    isError: false,
  },
  overview: {
    data: {
      state: 'READY', subject_id: 'subject-physics', subject_name: 'Física',
      grade_label: '1ª série do Ensino Médio', topic_title: 'Movimento e energia',
    } as Record<string, unknown>,
    isLoading: false,
    isError: false,
  },
  start: {
    mutateAsync: vi.fn().mockResolvedValue({ state: 'ACTIVE', session_id: 'session-1' }),
    isPending: false,
    isError: false,
  },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useStudentLearningSubjects: () => state.subjects,
  useGuidedStudyOverviewV11: () => state.overview,
  useStartGuidedStudyV11: () => state.start,
}));

import StudentSubjectPage from './StudentSubjectPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(subject = 'subject-physics') {
  return render(<MemoryRouter initialEntries={[`/student/study/subject/${subject}`]}><Routes>
    <Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} />
    <Route path="/student/study/guided" element={<LocationProbe />} />
  </Routes></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  state.subjects = {
    data: [
      { id: 'subject-physics', name: 'Física', code: 'FIS' },
      { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' },
    ],
    isLoading: false,
    isError: false,
  };
  state.overview = {
    data: {
      state: 'READY', subject_id: 'subject-physics', subject_name: 'Física',
      grade_label: '1ª série do Ensino Médio', topic_title: 'Movimento e energia',
    },
    isLoading: false,
    isError: false,
  };
  state.start.mutateAsync.mockReset().mockResolvedValue({ state: 'ACTIVE', session_id: 'session-1' });
  state.start.isPending = false;
  state.start.isError = false;
});

describe('StudentSubjectPage', () => {
  it('apresenta matéria, série e assunto sem expor códigos, métricas ou atividades docentes', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Física' })).toBeTruthy();
    expect(screen.getByText('1ª série do Ensino Médio')).toBeTruthy();
    expect(screen.getByText('Movimento e energia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Começar estudo guiado' })).toBeTruthy();
    expect(screen.queryByText(/EM13CNT101|Ciências da Natureza|evidências|BNCC|\d+%|Lista da professora/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /Lista de Exercícios/ })).toBeNull();
  });

  it('inicia a sessão real emitida pelo servidor no contexto da matéria', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar estudo guiado' }));

    await waitFor(() => expect(state.start.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/student/study/guided?session=session-1&subject=subject-physics'));
  });

  it('distingue ausência real de conteúdo e não inventa uma jornada', () => {
    state.overview.data = {
      state: 'NO_ELIGIBLE_CONTENT', subject_id: 'subject-physics', subject_name: 'Física',
      grade_label: '1ª série do Ensino Médio', reason: 'Ainda não há conteúdo BNCC publicado e validado tecnicamente.',
    };
    renderPage();

    expect(screen.getByRole('status').textContent).toContain('uma etapa de estudo guiado disponível para Física');
    expect(screen.queryByText(/BNCC|validado tecnicamente|EM13CNT101/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Começar|Continuar estudo/ })).toBeNull();
  });

  it('permite retomar somente a sessão ativa registrada em outra matéria', () => {
    state.overview.data = {
      state: 'ACTIVE_SESSION_OTHER_SUBJECT', session_id: 'saved-session',
      session_subject_id: 'subject-history', reason: 'Retome a jornada salva antes de iniciar outra matéria.',
    };
    renderPage();

    expect(screen.getByRole('link', { name: 'Retomar jornada salva' }).getAttribute('href'))
      .toBe('/student/study/guided?session=saved-session&subject=subject-history');
    expect(screen.queryByRole('button', { name: /Começar|Continuar estudo/ })).toBeNull();
  });

  it('mostra erro de consulta como erro, não como ausência de conteúdo', () => {
    state.overview.isError = true;
    renderPage();

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível consultar sua jornada');
    expect(screen.queryByText(/Ainda não há uma etapa guiada disponível/)).toBeNull();
  });

  it('mantém Tec Idiomas separado e disponibiliza também o Estudo Guiado em Inglês', () => {
    state.overview.data = {
      state: 'READY', subject_id: 'subject-english', subject_name: 'Língua Inglesa',
      grade_label: '1ª série do Ensino Médio', topic_title: 'Estratégias de leitura em inglês',
    };
    renderPage('subject-english');
    expect(screen.getByRole('link', { name: 'Abrir Tec Idiomas' }).getAttribute('href')).toBe('/student/study/english');
    expect(screen.getByRole('button', { name: 'Começar estudo guiado' })).toBeTruthy();
    expect(screen.getByText('Estratégias de leitura em inglês')).toBeTruthy();
  });
});
