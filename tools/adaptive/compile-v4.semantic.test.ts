import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadV4Pack, validateV4Pack } from './compile-v4';

describe('V4 semantic ownership', () => {
  const pack = loadV4Pack();
  const matrixFile = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v4/content-matrix.json', 'utf8')) as {
    questions: Array<{ questionId: string; primarySkill: string; readiness: string; selectionEligible: boolean }>;
  };
  const matrix = matrixFile.questions;

  it('maps the representative mathematics topics to distinct canonical leaves', () => {
    const byId = new Map(pack.questions.map((question) => [question.id, question]));
    expect(byId.get('v3-mathematics-percentage-1')?.primarySkill).toBe('MATH_PERCENT_OF_QUANTITY');
    expect(byId.get('v3-mathematics-percentage-2')?.primarySkill).toBe('MATH_PERCENT_INCREASE');
    expect(byId.get('v3-mathematics-percentage-5')?.primarySkill).toBe('MATH_RATIO_UNIT_RATE');
    expect(byId.get('v3-mathematics-percentage-6')?.primarySkill).toBe('MATH_SUCCESSIVE_PERCENT_CHANGE');
    expect(byId.get('v3-mathematics-percentage-5')?.supportingSkills).toEqual([]);
  });

  it('activates the minimum real proof slices with the full adaptive contract', () => {
    const required = [
      'MATH_PERCENT_OF_QUANTITY',
      'MATH_RATIO_UNIT_RATE',
      'PHYSICS_AVERAGE_SPEED',
      'PORTUGUESE_ARGUMENT_EVIDENCE',
      'HISTORY_INTERPRET_EVIDENCE',
    ];
    const minimums = { PROBE: 2, PRACTICE: 2, TRANSFER: 1, LOCK_IN: 1, REVIEW: 2 } as const;
    for (const code of required) {
      const leaf = pack.leaves.find((item) => item.code === code);
      expect(leaf?.readiness).toBe('ADAPTIVE_READY');
      expect(pack.lessons.some((lesson) => lesson.skill === code)).toBe(true);
      const questions = pack.questions.filter((question) => question.primarySkill === code);
      for (const [purpose, minimum] of Object.entries(minimums)) {
        expect(questions.filter((question) => question.purpose === purpose).length).toBeGreaterThanOrEqual(minimum);
      }
      expect(new Set(questions.map((question) => question.contextFamily)).size).toBeGreaterThanOrEqual(4);
    }
    expect(pack.leaves.find((item) => item.code === 'MATH_IDENTIFY_PERCENT_BASE')?.readiness).toBe('GRAPH_ONLY');
    expect(pack.leaves.find((item) => item.code === 'PORTUGUESE_INFER_FROM_CLUES')?.readiness).toBe('GRAPH_ONLY');
    expect(pack.leaves.find((item) => item.code === 'HISTORY_ORDER_EVENTS')?.readiness).toBe('GRAPH_ONLY');
  });

  it('keeps the Physics to Math prerequisite bridge actionable and attributed', () => {
    expect(pack.relationships.prerequisites).toContainEqual(['PHYSICS_AVERAGE_SPEED', 'MATH_RATIO_UNIT_RATE']);
    const physicsQuestions = pack.questions.filter((question) => question.primarySkill === 'PHYSICS_AVERAGE_SPEED');
    expect(physicsQuestions.length).toBeGreaterThanOrEqual(8);
    expect(physicsQuestions.every((question) => question.prerequisiteSkills.includes('MATH_RATIO_UNIT_RATE'))).toBe(true);
    expect(matrix.find((item) => item.primarySkill === 'MATH_RATIO_UNIT_RATE')?.readiness).toBe('ADAPTIVE_READY');
    const migration = readFileSync('supabase/migrations/20261001000100_adaptive_learning_pedagogical_depth_v4.sql', 'utf8');
    expect(migration).toContain('candidate_skill := private.pick_learning_v2_next_skill');
    expect(migration).toContain('CONTENT_NOT_READY');
    expect(migration).not.toContain("event_type, step_id, idempotency_key, payload) values (session_row.institution_id, session_row.id, session_row.student_id, 'CONTENT_NOT_READY'");
    expect(migration).not.toContain("event_type, step_id, idempotency_key, payload) values (session_row.institution_id, session_row.id, session_row.student_id, 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'");
    expect(migration).toContain('v4-authored-mathematics-ratio-probe-01');
  });

  it('separates Portuguese inference, thesis/evidence, genre and source comparison', () => {
    const byTopic = new Map(pack.questions.filter((question) => question.subject === 'PORTUGUESE').map((question) => [question.topic, question.primarySkill]));
    expect(byTopic.get('editorial e tese')).toBe('PORTUGUESE_ARGUMENT_EVIDENCE');
    expect(byTopic.get('comparacao de fontes')).toBe('PORTUGUESE_COMPARE_SOURCES');
    expect(byTopic.get('inferencia no conto')).toBe('PORTUGUESE_INFER_FROM_CLUES');
    expect(byTopic.get('anuncio publico')).toBe('PORTUGUESE_IDENTIFY_GENRE_PURPOSE');
  });

  it('separates History chronology, causality, perspective and change/continuity', () => {
    const byTopic = new Map(pack.questions.filter((question) => question.subject === 'HISTORY').map((question) => [question.topic, question.primarySkill]));
    expect(byTopic.get('cronologia')).toBe('HISTORY_ORDER_EVENTS');
    expect(byTopic.get('causa')).toBe('HISTORY_COMPARE_CAUSES');
    expect(byTopic.get('multiperspectiva')).toBe('HISTORY_COMPARE_PERSPECTIVES');
    expect(byTopic.get('mudanca')).toBe('HISTORY_ANALYZE_CHANGE_CONTINUITY');
  });

  it('keeps physics unit, graph, relative-speed and uniform-motion ownership explicit', () => {
    const byTopic = new Map(pack.questions.filter((question) => question.subject === 'PHYSICS').map((question) => [question.topic, question.primarySkill]));
    expect(byTopic.get('unidades')).toBe('PHYSICS_UNIT_CONVERSION');
    expect(byTopic.get('grafico posicao-tempo')).toBe('PHYSICS_INTERPRET_MOTION_GRAPH');
    expect(byTopic.get('encontro')).toBe('PHYSICS_RELATIVE_SPEED');
    expect(byTopic.get('movimento uniforme')).toBe('PHYSICS_UNIFORM_MOTION');
  });

  it('keeps V4 attribution metadata aligned with canonical primary ownership', () => {
    const validation = validateV4Pack(pack);
    expect(validation.valid).toBe(true);
    expect(validation.misconceptionAffectedSkillMismatches).toEqual([]);
    expect(validation.topicOwnershipCount).toBe(195);
    expect(matrix.find((item) => item.questionId === 'v3-history-history_interpretation-3')).toMatchObject({
      primarySkill: 'HISTORY_ORDER_EVENTS',
      readiness: 'GRAPH_ONLY',
      selectionEligible: false,
    });
    expect(matrix.find((item) => item.questionId === 'v4-authored-mathematics-review-01')).toMatchObject({
      primarySkill: 'MATH_PERCENT_OF_QUANTITY',
    });
    const migration = readFileSync('supabase/migrations/20261001000100_adaptive_learning_pedagogical_depth_v4.sql', 'utf8');
    expect(migration).toContain('semantic_topic_owner');
    expect(migration).toContain('v4-authored-mathematics-review-01');
    expect(migration).toContain('if v_set_id is not null then insert into public.learning_question_set_items');
  });

  it('provides at least three deterministic samples per subject and never selects graph-only content', () => {
    for (const subject of new Set(pack.questions.map((question) => question.subject))) {
      expect(pack.questions.filter((question) => question.subject === subject).slice(0, 3)).toHaveLength(3);
    }
    expect(matrix.filter((item) => item.readiness === 'GRAPH_ONLY' && item.selectionEligible)).toHaveLength(0);
  });
});
