import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20260919000100_timetable_draft_generation_rpc.sql', import.meta.url), 'utf8');

describe('timetable draft generation RPC migration', () => {
  it('creates the version and entries in one transactional RPC', () => {
    expect(migration).toContain('create or replace function public.create_timetable_draft(');
    expect(migration).toContain('returns uuid');
    expect(migration).toContain('security definer');
    expect(migration).toContain('public.can_manage_institution_operations(p_institution_id)');
    expect(migration).toContain('insert into public.timetable_versions');
    expect(migration).toContain('insert into public.timetable_version_entries');
    expect(migration).toContain('jsonb_to_recordset(entries_payload)');
    expect(migration).toContain('grant execute on function public.create_timetable_draft');
  });

  it('rejects malformed payloads and cross-year entries before inserting', () => {
    expect(migration).toContain("jsonb_typeof(entries_payload) <> 'array'");
    expect(migration).toContain('TIMETABLE_VERSION_ENTRY_YEAR_SCOPE_MISMATCH');
    expect(migration).toContain('TIMETABLE_SOURCE_VERSION_SCOPE_MISMATCH');
  });
});
