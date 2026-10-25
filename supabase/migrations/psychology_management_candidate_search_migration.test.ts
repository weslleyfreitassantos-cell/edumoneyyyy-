import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261025000100_psychology_management_candidate_search.sql', import.meta.url),
  'utf8',
);

describe('psychology management candidate search migration', () => {
  it('uses a manager-only server-side RPC with bounded pagination', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('private.psychology_is_manager(target_institution_id)');
    expect(migration).toContain("message = 'NOT_AUTHORIZED'");
    expect(migration).toContain('greatest(1, least(coalesce(page_number, 1), 100000))');
    expect(migration).toContain('greatest(1, least(coalesce(page_size, 25), 100))');
    expect(migration).toContain("from public, anon");
    expect(migration).toContain('to authenticated');
  });

  it('groups presentation by stable profile identity while retaining registration identifiers', () => {
    expect(migration).toContain('group by profile.id');
    expect(migration).toContain("'profile_id', candidate.profile_id");
    expect(migration).toContain("'student_id', student.id");
    expect(migration).toContain("'registration_number', student.registration_number");
    expect(migration).toContain("'authorization_status', consent.status");
    expect(migration).not.toMatch(/\bauthorization\s*\./);
    expect(migration).toContain("'assigned_professionals'");
  });

  it('keeps student, enrollment, class, and academic-year reads inside the requested institution', () => {
    expect(migration).toContain('student.institution_id = target_institution_id');
    expect(migration).toContain('class.institution_id = target_institution_id');
    expect(migration).toContain('academic_year.institution_id = target_institution_id');
    expect(migration).toContain("membership.role = 'STUDENT'::public.user_role");
  });
});
