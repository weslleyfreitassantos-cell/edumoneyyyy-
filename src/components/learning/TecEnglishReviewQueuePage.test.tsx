// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import TecEnglishReviewQueuePage from './TecEnglishReviewQueuePage';

const englishMock = vi.hoisted(() => ({
  getReviewQueue: vi.fn(),
  getReviewHistory: vi.fn(),
  getReviewPreview: vi.fn(),
  reviewCourse: vi.fn(),
  getReleaseTargets: vi.fn(),
  setInstitutionRelease: vi.fn(),
}));

vi.mock('../../services/tecEnglishService', () => ({ tecEnglishService: englishMock }));

const queueItem = {
  course_code: 'TEC_ENGLISH_FOUNDATIONS',
  content_version: 1,
  title: 'Inglês para começar',
  description: 'Curso introdutório.',
  author: 'Equipe Tec Escola',
  publication_status: 'STAGING',
  review_status: 'PEDAGOGICAL_REVIEW_PENDING',
  snapshot_fingerprint: 'f'.repeat(32),
  unit_count: 1,
  lesson_count: 1,
  exercise_count: 7,
  latest_decision: null,
  latest_reviewer: null,
  latest_reviewed_at: null,
};

const preview = {
  course: { course_code: queueItem.course_code, content_version: 1, title: queueItem.title, description: queueItem.description, author: queueItem.author, xp_per_lesson: 30 },
  units: [{
    id: 'unit-1', position: 1, title: 'Primeiras palavras', description: 'Cumprimentos.', content_version: 1, author: queueItem.author,
    lessons: [{
      id: 'lesson-1', position: 1, title: 'Cumprimentos', introduction: 'Diga olá.', xp_reward: 30, content_version: 1, author: queueItem.author,
      exercises: [{ id: 'exercise-1', position: 1, type: 'MULTIPLE_CHOICE', instruction: 'Escolha a frase.', prompt: 'Como dizer bom dia?', options: ['Good morning'], word_bank: [], left_items: [], right_items: [], audio_text: null, accepted_answers: ['Good morning'], answer_key: { accepted: ['Good morning'] }, explanation: 'É uma saudação.', content_version: 1, author: queueItem.author }],
    }],
  }],
  snapshot_fingerprint: 'f'.repeat(32),
  audio_mode: 'Síntese de voz do navegador.',
};

