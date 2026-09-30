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
  it('mostra estado, evidências e misconception confirmada para o professor', () => {
    render(
      <TeacherKnowledgeGraphPanel
        skills={[{
          subjectCode: 'PHYSICS',
          subjectName: 'Física',
          skillCode: 'PHYSICS_AVERAGE_SPEED',
          skillTitle: 'Velocidade média',
          state: 'NEEDS_REVIEW',
          mastery: 42,
          confidence: 0.78,
          evidenceCount: 5,
          strongEvidenceCount: 3,
          confirmedMisconceptions: [{ code: 'UNIT_CONVERSION', state: 'CONFIRMED', confidence: 0.8 }],
        }]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Mapa de aprendizagem' })).toBeTruthy();
    expect(screen.getByText('Precisa revisar')).toBeTruthy();
    expect(screen.getByText((_, element) => element?.textContent === 'Domínio: 42%')).toBeTruthy();
    expect(screen.getByText(/Unit Conversion/)).toBeTruthy();
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
