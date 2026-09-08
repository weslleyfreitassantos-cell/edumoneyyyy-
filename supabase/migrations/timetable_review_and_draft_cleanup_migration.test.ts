import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20260828000100_timetable_review_and_draft_cleanup.sql', import.meta.url), 'utf8');

describe('timetable review and draft cleanup migration', () => {
  it('adds the review lookup index', () => {
    expect(migration).toContain('timetable_version_entries_review_idx');
    expect(migration).toContain('(version_id, institution_id, class_id, day_of_week, start_time)');
  });

  it('deletes only drafts after checking the manager tenant', () => {
    expect(migration).toContain('delete_timetable_draft');
    expect(migration).toContain('public.can_manage_institution_operations');
    expect(migration).toContain("version_row.status <> 'DRAFT'");
    expect(migration).toContain('TIMETABLE_VERSION_NOT_DRAFT');
    expect(migration).toContain('grant execute on function public.delete_timetable_draft(uuid) to authenticated, service_role');
  });
});
