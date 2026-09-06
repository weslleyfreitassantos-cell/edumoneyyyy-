import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260905223339_learning_posts_and_materials.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('learning posts migration', () => {
  it('creates the isolated learning content domain', () => {
    expect(migrationSql).toContain('create table public.learning_posts');
    expect(migrationSql).toContain('create table public.learning_post_attachments');
    expect(migrationSql).toContain('create table public.learning_post_reads');
    expect(migrationSql).toContain("post_type in ('MATERIAL', 'NOTICE')");
    expect(migrationSql).not.toContain('assignments');
    expect(migrationSql).not.toContain('institution_announcements');
  });

  it('keeps files private and limits access to signed-in users with post scope', () => {
    expect(migrationSql).toContain("'learning-materials',");
    expect(migrationSql).toContain("false,\n  26214400");
    expect(migrationSql).toContain('on storage.objects for select to authenticated');
    expect(migrationSql).toContain('post.created_by = auth.uid()');
    expect(migrationSql).toContain("membership.role = 'TEACHER'::public.user_role");
    expect(migrationSql).toContain("lower(btrim(enrollment.status)) = 'active'");
  });
});
