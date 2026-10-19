import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261019000200_bncc_aurora_demo_preview_v1.sql', import.meta.url),
  'utf8',
);

describe('Aurora BNCC demonstration preview enablement', () => {
  it('targets only the unique active Aurora fixture and requires an active fixture enrollment', () => {
    expect(migration).toContain("institution.public_slug = 'aurora-integral'");
    expect(migration).toContain('candidate_count <> 1');
    expect(migration).toContain('if candidate_count = 0 then');
    expect(migration).toContain("auth_user.raw_user_meta_data->>'aurora_fixture' = 'AURORA_INTEGRAL_DEMO'");
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).toContain('class.institution_id = target_institution_id');
    expect(migration).toContain("journey.publication_status = 'DEMO_PREVIEW'");
    expect(migration).toContain("journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
  });

  it('creates exact-name subject bindings without publishing curriculum content', () => {
    expect(migration).toContain("('ART', 'ARTE', 'ART')");
    expect(migration).toContain("('BIO', 'BIOLOGIA', 'BIOLOGY')");
    expect(migration).toContain("'V9_DEMO_EXACT_SUBJECT_CODE_AND_NAME'");
    expect(migration).toContain('private.learning_demo_subject_bindings');
    expect(migration).toContain('private.bncc_demo_preview_institutions');
    expect(migration).not.toMatch(/update\s+public\.learning_bncc_discipline_journeys/i);
    expect(migration).not.toMatch(/publication_status\s*=\s*'PUBLISHED'/i);
    expect(migration).not.toMatch(/\b(drop\s+table|truncate\s|delete\s+from)\b/i);
  });
});
