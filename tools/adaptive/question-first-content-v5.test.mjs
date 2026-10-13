import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildMigration, validateQuestionFirstPack } from './compile-question-first-content-v5.mjs';

const pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v5/math-successive-percent-change.json', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../../supabase/migrations/20261012000700_bncc_question_first_content_staging_v5.sql', import.meta.url), 'utf8');

describe('question-first V5 staging content', () => {
  it('contains an authored lesson and two distinct questions for each adaptive purpose', () => {
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(result.questionCount).toBe(10);
    expect(result.contextCount).toBe(10);
    expect(result.counts).toEqual({ PROBE: 2, PRACTICE: 2, TRANSFER: 2, LOCK_IN: 2, REVIEW: 2 });
  });

  it('checks stems against the existing V9 bank and uses readable Portuguese copy', () => {
    const v9Pack = JSON.parse(readFileSync(new URL('../../content/adaptive/tec-escola-core-v9/journey-expansion-a-v1.json', import.meta.url), 'utf8'));
    const existingSkill = v9Pack.journeys.find((journey) => journey.skill === pack.canonicalSkillCode);
    expect(existingSkill?.questions).toHaveLength(20);
    expect(validateQuestionFirstPack(pack).errors.filter((error) => error.startsWith('DUPLICATE_STEM:'))).toEqual([]);
    expect(pack.lesson.title).toContain('variação');
    expect(pack.questions.some((question) => question.statement.includes('mês'))).toBe(true);
  });

  it('keeps the official mapping unclaimed and the content pending and inactive', () => {
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(migration).toContain("'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'publication_status', 'STAGING'");
    expect(migration).toContain("'bncc_alignment_status', 'NOT_CLAIMED'");
    expect(migration).toMatch(/active, metadata\)[\s\S]*?false/);
    expect(migration).not.toMatch(/active\s*=\s*true|,\s*true\s*\)/i);
  });

  it('is generated from the reviewed source pack and is rerunnable without publishing', () => {
    expect(migration).toBe(buildMigration(pack));
    expect(migration).toContain('on conflict (canonical_skill_id, purpose, version) where scope = \'GLOBAL\' do nothing');
    expect(migration).toContain('V5_CONTENT_QUESTION_SET_CONFLICT');
  });
});