describe('TecEnglishReviewQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    englishMock.getReviewQueue.mockResolvedValue([queueItem]);
    englishMock.getReviewHistory.mockResolvedValue([]);
    englishMock.getReviewPreview.mockResolvedValue(preview);
    englishMock.getReleaseTargets.mockResolvedValue([{ institution_id: 'school-1', institution_name: 'Escola de Homologação', enabled: false }]);
    englishMock.setInstitutionRelease.mockResolvedValue({ course_code: queueItem.course_code, content_version: 1, institution_id: 'school-1', enabled: true, actor_name: 'Revisora Humana', actor_email: 'reviewer@example.test', updated_at: '2026-10-25T12:00:00.000Z' });
    englishMock.reviewCourse.mockResolvedValue({
      review_id: 'review-1', course_code: queueItem.course_code, content_version: 1,
      decision: 'APPROVED', reviewer_name: 'Revisora Humana', reviewer_email: 'reviewer@example.test',
      reviewed_at: '2026-10-25T12:00:00.000Z', snapshot_fingerprint: preview.snapshot_fingerprint,
    });
  });

  afterEach(() => cleanup());

  it('shows a full version preview and only allows approval after all human criteria and notes', async () => {
    render(<MemoryRouter><TecEnglishReviewQueuePage /></MemoryRouter>);
    expect(await screen.findByText('Frases e traduções corretas e naturais')).toBeTruthy();
    expect(screen.getByText('Resposta esperada:')).toBeTruthy();
    const approve = screen.getByRole('button', { name: 'Aprovar revisão humana e publicar esta versão' });
    expect(approve).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText('Observações registradas'), { target: { value: 'Revisei a versão completa, incluindo áudio e acessibilidade.' } });
    for (const [, label] of [
      ['translation', 'Frases e traduções corretas e naturais'],
      ['audio', 'Áudio, pronúncia e alternativa acessível quando o navegador não oferece microfone'],
      ['instructions', 'Instruções claras para estudantes iniciantes'],
      ['alternatives', 'Alternativas plausíveis, sem ambiguidade ou pegadinhas'],
      ['progression', 'Dificuldade progressiva entre as lições'],
      ['brazilian', 'Vocabulário e exemplos adequados a estudantes brasileiros iniciantes'],
      ['accessibility', 'Acessibilidade por teclado, leitor de tela e celular'],
      ['references', 'Referências e exemplos apropriados para o público escolar'],
    ]) fireEvent.click(screen.getByLabelText(label));
    expect(approve).toHaveProperty('disabled', false);

    fireEvent.click(approve);
    await waitFor(() => expect(englishMock.reviewCourse).toHaveBeenCalledWith({
      courseCode: queueItem.course_code,
      contentVersion: 1,
      decision: 'APPROVED',
      notes: 'Revisei a versão completa, incluindo áudio e acessibilidade.',
      expectedFingerprint: preview.snapshot_fingerprint,
      checklist: {
        translation: true, audio: true, instructions: true, alternatives: true,
        progression: true, brazilian: true, accessibility: true, references: true,
      },
    }));
    expect(await screen.findByText(/aprovada e publicada/)).toBeTruthy();
  });

  it('can request changes without publishing and sends a reviewer note', async () => {
    englishMock.reviewCourse.mockResolvedValue({
      review_id: 'review-2', course_code: queueItem.course_code, content_version: 1,
      decision: 'CHANGES_REQUESTED', reviewer_name: 'Revisora Humana', reviewer_email: 'reviewer@example.test',
      reviewed_at: '2026-10-25T12:00:00.000Z', snapshot_fingerprint: preview.snapshot_fingerprint,
    });
    render(<MemoryRouter><TecEnglishReviewQueuePage /></MemoryRouter>);
    const decision = await screen.findByRole('button', { name: 'Solicitar alterações e manter em STAGING' });
    fireEvent.change(screen.getByLabelText('Observações registradas'), { target: { value: 'Rever as alternativas da segunda atividade.' } });
    fireEvent.click(decision);
    await waitFor(() => expect(englishMock.reviewCourse).toHaveBeenCalledWith(expect.objectContaining({ decision: 'CHANGES_REQUESTED' })));
    expect(await screen.findByText(/devolvida para ajustes/)).toBeTruthy();
    expect(within(screen.getByRole('status')).getByText(/Revisora Humana/)).toBeTruthy();
  });

  it('enables gradual release for a single institution only from a currently approved version', async () => {
    englishMock.getReviewQueue.mockResolvedValue([]);
    englishMock.getReviewHistory.mockResolvedValue([{
      course_code: queueItem.course_code,
      course_title: queueItem.title,
      content_version: 1,
      snapshot_fingerprint: preview.snapshot_fingerprint,
      decision: 'APPROVED',
      notes: 'Revisão pedagógica concluída para homologação.',
      reviewer_profile_id: 'reviewer-1',
      reviewer_name: 'Revisora Humana',
      reviewer_email: 'reviewer@example.test',
      reviewed_at: '2026-10-25T12:00:00.000Z',
    }]);

    render(<MemoryRouter><TecEnglishReviewQueuePage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Gerenciar instituições' }));
    expect(await screen.findByText('Escola de Homologação')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Habilitar nesta instituição' }));
    await waitFor(() => expect(englishMock.setInstitutionRelease).toHaveBeenCalledWith({
      courseCode: queueItem.course_code,
      contentVersion: 1,
      institutionId: 'school-1',
      enabled: true,
    }));
    expect(await screen.findByText('Curso habilitado em Escola de Homologação.')).toBeTruthy();
  });
});
