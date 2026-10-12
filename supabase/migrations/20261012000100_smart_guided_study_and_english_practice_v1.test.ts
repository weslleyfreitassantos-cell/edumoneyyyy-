import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261012000100_smart_guided_study_and_english_practice_v1.sql', import.meta.url),
  'utf8',
);

describe('smart guided study and reduced English practice migration', () => {
  it('derives the student from the authenticated profile and rejects ambiguous identities', () => {
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('cardinality(student_ids) <> 1');
    expect(migration).toContain('private.learning_v2_scope_student(p_institution_id, p_student_id)');
    expect(migration).toContain('private.bncc_demo_preview_allowed(p_institution_id, p_student_id)');
    expect(migration).toContain('public.get_recommended_guided_study_v10(uuid, uuid)');
    expect(migration).not.toMatch(/get_recommended_guided_study_v10\([^)]*p_student_id/i);
  });

  it('derives grade from one active enrollment and the active academic year', () => {
    expect(migration).toContain('create or replace function private.assert_bncc_discipline_journey_v9');
    expect(migration).toContain("journey.suggested_stage is not null");
    expect(migration).toContain('journey.suggested_grade > 0');
    expect(migration).not.toContain("journey.suggested_stage = 'ENSINO_MEDIO'");
    expect(migration).not.toContain('journey.suggested_grade = 1');
    expect(migration).toContain('enrollment.academic_year_id = class.academic_year_id');
    expect(migration).toContain('academic_year.active');
    expect(migration).toContain('enrollment.active');
    expect(migration).toContain("upper(enrollment.status::text) = 'ACTIVE'");
    expect(migration).toContain('private.normalize_learning_grade_context(class.grade_level)');
    expect(migration).toContain("'AMBIGUOUS_ENROLLMENT'");
    expect(migration).toContain("'GRADE_NOT_SUPPORTED'");
  });

  it('prioritizes compatible sessions and due review, then deterministic unresolved content', () => {
    expect(migration).toContain("session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')");
    expect(migration).toContain("order by case session.status when 'ACTIVE' then 0 when 'PAUSED' then 1");
    expect(migration).toContain('review.review_due_at <= now()');
    expect(migration).toContain("coalesce(state.state, 'UNKNOWN') = 'NEEDS_REVIEW'");
    expect(migration).toContain('eligible.review_due desc');
    expect(migration).toContain('case when eligible.has_progress then eligible.progress else 0 end asc');
    expect(migration).toContain('eligible.journey_code');
    expect(migration).toContain("'CONTENT_EXHAUSTED'");
    expect(migration).toContain('coalesce(state.state, \'UNKNOWN\') <> \'MASTERED\'');
  });

  it('starts only the server recommendation, serializes repeated clicks, and preserves pending review status', () => {
    expect(migration).toContain('pg_advisory_xact_lock(hashtextextended(');
    expect(migration).toContain("recommendation->>'state' not in ('READY', 'REVIEW')");
    expect(migration).toContain('public.start_guided_discipline_journey_v9(');
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'demonstration_only', true");
    expect(migration).toContain('session_row.class_id is distinct from');
  });

  it('keeps English eligibility tied to the current official provider-text pool and offers the real reduced count', () => {
    expect(migration).toContain('private.enem_ready_provider_text_questions(null, \'INGLES\', \'ENGLISH\')');
    expect(migration).toContain('least(counts.question_count, counts.pool_count)');
    expect(migration).toContain("'planned_question_count', counts.question_count");
    expect(migration).toContain("'reduced_practice', counts.pool_count > 0 and counts.pool_count < counts.question_count");
    expect(migration).toContain('requested_count := least(simulation_row.question_count, available_count)');
    expect(migration).toContain('private.current_enem_content_revision()');
    expect(migration).toContain('structured_content_id');
    expect(migration).toContain('ENEM_ATTEMPT_SNAPSHOT_INCOMPLETE');
    expect(migration).toContain('public.start_enem_simulation_attempt_v2(');
    expect(migration).toContain('language_choice <> \'ENGLISH\'');
    expect(migration.indexOf('return public.start_enem_simulation_attempt_v2(')).toBeLessThan(
      migration.indexOf('if language_choice is not null and language_choice <> \'ENGLISH\' then'),
    );
    expect(migration).not.toContain('generate_series(');
    expect(migration).not.toContain('union all');
  });
});
