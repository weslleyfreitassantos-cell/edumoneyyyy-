import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261008000200_enem_source_faithful_attempt_revision_scope_fix.sql'),
  'utf8',
);

describe('ENEM source-faithful attempt revision scope repair', () => {
  it('renames the PL/pgSQL revision variable before recreating the RPC', () => {
    expect(migration).toContain('current_revision text := private.current_enem_content_revision();');
    expect(migration).toContain('attempt.content_revision = current_revision');
    expect(migration).toContain("'''content_revision'', current_revision'");
    expect(migration).toContain("'public.start_enem_simulation_attempt_v2(uuid,uuid,uuid,text)'::regprocedure");
  });
});
