import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.resolve('supabase/migrations/20261103000100_release_verified_learning_content.sql'),
  'utf8',
);

describe('verified learning content release migration', () => {
  it('requires every student-facing publication gate', () => {
    expect(migration).toContain("skill.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'");
    expect(migration).toContain("skill.bncc_alignment_status = 'MAPPED'");
    expect(migration).toContain("skill.content_readiness = 'ADAPTIVE_READY'");
    expect(migration).toContain('and skill.mastery_targetable');
    expect(migration).toContain("lesson.version = 4");
    expect(migration).toContain('question_set.version = 4');
    expect(migration).toContain('question.active');
  });

  it('is forward-only, idempotent, and does not publish legacy teacher drafts', () => {
    expect(migration).toContain("skill.publication_status in ('STAGING', 'QA_ONLY')");
    expect(migration).toContain("pack.publication_status in ('STAGING', 'QA_ONLY')");
    expect(migration).not.toMatch(/update\s+public\.learning_activities/i);
    expect(migration).not.toMatch(/status\s*=\s*'PUBLISHED'[^\n]*learning_activities/i);
  });
});
