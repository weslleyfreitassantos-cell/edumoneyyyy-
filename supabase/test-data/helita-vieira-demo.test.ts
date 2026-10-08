import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(new URL('./helita-vieira-demo.sql', import.meta.url), 'utf8');

describe('Colégio Helita Vieira academic demo fixture', () => {
  it('is scoped to the audited institution and reuses its academic structure', () => {
    expect(fixture).toContain("where id = '1663123e-5046-41c5-a7db-f712da058536'::uuid");
    expect(fixture).toContain("lower(trim(name)) = lower(trim('Colégio Helita Vieira'))");
    expect(fixture).toContain('from public.timetable_version_entries entry');
    expect(fixture).not.toMatch(/insert\s+into\s+public\.(institutions|classes|students|enrollments|subjects|subject_offerings|timetable_versions)\b/i);
    expect(fixture).not.toContain('auth.users');
  });

  it('is idempotent and keeps the published timetable untouched', () => {
    expect(fixture).toContain('begin;');
    expect(fixture).toContain('commit;');
    expect(fixture).toContain('on conflict (id) do update');
    expect(fixture).toContain("date '2026-10-07'");
    expect(fixture).not.toMatch(/insert\s+into\s+public\.timetable_versions\b/i);
    expect(fixture).not.toMatch(/update\s+public\.timetable_versions\b/i);
  });
});
