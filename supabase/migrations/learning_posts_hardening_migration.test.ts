import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260906003859_learning_posts_hardening.sql',
  ),
  'utf8',
);

describe('learning posts hardening migration', () => {
  it('adds the subject foreign-key index and avoids per-row auth lookups', () => {
    expect(migrationSql).toContain(
      'create index if not exists learning_posts_subject_idx',
    );
    expect(migrationSql).toContain('(select auth.uid())');
  });

  it('limits read receipts to posts visible to the active student', () => {
    expect(migrationSql).toContain(
      'create policy learning_post_reads_insert_policy',
    );
    expect(migrationSql).toContain(
      'join public.enrollments as enrollment on enrollment.class_id = post.class_id',
    );
    expect(migrationSql).toContain(
      "lower(btrim(enrollment.status)) = 'active'",
    );
    expect(migrationSql).toContain('curriculum.subject_id = post.subject_id');
  });
});
