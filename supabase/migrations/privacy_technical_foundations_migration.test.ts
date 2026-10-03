import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003000100_privacy_technical_foundations.sql'),
  'utf8',
);

describe('privacy technical foundations migration', () => {
  it('exposes a self-scoped JSON export and records the request', () => {
    expect(migration).toContain('create or replace function public.export_current_user_data()');
    expect(migration).toContain("'DATA_EXPORT'");
    expect(migration).toContain('where student_row.id in (select id from owned_students)');
    expect(migration).toContain('learning_simulation_attempts');
    expect(migration).not.toContain('learning_question_bank');
  });

  it('keeps retention preview explicitly dry-run only', () => {
    expect(migration).toContain('create or replace function public.preview_privacy_retention(');
    expect(migration).toContain("'RETENTION_DRY_RUN'");
    expect(migration).toContain("'dry_run', true");
    expect(migration).toContain("'actions', '[]'::jsonb");
  });

  it('denies anonymous access to privacy functions and audit rows', () => {
    expect(migration).toContain('revoke all on function public.export_current_user_data() from public, anon');
    expect(migration).toContain('revoke all on function public.preview_privacy_retention(uuid) from public, anon');
    expect(migration).toContain('using (actor_profile_id = (select auth.uid()))');
  });
});
