import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261110010546_guided_study_v16_subject_scoped_planner.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('guided study V16 subject planner migration contract', () => {
  it('binds only explicitly authored skills to exact disciplines, not whole BNCC areas', () => {
    expect(migration).toContain("('MAT', 'EM13MAT101')");
    expect(migration).toContain("('FIS', 'EM13CNT101')");
    expect(migration).not.toMatch(/\('HIS'|\('GEO'|\('FIL'|\('SOC'/);
    expect(migration).toContain("catalog.code = 'BNCC_2018'");
    expect(migration).toContain('subject.institution_id');
    expect(migration).toContain('binding.canonical_skill_id = target.target_canonical_skill_id');
  });

  it('adds the discipline restriction to every V11 candidate path and fails closed on drift', () => {
    expect(migration).toContain('subject_join_count = 3 and scoped_join_count = 0');
    expect(migration).toContain('subject_join_count = 3 and scoped_join_count = 3');
    expect(migration).toContain('GUIDED_STUDY_V16_V11_SOURCE_SHAPE_CHANGED');
    expect(migration).toContain('subject_link.subject_id = v_requested_subject_id');
    expect(migration).toContain('binding.canonical_skill_id = target.target_canonical_skill_id');
  });

  it('validates the student, active enrollment, school year, class and subject offering', () => {
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('student.institution_id = p_institution_id');
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).toContain('academic_year.institution_id = p_institution_id');
    expect(migration).toContain('class.academic_year_id = enrollment.academic_year_id');
    expect(migration).toContain('offering.subject_id = p_subject_id');
  });

  it('serializes starts per student before checking for an open session and recomputes under the lock', () => {
    const startFunction = migration.split('create or replace function public.start_guided_study_subject_v16')[1] ?? '';
    const lockPosition = startFunction.indexOf('pg_advisory_xact_lock(hashtextextended(v_student_id::text || \':\' || p_institution_id::text, 0))');
    const recheckPosition = startFunction.indexOf('recommendation := private.recommend_guided_study_v11(p_institution_id);', lockPosition);
    const openSessionPosition = startFunction.indexOf('select session.id, session.subject_id into v_open_session');

    expect(lockPosition).toBeGreaterThan(-1);
    expect(recheckPosition).toBeGreaterThan(lockPosition);
    expect(openSessionPosition).toBeGreaterThan(recheckPosition);
    expect(startFunction).toContain('started := public.start_guided_study_v11(p_institution_id)');
    expect(startFunction).toContain('session.id = (started->>\'session_id\')::uuid');
    expect(startFunction).toContain('session.institution_id = p_institution_id');
    expect(startFunction).toContain('session.student_id = v_student_id');
  });

  it('keeps the RPC authenticated and preserves historical evidence and sessions', () => {
    expect(migration).toContain('revoke all on function public.get_guided_study_subject_overview_v16(uuid, uuid) from public, anon');
    expect(migration).toContain('revoke all on function public.start_guided_study_subject_v16(uuid, uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.get_guided_study_subject_overview_v16(uuid, uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.start_guided_study_subject_v16(uuid, uuid) to authenticated');
    expect(migration).toContain("'subject_scope_version', 'V16'");
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.learning_(guided_sessions|skill_evidence|student_skill_state)/i);
  });
});
