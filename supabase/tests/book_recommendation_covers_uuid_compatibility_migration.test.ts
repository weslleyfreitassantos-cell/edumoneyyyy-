import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260924000100_fix_book_cover_uuid_validation.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

const originalMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260910000300_book_recommendation_covers.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

const uuidSyntax = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oldRfc4122Syntax = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const auroraDeterministicUuid = '3a79f017-f9b3-aa50-7332-830cb0ec325d';

describe('book recommendation cover UUID compatibility migration', () => {
  it('accepts Aurora UUIDs while rejecting malformed paths', () => {
    expect(uuidSyntax.test(auroraDeterministicUuid)).toBe(true);
    expect(oldRfc4122Syntax.test(auroraDeterministicUuid)).toBe(false);
    expect(uuidSyntax.test('not-a-uuid')).toBe(false);
    expect(migrationSql).toContain('return segment::uuid');
    expect(migrationSql).toContain(
      "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    );
    expect(migrationSql).not.toContain(
      "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    );
  });

  it('keeps the helper locked down and preserves authorization boundaries', () => {
    expect(migrationSql).toContain(
      'create or replace function private.book_cover_path_uuid(',
    );
    expect(migrationSql).toContain('security definer');
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain(
      'revoke all on function private.book_cover_path_uuid(text, integer)',
    );
    expect(migrationSql).toContain(
      'grant execute on function private.book_cover_path_uuid(text, integer)',
    );

    expect(originalMigrationSql).toContain(
      'recommendation.institution_id = private.book_cover_path_uuid(target_path, 1)',
    );
    expect(originalMigrationSql).toContain(
      'recommendation.created_by = (select auth.uid())',
    );
    expect(originalMigrationSql).toContain(
      'private.book_is_teacher_for_offering(',
    );
    expect(originalMigrationSql).toContain(
      'private.book_is_student_enrolled_in_offering(',
    );
    expect(originalMigrationSql).toContain("public = false");
    expect(originalMigrationSql).toContain('for insert');
    expect(originalMigrationSql).toContain('for select');
    expect(originalMigrationSql).toContain('for update');
    expect(originalMigrationSql).toContain('for delete');
  });
});
