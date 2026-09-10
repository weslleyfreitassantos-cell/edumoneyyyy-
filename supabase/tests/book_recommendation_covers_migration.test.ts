import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260910000300_book_recommendation_covers.sql'),
  'utf8',
);

describe('book recommendation covers migration', () => {
  it('adds a tenant-scoped cover path and private bucket limits', () => {
    expect(migrationSql).toContain('add column if not exists cover_path text');
    expect(migrationSql).toContain("'book-recommendation-covers'");
    expect(migrationSql).toContain('public = false');
    expect(migrationSql).toContain('5242880');
    expect(migrationSql).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(migrationSql).toContain("cover_path like institution_id::text || '/' || id::text || '/%'");
  });

  it('keeps storage access behind teacher and student authorization helpers', () => {
    expect(migrationSql).toContain('private.book_cover_teacher_can_manage(name)');
    expect(migrationSql).toContain('private.book_cover_student_can_read(name)');
    expect(migrationSql).toContain('for insert\nto authenticated');
    expect(migrationSql).toContain('for select\nto authenticated');
    expect(migrationSql).toContain('for delete\nto authenticated');
    expect(migrationSql).toContain('revoke all on function private.book_cover_teacher_can_manage(text)');
    expect(migrationSql).toContain('revoke all on function private.book_cover_student_can_read(text)');
  });
});
