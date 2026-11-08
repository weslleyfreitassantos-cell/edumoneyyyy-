import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261108000100_guided_study_v11_global_orchestration.sql', import.meta.url),
  'utf8',
);

describe('guided study V11 orchestration migration contract', () => {
  it('resolves the student and active enrollment only within the requested institution/year', () => {
    expect(migration).toContain("'AMBIGUOUS_STUDENT'");
    expect(migration).toContain("'NO_ACTIVE_ENROLLMENT'");
    expect(migration).toContain("'AMBIGUOUS_ENROLLMENT'");
    expect(migration).toContain('academic_year.institution_id = p_institution_id');
    expect(migration).toContain('academic_year.active');
    expect(migration).toContain('private.learning_v2_scope_student(p_institution_id, v_student_id)');
  });

  it('recognizes canonical elementary grade values stored by class automation', () => {
    expect(migration).toContain("when value ~ '^[1-9]$' then jsonb_build_object('stage', 'ENSINO_FUNDAMENTAL', 'grade_level', value::smallint)");
    expect(migration).toContain("when 'ENSINO_MEDIO' then format('%sª série do Ensino Médio', v_grade_level)");
    expect(migration).toContain('revoke all on function private.normalize_learning_grade_context(text) from public, anon, authenticated');
  });

  it('uses published BNCC targets and V4 content, never demo-preview targets', () => {
    expect(migration).toContain('public.list_student_guided_learning_targets(p_institution_id, v_student_id)');
    expect(migration).toContain("target.availability_status in ('READY', 'NO_ACTIVE_SESSION')");
    expect(migration).toContain("question_set.scope = 'GLOBAL'");
    expect(migration).toContain("question_set.purpose = 'PROBE'");
    expect(migration).toContain('question_set.version = 4');
    expect(migration).toContain("coalesce(question_set.metadata->>'demo_preview_only', 'false') <> 'true'");
    expect(migration).toContain("coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'");
    expect(migration).toContain("coalesce(session.metadata->>'demo_preview', 'false') <> 'true'");
    expect(migration).toContain('public.start_bncc_guided_learning_session_v4(');
    expect(migration).not.toContain('DEMO_PREVIEW');
  });

  it('limits the initial diagnostic to students without evidence and resumes the same session', () => {
    expect(migration).toContain('v_initial_diagnostic := not coalesce((recommendation->>\'has_progress\')::boolean, false)');
    expect(migration).toContain("'initial_diagnostic', v_initial_diagnostic");
    expect(migration).toContain('perform pg_advisory_xact_lock(');
    expect(migration).toContain("recommendation->>'session_status' = 'PAUSED'");
    expect(migration).toContain("set status = 'ACTIVE', updated_at = now()");
  });

  it('keeps pause ownership checks and exposes only scoped authenticated RPCs', () => {
    expect(migration).toContain('private.learning_v2_scope_student(p_institution_id, v_student_id)');
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('session.student_id = v_student_id');
    expect(migration).toContain("revoke all on function public.pause_guided_study_v11(uuid, uuid) from public, anon");
    expect(migration).toContain('grant execute on function public.pause_guided_study_v11(uuid, uuid) to authenticated');
    expect(migration).toContain("- 'student_id'\n    - 'target_canonical_skill_id'");
  });
});
