import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261026000300_tec_english_adaptive_v2.sql'),
  'utf8',
);
const source = readFileSync(resolve(process.cwd(), 'content/english/tec-english-everyday-v2.mjs'), 'utf8');

describe('Tec Inglês adaptive V2 qualification safeguards', () => {
  it('keeps candidate content staged and changes its exact version after corrections', () => {
    expect(source).toContain("version: 3,");
    expect(source).toContain("publicationStatus: 'STAGING'");
    expect(source).toContain("reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'STAGING', 'PEDAGOGICAL_REVIEW_PENDING'");
  });

  it('aborts if the V2 snapshot extension changes a previously approved fingerprint', () => {
    expect(migration).toContain('create temporary table tec_english_v2_pre_migration_approvals');
    expect(migration).toContain('previous.fingerprint is distinct from');
    expect(migration).toContain('TEC_ENGLISH_V2_INVALIDATES_EXISTING_APPROVAL');
  });

  it('adds skill, difficulty and dialogue metadata to V2 snapshots only', () => {
    expect(migration).toContain("case when p_course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' or p_course_code like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%'");
  });

  it('chooses a not-yet-reviewed exercise before repeating one, then prefers the current difficulty', () => {
    const reviewSelector = migration.slice(
      migration.indexOf('create or replace function public.start_tec_english_skill_review_v2'),
      migration.indexOf('create or replace function public.submit_tec_english_skill_review_v2'),
    );
    const recencyOrder = reviewSelector.indexOf(') nulls first');
    const difficultyOrder = reviewSelector.indexOf('abs(exercise.difficulty_level - v_mastery.difficulty_level)');
    expect(recencyOrder).toBeGreaterThan(-1);
    expect(difficultyOrder).toBeGreaterThan(recencyOrder);
  });
});
