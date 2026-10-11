import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261011000100_bncc_discipline_journeys_v9.sql', import.meta.url),
  'utf8',
);

describe('BNCC discipline journeys V9 migration', () => {
  it('binds only the twelve exact demo institution subjects and keeps journeys pending review', () => {
    expect(migration).toContain("'V9_DEMO_EXACT_SUBJECT_CODE_AND_NAME'");
    expect(migration).toContain("publication_status = 'DEMO_PREVIEW'");
    expect(migration).toContain("mapping_status = 'MAPPING_PENDING'");
    expect(migration).toContain("pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain('if missing_count > 0 then');
    expect(migration).toContain('private.bncc_demo_preview_allowed(p_institution_id, p_student_id)');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s+/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_(guided_sessions|guided_steps|guided_step_attempts)/i);
  });

  it('scopes discovery and start to the student, exact institution binding, active enrollment and grade', () => {
    expect(migration).toContain('list_student_guided_discipline_journeys_v9');
    expect(migration).toContain('start_guided_discipline_journey_v9');
    expect(migration).toContain('private.learning_v2_scope_student(p_institution_id, p_student_id)');
    expect(migration).toContain("normalized.value->>'stage' = journey_row.suggested_stage");
    expect(migration).toContain("nullif(normalized.value->>'grade_level', '')::smallint = journey_row.suggested_grade");
    expect(migration).toContain('private.learning_demo_subject_bindings');
    expect(migration).toContain("and journey.mapping_status = 'MAPPING_PENDING'");
  });

  it('limits canonical subject backfill to the twelve journey skills', () => {
    expect(migration).toContain("and execution_skill.code in (\n     'ART_COMPARE_COMPOSITIONS', 'BIOLOGY_CELL_FUNCTION', 'CHEMISTRY_STOICHIOMETRY'");
    expect(migration).not.toMatch(/execution_skill\.canonical_subject_id is null\s+and canonical_subject\.code = execution_skill\.subject_area\s+and canonical_subject\.active/);
  });

  it('preserves legacy V4 step payloads and persists a bounded selection for V9 scoring', () => {
    expect(migration).toContain('get_guided_learning_step_v4_legacy_v9');
    expect(migration).toContain('return public.get_guided_learning_step_v4_legacy_v9(p_step_id)');
    expect(migration).toContain("'selection_integrity_version', 'SERVER_SELECTED_V1'");
    expect(migration).toContain('session_row.discipline_journey_id is null or bank.id::text = any');
    expect(migration).toContain('LEARNING_GUIDED_SELECTION_MISMATCH');
    expect(migration).toContain('submitted_unique_count <> cardinality(submitted_ids)');
    expect(migration).toContain('new.total_questions <> cardinality(selected_ids)');
    expect(migration).toContain('cardinality(selected_ids) <> (select count(distinct selected_id)::integer from unnest(selected_ids)');
    expect(migration).toContain('public.learning_skill_prerequisites edge');
    expect(migration).toContain('prerequisite_walk.depth < 8');
    expect(migration).toContain("if session_row.planner_version = 'V4'\n     and session_row.discipline_journey_id is not null then");
    expect(migration).toContain("'demonstration_only', true");
  });

  it('does not make candidate BNCC mappings or preview content public', () => {
    expect(migration).toContain("'MAPPING_PENDING'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'demonstration_only', true");
    expect(migration).toContain('revoke all on function public.list_student_guided_discipline_journeys_v9(uuid, uuid),');
    expect(migration).toContain('to authenticated;');
  });
});
