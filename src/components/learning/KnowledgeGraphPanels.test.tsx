// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  StudentAdaptiveBridgeCard,
  TeacherKnowledgeGraphPanel,
  TeacherKnowledgeHeatmap,
} from './KnowledgeGraphPanels';

afterEach(() => cleanup());

describe('KnowledgeGraphPanels', () => {
  it('mostra estado, evidências e misconceptions humanas para matematica, portugues e historia', () => {
    render(
      <TeacherKnowledgeGraphPanel
        skills={[
          {
            subjectCode: 'MATHEMATICS', subjectName: 'Matemática', skillCode: 'MATH_PERCENT_OF_QUANTITY', skillTitle: 'Percentual de quantidade',
            state: 'NEEDS_REVIEW', mastery: 42, confidence: 0.78, evidenceCount: 5, strongEvidenceCount: 3,
            confirmedMisconceptions: [{ code: 'DISCOUNT_CONFUSED_WITH_FINAL_PRICE', state: 'CONFIRMED', confidence: 0.8 }],
          },
          {
            subjectCode: 'PORTUGUESE', subjectName: 'Língua Portuguesa', skillCode: 'PORTUGUESE_INFER_FROM_CLUES', skillTitle: 'Inferência',
            state: 'PRACTICING', mastery: 52, confidence: 0.72, evidenceCount: 4, strongEvidenceCount: 2,
            confirmedMisconceptions: [{ code: 'INFERENCE_TREATED_AS_CERTAINTY', state: 'CONFIRMED', confidence: 0.8 }],
          },
          {
            subjectCode: 'HISTORY', subjectName: 'História', skillCode: 'HISTORY_ORDER_EVENTS', skillTitle: 'Cronologia',
            state: 'NEEDS_REVIEW', mastery: 38, confidence: 0.7, evidenceCount: 3, strongEvidenceCount: 1,
            confirmedMisconceptions: [{ code: 'CHRONOLOGY_REVERSED', state: 'CONFIRMED', confidence: 0.8 }],
          },
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Mapa de aprendizagem' })).toBeTruthy();
    expect(screen.getAllByText('Precisa revisar')).toHaveLength(2);
    expect(screen.getByText((_, element) => element?.textContent === 'Domínio: 42%')).toBeTruthy();
    expect(screen.getByText(/Confunde desconto com preço final/)).toBeTruthy();
    expect(screen.getByText(/Trata inferência como certeza/)).toBeTruthy();
    expect(screen.getByText(/Inverte a ordem cronológica/)).toBeTruthy();
    expect(screen.queryByText(/DISCOUNT_CONFUSED_WITH_FINAL_PRICE/)).toBeNull();
  });

  it('mostra a distribuição da turma sem ranking', () => {
    render(
      <TeacherKnowledgeHeatmap
        rows={[{
          subjectCode: 'MATHEMATICS',
          skillCode: 'PERCENTAGE',
          masteredCount: 4,
          practicingCount: 3,
          needsReviewCount: 2,
          unknownCount: 1,
        }]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Mapa de aprendizagem da turma' })).toBeTruthy();
    expect(screen.getByText('Dominado 4')).toBeTruthy();
    expect(screen.getByText('Precisa revisar 2')).toBeTruthy();
    expect(screen.queryByText(/ranking/i)).toBeTruthy();
  });

  it('mostra estados vazio, carregando e erro sem quebrar a tela', () => {
    const { rerender } = render(<TeacherKnowledgeGraphPanel />);
    expect(screen.getByText('Ainda não há evidências mapeadas para este aluno.')).toBeTruthy();

    rerender(<TeacherKnowledgeHeatmap isLoading />);
    expect(screen.getByText('Carregando mapa da turma...')).toBeTruthy();

    rerender(<TeacherKnowledgeGraphPanel isError />);
    expect(screen.getByText('Não foi possível carregar o mapa de aprendizagem.')).toBeTruthy();
  });

  it('traduz a ponte de pré-requisito para uma orientação amigável do aluno', () => {
    render(<StudentAdaptiveBridgeCard plan={{
      decision: 'CROSS_SUBJECT_BRIDGE',
      reasonCode: 'PREREQUISITE_CONFIRMED_GAP',
      originalTargetSubject: 'Physics',
      originalTargetSkill: 'Average speed',
      currentSubject: 'Mathematics',
      currentSkill: 'Ratio and proportion',
    }} />);

    expect(screen.getByRole('region', { name: 'Orientação de aprendizagem' })).toBeTruthy();
    expect(screen.getByText(/Vamos reforçar um ponto importante/)).toBeTruthy();
    expect(screen.queryByText(/PREREQUISITE_CONFIRMED_GAP/)).toBeNull();
  });
});
