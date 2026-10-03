import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261003000400_hard_delete_legacy_dependency_guard.sql',
  ),
  'utf8',
);

describe('hard delete legacy dependency guard migration', () => {
  it('removes restrictive institution-scoped dependencies before legacy deletion', () => {
    for (const table of [
      'access_events',
      'class_councils',
      'student_term_recoveries',
      'book_recommendations',
      'curriculum_templates',
      'teacher_subjects',
      'school_time_slots',
      'financial_contracts',
      'institution_announcements',
    ]) {
      expect(migration).toContain(`delete from public.${table}`);
    }
  });

  it('keeps the chained helper restricted to server-side execution', () => {
    expect(migration).toContain(
      'delete_client_account_new_domains_curriculum_guard',
    );
    expect(migration).toContain(
      'revoke all on function public.delete_client_account_new_domains(uuid[])',
    );
  });
});
