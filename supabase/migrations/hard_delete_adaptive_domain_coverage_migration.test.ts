import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261003000200_hard_delete_adaptive_domain_coverage.sql',
  ),
  'utf8',
);

describe('hard delete adaptive domain coverage migration', () => {
  it('keeps the legacy function behind a validation savepoint wrapper', () => {
    expect(migration).toContain(
      'rename to hard_delete_client_account_legacy',
    );
    expect(migration).toContain(
      "__HARD_DELETE_VALIDATION_OK__",
    );
    expect(migration).toContain(
      'grant execute on function public.hard_delete_client_account(uuid, uuid, text, text, text, boolean)',
    );
  });

  it('covers adaptive learning, content, simulation, and timetable domains', () => {
    for (const table of [
      'learning_attempts',
      'learning_answers',
      'learning_skill_progress',
      'learning_student_skill_state',
      'learning_guided_sessions',
      'learning_simulation_attempts',
      'learning_error_notebook',
      'learning_skill_reviews',
      'learning_activities',
      'learning_posts',
      'timetable_versions',
      'timetable_version_entries',
    ]) {
      expect(migration).toContain(`delete from public.${table}`);
    }
  });

  it('does not grant the helper to client roles', () => {
    expect(migration).toContain(
      'revoke all on function public.delete_client_account_new_domains(uuid[]) from public, anon, authenticated',
    );
  });
});
