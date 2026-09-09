import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909000100_book_recommendations.sql'),
  'utf8',
);

describe('book recommendations migration', () => {
  it('creates the institution-scoped recommendation domain', () => {
    expect(migration).toContain('create table public.book_recommendations');
    expect(migration).toContain('subject_offering_id uuid not null');
    expect(migration).toContain('book_recommendations_institution_active_idx');
    expect(migration).toContain('book_recommendations_validate_tenant_integrity');
    expect(migration).toContain('public.touch_academic_record_updated_at');
  });

  it('keeps writes limited to the teacher own active offering and has no delete grant', () => {
    expect(migration).toContain('book_recommendations_teacher_insert');
    expect(migration).toContain('book_recommendations_teacher_update');
    expect(migration).toContain('private.is_teacher_for_offering');
    expect(migration).toContain('created_by = (select auth.uid())');
    expect(migration).not.toContain('for delete');
    expect(migration).toContain('grant select, insert, update');
  });

  it('exposes active recommendations only to enrolled students', () => {
    expect(migration).toContain('book_recommendations_student_select');
    expect(migration).toContain('active is true');
    expect(migration).toContain('private.is_student_enrolled_in_offering');
  });
});
