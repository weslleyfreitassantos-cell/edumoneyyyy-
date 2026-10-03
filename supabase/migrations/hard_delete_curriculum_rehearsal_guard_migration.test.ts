import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261003000300_hard_delete_curriculum_rehearsal_guard.sql',
  ),
  'utf8',
);

describe('hard delete curriculum rehearsal guard migration', () => {
  it('prepares protected offerings and timetable rows in the transaction', () => {
    expect(migration).toContain('set active = false');
    expect(migration).toContain('delete from public.timetable_entries');
    expect(migration).toContain(
      'delete_client_account_new_domains_legacy',
    );
  });

  it('keeps the helper unavailable to client roles', () => {
    expect(migration).toContain(
      'revoke all on function public.delete_client_account_new_domains(uuid[])',
    );
  });
});
