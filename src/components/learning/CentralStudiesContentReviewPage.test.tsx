// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import CentralStudiesContentReviewPage from './CentralStudiesContentReviewPage';

const reviewService = vi.hoisted(() => ({
  getQueue: vi.fn(),
  getPreview: vi.fn(),
  review: vi.fn(),
}));

vi.mock('../../services/centralStudiesContentReviewService', () => ({
  centralStudiesContentReviewService: reviewService,
}));

const item = {
  journey_code: 'CEV2_EF06MA03_OPERACOES_01', content_version: 'central-estudos-v2-candidate-2026-10-25.2',
  subject_area: 'MATHEMATICS', grade_level: 6, official_skill_code: 'EF06MA03', title: 'Estratégias com números naturais',
  snapshot_fingerprint: 'a'.repeat(64), review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING',
  reviewer_name: null, reviewer_email: null, reviewed_at: null, review_notes: null, updated_at: '2026-10-25T12:00:00Z',
} as const;

const preview = {
  ...item,
  payload: {
    journeyCode: item.journey_code, journeyTitle: item.title, subject: 'MATHEMATICS', grade: 6,
    officialSkillCode: 'EF06MA03', version: item.content_version, unitTitle: 'Números e operações',
    lesson: {
      title: 'Escolher uma estratégia para calcular', estimatedMinutes: 20, introduction: 'Uma aula de Matemática.', explanation: 'Explicação clara.',
      workedExample: { prompt: 'Exemplo', steps: ['Passo um'], answer: 'Resposta' },
      guidedPractice: [{ prompt: 'Prática', scaffold: 'Apoio' }], application: [{ context: 'Escola', prompt: 'Aplicação' }], review: ['Revisar'],
    },
    questions: [{ id: 'q1', purpose: 'PROBE', difficulty: 'EASY', statement: 'Quanto é 2 + 2?', options: ['3', '4'], correctAnswer: '4', explanation: 'Somamos dois e dois.', misconception: 'Contagem incorreta.' }],
  },
};

describe('CentralStudiesContentReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewService.getQueue.mockResolvedValueOnce([item]).mockResolvedValue([{
      ...item, review_status: 'PEDAGOGICAL_REVIEWED', reviewer_name: 'Revisora Humana', reviewer_email: 'reviewer@example.test',
      reviewed_at: '2026-10-25T13:00:00Z', review_notes: 'Revisão concluída.',
    }]);
    reviewService.getPreview.mockResolvedValueOnce(preview).mockResolvedValue({
      ...preview, review_status: 'PEDAGOGICAL_REVIEWED', reviewer_name: 'Revisora Humana',
      reviewer_email: 'reviewer@example.test', reviewed_at: '2026-10-25T13:00:00Z', review_notes: 'Revisão concluída.',
    });
    reviewService.review.mockResolvedValue({
      review_event_id: 'review-event-1', journey_code: item.journey_code, content_version: item.content_version,
      decision: 'APPROVED_FOR_INTEGRATION', publication_status: 'STAGING', reviewer_name: 'Revisora Humana',
      reviewer_email: 'reviewer@example.test', reviewed_at: '2026-10-25T13:00:00Z', snapshot_fingerprint: item.snapshot_fingerprint,
    });
  });

  afterEach(() => cleanup());

  it('previews lesson and answer explanations, and records a human approval without publishing', async () => {
    render(<MemoryRouter><CentralStudiesContentReviewPage /></MemoryRouter>);
    expect(await screen.findByText('Escolher uma estratégia para calcular')).toBeTruthy();
    expect(screen.getByText('Somamos dois e dois.')).toBeTruthy();
    expect(screen.getByText(/não as publica para estudantes/i)).toBeTruthy();

    const approve = screen.getByRole('button', { name: 'Aprovar para integração' });
    expect(approve).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Observações da revisão'), { target: { value: 'Revisei habilidade, explicação, exercícios e adequação da série.' } });
    for (const [, label] of [
      ['officialAlignment', 'A aula corresponde à habilidade BNCC indicada'],
      ['pedagogicalAccuracy', 'Explicações e exemplos estão corretos'],
      ['ageAndGradeSuitability', 'Linguagem e dificuldade são adequadas ao 6º ano'],
      ['clarityAndAccessibility', 'Instruções são claras e acessíveis'],
      ['answerQuality', 'Alternativas, respostas e explicações são consistentes'],
      ['culturalAndContextualSuitability', 'Contextos e referências são adequados'],
    ]) fireEvent.click(screen.getByLabelText(label));
    expect(approve).toHaveProperty('disabled', false);
    fireEvent.click(approve);

    await waitFor(() => expect(reviewService.review).toHaveBeenCalledWith(expect.objectContaining({
      journeyCode: item.journey_code,
      contentVersion: item.content_version,
      decision: 'APPROVED_FOR_INTEGRATION',
      expectedFingerprint: item.snapshot_fingerprint,
    })));
    expect(await screen.findByText(/segue em STAGING até ser integrada ao runtime/i)).toBeTruthy();
    expect(screen.getByText('Revisão aprovada para integração')).toBeTruthy();
    expect(screen.getByText(/não está disponível aos estudantes/i)).toBeTruthy();
  });
});
