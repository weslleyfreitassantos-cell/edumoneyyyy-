import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260910000400_academic_calendar_date_status.sql',
  ),
  'utf8',
);

describe('academic calendar date status migration', () => {
  it('keeps blocking rules limited to active all-day blocking event types', () => {
    expect(migration).toMatch(/event_record\.active is true/i);
    expect(migration).toMatch(/event_record\.all_day is true/i);
    expect(migration).toMatch(/HOLIDAY[\s\S]*RECESS[\s\S]*CLASS_SUSPENSION/i);
    expect(migration).not.toMatch(/event_record\.audience\s*=|audience\s+in/i);
  });

  it('uses inclusive UTC civil-date boundaries and optional scopes', () => {
    expect(migration).toContain("(event_record.starts_at at time zone 'UTC')::date <= p_date");
    expect(migration).toContain("(coalesce(event_record.ends_at, event_record.starts_at) at time zone 'UTC')::date >= p_date");
    expect(migration).toMatch(/event_record\.academic_year_id is null[\s\S]*event_record\.academic_year_id = p_academic_year_id/i);
    expect(migration).toMatch(/event_record\.class_id is null[\s\S]*event_record\.class_id = p_class_id/i);
    expect(migration).toMatch(/event_record\.subject_id is null[\s\S]*event_record\.subject_id = p_subject_id/i);
  });

  it('exposes an authenticated-only tenant-scoped security-definer RPC', () => {
    expect(migration).toMatch(/create or replace function public\.get_academic_day_blockers/i);
    expect(migration).toMatch(/security definer\s+set search_path = ''/i);
    expect(migration).toMatch(/if auth\.uid\(\) is null/i);
    expect(migration).toMatch(/public\.can_access_institution\(p_institution_id\)/i);
    expect(migration).toMatch(/revoke all on function public\.get_academic_day_blockers[\s\S]*from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.get_academic_day_blockers[\s\S]*to authenticated/i);
  });

  it('returns only blocker metadata with deterministic ordering', () => {
    expect(migration).toMatch(/returns table\s*\(\s*event_id uuid,\s*event_type public\.academic_calendar_event_type/i);
    expect(migration).toMatch(/order by[\s\S]*event_record\.id/i);
  });
});
