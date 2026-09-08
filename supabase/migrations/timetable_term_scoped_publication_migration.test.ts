import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260901000100_fix_timetable_term_scoped_publication.sql', import.meta.url),
  'utf8',
);

describe('timetable publication term scoping migration', () => {
  it('scopes class, subject and teacher limits by term', () => {
    expect(migration).toContain('group by entry.class_id, entry.term_id, entry.day_of_week');
    expect(migration).toContain('group by offering.class_id, offering.subject_id, entry.term_id, entry.day_of_week');
    expect(migration).toContain('group by offering.teacher_profile_id, entry.term_id, entry.day_of_week');
    expect(migration).toContain('group by offering.teacher_profile_id, entry.term_id');
  });

  it('replaces the publication function and restricts execution to signed-in roles', () => {
    expect(migration).toContain('create or replace function public.publish_timetable_version(p_version_id uuid)');
    expect(migration).toContain('revoke all on function public.publish_timetable_version(uuid) from public, anon;');
    expect(migration).toContain('grant execute on function public.publish_timetable_version(uuid) to authenticated, service_role;');
  });

  it('checks active offerings even when a draft has zero entries for one', () => {
    expect(migration).toContain('and term.academic_year_id = version_row.academic_year_id');
    expect(migration).toContain('curriculum.is_complementary is false');
    expect(migration).toContain('and entry.subject_offering_id = entry_row.id');
    expect(migration).toContain('if generated_lessons <> required_lessons then');
  });
});
