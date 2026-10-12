import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildV94FourthJourneyMigration, readV94FourthJourneyPack, validateV94FourthJourneyPack } from './generate-v9-fourth-journeys';

const pack = readV94FourthJourneyPack();
const migrationPath = new URL('../../supabase/migrations/20261011000700_bncc_v9_4_fourth_journey_expansion_v1.sql', import.meta.url);
const previewGuardPath = new URL('../../supabase/migrations/20261011000050_bncc_v4_missing_discipline_content_v9.sql', import.meta.url);

describe('TecEscola V9.4 fourth journeys', () => {
  it('contains one new preview journey per discipline with 20 unique questions and five learning purposes', () => {
    expect(validateV94FourthJourneyPack()).toEqual([]);
    expect(pack.journeys).toHaveLength(12);
    expect(new Set(pack.journeys.map((journey) => journey.subject)).size).toBe(12);
    expect(new Set(pack.journeys.map((journey) => journey.skill)).size).toBe(12);
    expect(new Set(pack.journeys.flatMap((journey) => journey.questions.map((question) => question.id))).size).toBe(240);
    expect(pack.journeys.every((journey) => journey.questions.length === 20)).toBe(true);
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.mappingStatus).toBe('MAPPING_PENDING');
    expect(pack.publicationStatus).toBe('DEMO_PREVIEW');
    for (const journey of pack.journeys) {
      expect(journey.lesson.progressiveExplanation.length).toBeGreaterThanOrEqual(3);
      expect(journey.lesson.workedExample.length).toBeGreaterThan(220);
      expect(journey.lesson.remediations).toHaveLength(2);
      expect(journey.questions.every((question) => question.options.length === 4
        && question.options.includes(question.correctAnswer)
        && question.explanation.length >= 25)).toBe(true);
      expect(Object.fromEntries(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'].map((purpose) => [
        purpose,
        journey.questions.filter((question) => question.purpose === purpose).length,
      ]))).toEqual({ PROBE: 2, PRACTICE: 8, TRANSFER: 4, LOCK_IN: 3, REVIEW: 3 });
    }
  });

  it('keeps authored answer keys and explanations consistent for representative quantitative items', () => {
    const questions = new Map(pack.journeys.flatMap((journey) => journey.questions.map((question) => [question.id, question])));
    const checked: Record<string, string> = {
      'v94-math-equations-01': '12 + 5n',
      'v94-math-equations-03': '6',
      'v94-math-equations-10': '10',
      'v94-physics-waves-01': '8 m/s',
      'v94-chem-solutions-02': '5 g/L',
      'v94-chem-solutions-04': '20 g/L',
    };
    for (const [id, answer] of Object.entries(checked)) expect(questions.get(id)?.correctAnswer).toBe(answer);
  });

  it('generates a reproducible migration with forward dependency and demo-only state', () => {
    const checkedIn = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
    const generated = buildV94FourthJourneyMigration().replace(/\r\n/g, '\n');
    expect(generated).toBe(checkedIn);
    expect(generated.match(/"content_id":\s*"v94-/g)).toHaveLength(240);
    expect(generated).toContain("for v_question in select value from jsonb_array_elements(v_journey->'questions') loop");
    expect(generated).toContain('V94_REQUIRES_MIGRATIONS_00500_AND_00600');
    expect(generated).toContain("'DEMO_PREVIEW','MAPPING_PENDING','PEDAGOGICAL_REVIEW_PENDING'");
    expect(generated).toContain("'CANDIDATE','STAGING'");
    expect(generated).toContain('demo_preview_only');
    expect(generated).not.toContain("'publication_status','PUBLISHED'");
    expect(generated).not.toContain("'pedagogical_review_status','PEDAGOGICAL_REVIEWED'");
    expect(generated).not.toContain("'mapping_status','MAPPED'");
    expect(generated).not.toMatch(/delete\s+from\s+public\.learning_(guided_sessions|guided_steps|guided_step_attempts)/i);
    expect(generated).not.toMatch(/truncate\s+/i);
  });

  it('relies on the existing row-level preview boundary and does not create official BNCC mappings', () => {
    const previewGuard = readFileSync(previewGuardPath, 'utf8');
    const generated = buildV94FourthJourneyMigration();
    expect(previewGuard).toContain("metadata->>'demo_preview_only' is distinct from 'true'");
    expect(generated).toMatch(/"demo_preview_only":\s*true/);
    expect(generated).not.toContain('learning_bncc_discipline_journey_skills(');
    expect(generated).not.toContain('official_code');
  });
});
