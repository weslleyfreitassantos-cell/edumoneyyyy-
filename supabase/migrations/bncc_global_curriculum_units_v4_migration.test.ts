import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261012000500_bncc_global_curriculum_units_v4.sql', import.meta.url), 'utf8');
const stagingSql = readFileSync(new URL('../../content/bncc/authoring/curriculum-units-v4-staging.sql', import.meta.url), 'utf8');

describe('BNCC global curriculum unit V4 migration', () => {
  it('keeps canonical units global and separate from institution-owned learning_units', () => {
    expect(migration).toContain('create table public.learning_curriculum_units');
    expect(migration).toContain('create table public.learning_curriculum_unit_skills');
    expect(migration).toContain('references public.learning_curriculum_catalogs(id) on delete restrict');
    expect(migration).not.toContain('institution_id');
    expect(migration).not.toContain('public.learning_units');
  });

  it('denies authenticated writes and exposes only reviewed active units', () => {
    expect(migration).toContain('active boolean not null default false');
    expect(migration).toContain("publication_status = 'PUBLISHED'");
    expect(migration).toContain("pedagogical_review_status = 'PEDAGOGICALLY_REVIEWED'");
    expect(migration).toContain('alter table public.learning_curriculum_units enable row level security');
    expect(migration).toContain('using (active is true');
    expect(migration).toContain('revoke all on public.learning_curriculum_units, public.learning_curriculum_unit_skills from public, anon, authenticated');
    expect(migration).toContain('grant select on public.learning_curriculum_units, public.learning_curriculum_unit_skills to authenticated');
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all).*\bauthenticated\b/i);
  });

  it('guards same-catalog membership and requires active parents for active links', () => {
    expect(migration).toContain('LEARNING_CURRICULUM_UNIT_SKILL_CATALOG_MISMATCH');
    expect(migration).toContain('LEARNING_CURRICULUM_UNIT_SKILL_REQUIRES_ACTIVE_PARENTS');
    expect(migration).toContain('before insert or update on public.learning_curriculum_unit_skills');
  });

  it('generates only inactive, unmapped staging data without student writes', () => {
    expect(stagingSql).toContain("'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false");
    expect(stagingSql.match(/\(v_catalog_id, 'V[35]_/g) ?? []).toHaveLength(65);
    expect(stagingSql).not.toContain("'PUBLISHED'");
    expect(stagingSql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:guided_sessions|guided_steps|guided_step_attempts|student_skill_state|skill_evidence|enrollments)/i);
  });
});
