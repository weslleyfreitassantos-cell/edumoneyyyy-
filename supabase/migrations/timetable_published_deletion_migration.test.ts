import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '20260901000400_delete_published_timetable_version.sql'),
  'utf8',
);

describe('published timetable deletion migration', () => {
  it('creates a protected deletion function for draft and published versions', () => {
    expect(migration).toContain('create or replace function public.delete_timetable_version');
    expect(migration).toContain("version_row.status not in ('DRAFT', 'PUBLISHED')");
    expect(migration).toContain('grant execute on function public.delete_timetable_version(uuid) to authenticated, service_role');
  });

  it('deactivates only entries belonging to the published version before deleting it', () => {
    expect(migration).toContain('update public.timetable_entries as entry');
    expect(migration).toContain('version_entry.version_id = p_version_id');
    expect(migration).toContain('entry.room_id is not distinct from version_entry.room_id');
    expect(migration).toContain('delete from public.timetable_versions');
  });

  it('revokes unauthenticated execution', () => {
    expect(migration).toContain('revoke all on function public.delete_timetable_version(uuid) from public, anon');
  });
});
