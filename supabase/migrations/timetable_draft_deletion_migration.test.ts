import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260824000100_timetable_draft_deletion.sql', import.meta.url),
  'utf8',
);

describe('timetable draft deletion migration', () => {
  it('exposes a protected RPC instead of direct delete privileges', () => {
    expect(migration).toContain('create or replace function public.delete_timetable_draft');
    expect(migration).toContain('security definer');
    expect(migration).toContain('public.can_manage_institution_operations');
    expect(migration).toContain("version_row.status <> 'DRAFT'");
    expect(migration).toContain('TIMETABLE_VERSION_NOT_DRAFT');
    expect(migration).toContain('revoke all on function public.delete_timetable_draft(uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.delete_timetable_draft(uuid) to authenticated, service_role');
    expect(migration).not.toContain('grant delete on table public.timetable_versions');
  });
});
