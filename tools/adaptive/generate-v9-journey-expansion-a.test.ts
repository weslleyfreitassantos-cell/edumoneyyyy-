import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildV9JourneyExpansionMigration, readV9JourneyExpansionPack, validateV9JourneyExpansion } from './generate-v9-journey-expansion-a';

const pack = readV9JourneyExpansionPack();

const migrationPath = new URL('../../supabase/migrations/20261011000600_bncc_v9_journey_expansion_v1.sql', import.meta.url);

describe('V9.3 journey expansion', () => {
  it('contains twenty-four complete, distinct skill journeys with twenty questions and all five purposes each', () => {
    expect(validateV9JourneyExpansion()).toEqual([]);
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.journeys).toHaveLength(24);
    expect(new Set(pack.journeys.map((journey) => journey.skill)).size).toBe(24);
    expect(new Set(pack.journeys.flatMap((journey) => journey.questions.map((question) => question.id))).size).toBe(480);
    for (const journey of pack.journeys) {
      expect(journey.questions).toHaveLength(20);
      expect(new Set(journey.questions.map((question) => question.statement.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())).size).toBe(20);
      expect(journey.lesson.objective.length).toBeGreaterThan(45);
      expect(journey.lesson.progressiveExplanation.length).toBeGreaterThanOrEqual(3);
      expect(journey.lesson.workedExample.length).toBeGreaterThan(220);
      expect(journey.lesson.remediations).toHaveLength(2);
      expect(journey.questions.every((question) => question.options.length === 4 && question.options.includes(question.correctAnswer) && question.explanation.length > 20)).toBe(true);
      expect(Object.fromEntries(['PROBE','PRACTICE','TRANSFER','LOCK_IN','REVIEW'].map((purpose) => [purpose, journey.questions.filter((question) => question.purpose === purpose).length])))
        .toEqual({ PROBE: 2, PRACTICE: 8, TRANSFER: 4, LOCK_IN: 3, REVIEW: 3 });
    }
  });

  it('checks independently calculated answers for percentages, data tables and motion', () => {
    const answers = new Map(pack.journeys.flatMap((journey) => journey.questions.map((question) => [question.id, question.correctAnswer])));
    const expected: Record<string, string> = {
      'v93-math-table-06': '4/15',
      'v93-math-table-10': 'A proporção é maior no grupo da manhã: 60% contra 40%.',
      'v93-math-table-12': '16 min',
      'v93-math-successive-01': 'R$ 96',
      'v93-math-successive-10': 'Loja A: R$ 420, contra R$ 408 na loja B; B é menor.',
      'v93-math-successive-14': 'R$ 7.744',
      'v93-phys-graph-07': '4 m/s²',
      'v93-phys-graph-12': '24 m',
      'v93-phys-units-07': '20 m/s',
      'v93-phys-units-14': 'A conta numérica dá 0,5 km/s; para km/h, converta segundos em horas.',
    };
    for (const [id, answer] of Object.entries(expected)) expect(answers.get(id)).toBe(answer);
  });

  it('preserves independently checked reasoning across the new humanities, arts and physical education journeys', () => {
    const answers = new Map(pack.journeys.flatMap((journey) => journey.questions.map((question) => [question.id, question.correctAnswer])));
    const expected: Record<string, string> = {
      'v93-phil-ethics-03': 'O direito de participação e alternativas de acessibilidade, além dos efeitos para o grupo.',
      'v93-phil-argument-02': 'Sim, a forma liga a classe geral ao caso particular.',
      'v93-soc-inequality-01': 'A: 30%; B: 30%.',
      'v93-soc-inequality-13': 'Aumentou 5 pontos percentuais, ou 25% em relação aos 20% iniciais.',
      'v93-soc-norms-05': 'Valor: cooperação; norma: compartilhar tarefas no trabalho em grupo.',
      'v93-art-interpret-02': 'A convergência pode conduzir o olhar à figura, embora ela ocupe pouca área.',
      'v93-art-context-01': 'Há uma relação documentada entre encomenda, espaço público e destino inicial.',
      'v93-pe-principles-09': 'Passar para a opção livre, considerando distância, risco e objetivo.',
      'v93-pe-safe-15': 'Adicionar uma regra por vez e observar se o objetivo continua claro.',
    };
    for (const [id, answer] of Object.entries(expected)) expect(answers.get(id)).toBe(answer);
  });

  it('generates a reproducible preview-only migration with no invented approval or mapping', () => {
    const checkedIn = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
    const generated = buildV9JourneyExpansionMigration().replace(/\r\n/g, '\n');
    expect(generated).toBe(checkedIn);
    expect(generated.match(/insert into public\.learning_question_bank\(/g)).toHaveLength(480);
    expect(generated).toContain("'DEMO_PREVIEW','MAPPING_PENDING','PEDAGOGICAL_REVIEW_PENDING'");
    expect(generated).toContain("values(v_skill_id,4,");
    expect(generated).toContain("and version=4 and active");
    expect(generated).toContain("publication_status='STAGING'");
    expect(generated).toContain('LEARNING_V9_DEMO_SKILL_REQUIRES_JOURNEY');
    expect(generated).not.toContain("and version=5");
    expect(generated).not.toContain("'publication_status','PUBLISHED'");
    expect(generated).not.toContain("'pedagogical_review_status','PEDAGOGICAL_REVIEWED'");
    expect(generated).not.toContain("'mapping_status','MAPPED'");
    expect(generated).toContain('SERVER_SELECTED_V1');
  });
});
