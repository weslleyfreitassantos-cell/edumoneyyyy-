import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261012000600_bncc_question_first_tutor_v5.sql', import.meta.url),
  'utf8',
);
const v8Migration = readFileSync(
  new URL('./20261010001100_bncc_deep_learning_v8.sql', import.meta.url),
  'utf8',
);
const v9Migration = readFileSync(
  new URL('./20261011000100_bncc_discipline_journeys_v9.sql', import.meta.url),
  'utf8',
);

describe('question-first adaptive tutor V5 migration', () => {
  it('patches legacy and V9 guided-step reads with safe hints and one new challenge', () => {
    expect(migration).toContain("get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure");
    expect(migration).toContain("public.get_guided_learning_step_v4(uuid)'::regprocedure");
    expect(migration).toContain("private.enforce_guided_question_selection_v9()'::regprocedure");
    expect(migration).toContain("'hint'',question.metadata->>''remediation_hint'");
    expect(migration).toContain("limit_pattern text := $re$(?i)limit[[:space:]]+2\\)[[:space:]]*selected$re$");
    expect(migration).toContain("regexp_replace(function_definition, limit_pattern, 'limit 1) selected', 'g')");
    expect(migration).toContain("'limit 2', 'limit 1'");
    expect(migration).toContain("'if coalesce(cardinality(selected_ids), 0) < 2 then', 'if coalesce(cardinality(selected_ids), 0) < 1 then'");
    expect(migration).toContain("safe_hint_clause text := '''hint'', question.metadata->>''remediation_hint''");
    expect(migration).not.toContain("safe_hint_clause text := '''hint'', question.correct_answer");
    expect(migration).not.toMatch(/drop\s+table|truncate\s+/i);
  });

  it('records hint exposure within the authenticated step scope and uses independent score for progression', () => {
    expect(migration).toContain('create or replace function public.record_guided_learning_hint_v5');
    expect(migration).toContain('private.learning_v2_scope_student(session_row.institution_id, session_row.student_id)');
    expect(migration).toContain('LEARNING_HINT_QUESTION_NOT_SELECTED');
    expect(migration).toContain("'used_hint_question_ids'");
    expect(migration).toContain("grant execute on function public.record_guided_learning_hint_v5(uuid, uuid) to authenticated");
    expect(migration).toContain('assisted_count:=assisted_count+1');
    expect(migration).toContain('evidence_score>=80');
    expect(migration).toContain("''independent_score'',evidence_score");
  });

  it('fails closed on mismatched function bodies and is safe to rerun after success', () => {
    expect(migration).toContain('V5_GUIDED_STEP_PATCH_MISMATCH');
    expect(migration).toContain("position(safe_hint_clause in function_definition) > 0");
    expect(migration).toContain('function_definition !~ limit_pattern');
    expect(migration).toContain("position('cardinality(selected_ids) <> 2' in function_definition) = 0");
    expect(migration).toContain('V5_SELECTION_GUARD_PATCH_MISMATCH');
  });

  it('targets the exact V8 and V9 contracts that introduced two-question probes', () => {
    expect(v8Migration).toContain("'difficulty',question.difficulty,'position',item.position");
    expect(v8Migration).toContain('limit 2) selected');
    expect(v8Migration).toContain('outcome text; remediation_hint text; error_focus text;');
    expect(v8Migration).toContain("correct:=submitted=expected;");
    expect(v8Migration).toContain("score:=round((correct_count::numeric/total::numeric)*100,2);");
    expect(v8Migration).toContain("outcome:=case when score>=80 then 'SUCCESS' else 'GAP' end;");
    expect(v9Migration).toContain("or (step_row.step_type = 'PROBE' and cardinality(selected_ids) <> 2)");
    expect(v9Migration).toContain("or (step_row.step_type = 'PROBE' and jsonb_array_length(result->'questions') <> 2)");
    expect(v9Migration).toContain('create or replace function private.enforce_guided_question_selection_v9()');
  });
});
