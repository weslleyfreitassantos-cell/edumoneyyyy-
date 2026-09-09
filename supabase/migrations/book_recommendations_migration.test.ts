import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260909001000_book_recommendations.sql'),
  'utf8',
);

const migrationFileName = '20260909001000_book_recommendations.sql';

function indexOfOrFail(value: string, search: string) {
  const index = value.indexOf(search);
  expect(index, `Expected migration to contain ${search}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe('book recommendations migration', () => {
  it('uses the next unique migration version after the learning center chain', () => {
    expect(migrationFileName).toBe('20260909001000_book_recommendations.sql');
    expect(migration).toContain('begin;');

    const migrationFiles = readdirSync(
      resolve(process.cwd(), 'supabase/migrations'),
    ).filter((fileName) => fileName.endsWith('.sql'));

    expect(
      migrationFiles.filter((fileName) => fileName.startsWith('20260909001000_')),
    ).toEqual([migrationFileName]);
  });

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
    expect(migration).toContain('private.book_offering_belongs_to_institution');
    expect(migration).toContain('private.book_is_teacher_for_offering');
    expect(migration).toContain('created_by = (select auth.uid())');
    expect(migration).not.toContain('for delete');
    expect(migration).toContain('grant select, insert, update');
  });

  it('exposes active recommendations only to enrolled students', () => {
    expect(migration).toContain('book_recommendations_student_select');
    expect(migration).toContain('active is true');
    expect(migration).toContain('private.book_is_student_enrolled_in_offering');
  });

  it('defines and grants the book-specific helpers before policies use them', () => {
    const helperNames = [
      'private.book_offering_belongs_to_institution',
      'private.book_is_teacher_for_offering',
      'private.book_is_student_enrolled_in_offering',
    ];

    for (const helperName of helperNames) {
      expect(migration).toContain(`create or replace function ${helperName}`);
      expect(migration).toContain(`security definer`);
      expect(migration).toContain(`set search_path = ''`);
      expect(migration).toContain(`revoke all on function ${helperName}(uuid, uuid)`);
      expect(migration).toContain(`grant execute on function ${helperName}(uuid, uuid)`);
      expect(indexOfOrFail(migration, `create or replace function ${helperName}`))
        .toBeLessThan(indexOfOrFail(migration, 'create policy book_recommendations_'));
    }
  });

  it('keeps the teacher and student policies scoped to the expected domain rules', () => {
    expect(migration).toContain('book_recommendations_teacher_insert');
    expect(migration).toContain('book_recommendations_teacher_update');
    expect(migration).toContain('offering.active is true');
    expect(migration).toContain('membership.role = \'TEACHER\'::public.user_role');
    expect(migration).toContain('membership.role = \'STUDENT\'::public.user_role');
    expect(migration).toContain('enrollment.active is true');
    expect(migration).not.toMatch(/grant[^;]*delete/i);
  });
});
