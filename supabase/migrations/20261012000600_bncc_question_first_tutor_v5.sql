begin;

-- New learning interactions show one safe challenge at a time. Previously
-- selected two-question steps remain valid and keep their stored selection.
do $patch_legacy_guided_step_v5$
declare
  function_definition text;
  original_definition text;
  hint_clause text := '''difficulty'',question.difficulty,''position'',item.position';
  safe_hint_clause text := '''difficulty'',question.difficulty,''hint'',question.metadata->>''remediation_hint'',''position'',item.position';
  old_hint_count integer;
  old_limit_count integer;
begin
  select pg_get_functiondef('public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure)
    into function_definition;
  if function_definition is null then raise exception 'V5_LEGACY_GUIDED_STEP_FUNCTION_MISSING'; end if;

  if position(safe_hint_clause in function_definition) > 0
     and position('limit 2) selected' in function_definition) = 0 then
    return;
  end if;

  original_definition := function_definition;
  select (length(function_definition)-length(replace(function_definition, hint_clause, '')))/length(hint_clause)
    into old_hint_count;
  select (length(function_definition)-length(replace(function_definition, 'limit 2) selected', '')))/length('limit 2) selected')
    into old_limit_count;
  if old_hint_count <> 1 or old_limit_count <> 1 then
    raise exception 'V5_LEGACY_GUIDED_STEP_PATCH_MISMATCH';
  end if;

  function_definition := replace(function_definition, hint_clause, safe_hint_clause);
  function_definition := replace(function_definition, 'limit 2) selected', 'limit 1) selected');
  if function_definition = original_definition then raise exception 'V5_LEGACY_GUIDED_STEP_PATCH_NOOP'; end if;
  execute function_definition;
end;
$patch_legacy_guided_step_v5$;

-- V9 stores the question selection on the step. New selections contain one
-- item; historical selections of two still pass the existing response guard.
do $patch_v9_guided_step_v5$
declare
  function_definition text;
  original_definition text;
  hint_clause text := '''position'', item.position';
  safe_hint_clause text := '''hint'', question.metadata->>''remediation_hint'', ''position'', item.position';
  old_limit_count integer;
  old_probe_cardinality_count integer;
  old_probe_payload_count integer;
begin
  select pg_get_functiondef('public.get_guided_learning_step_v4(uuid)'::regprocedure)
    into function_definition;
  if function_definition is null then raise exception 'V5_GUIDED_STEP_FUNCTION_MISSING'; end if;

  if position(safe_hint_clause in function_definition) > 0
     and position('limit 2' in function_definition) = 0
     and position('cardinality(selected_ids) <> 2' in function_definition) = 0
     and position('jsonb_array_length(result->''questions'') <> 2' in function_definition) = 0 then
    return;
  end if;

  original_definition := function_definition;
  select (length(function_definition)-length(replace(function_definition, 'limit 2', '')))/length('limit 2')
    into old_limit_count;
  select (length(function_definition)-length(replace(function_definition, 'or (step_row.step_type = ''PROBE'' and cardinality(selected_ids) <> 2)', '')))/length('or (step_row.step_type = ''PROBE'' and cardinality(selected_ids) <> 2)')
    into old_probe_cardinality_count;
  select (length(function_definition)-length(replace(function_definition, 'or (step_row.step_type = ''PROBE'' and jsonb_array_length(result->''questions'') <> 2)', '')))/length('or (step_row.step_type = ''PROBE'' and jsonb_array_length(result->''questions'') <> 2)')
    into old_probe_payload_count;
  if old_limit_count <> 2 or old_probe_cardinality_count <> 1 or old_probe_payload_count <> 1
     or position(hint_clause in function_definition) = 0 then
    raise exception 'V5_GUIDED_STEP_PATCH_MISMATCH';
  end if;

  function_definition := replace(function_definition, hint_clause, safe_hint_clause);
  function_definition := replace(function_definition, 'limit 2', 'limit 1');
  function_definition := replace(function_definition, 'if coalesce(cardinality(selected_ids), 0) < 2 then', 'if coalesce(cardinality(selected_ids), 0) < 1 then');
  function_definition := replace(function_definition, 'or (step_row.step_type = ''PROBE'' and cardinality(selected_ids) <> 2)', '');
  function_definition := replace(function_definition, 'or (step_row.step_type = ''PROBE'' and jsonb_array_length(result->''questions'') <> 2)', '');
  if function_definition = original_definition then raise exception 'V5_GUIDED_STEP_PATCH_NOOP'; end if;
  execute function_definition;
end;
$patch_v9_guided_step_v5$;

-- The V9 attempt trigger must accept new one-question probes while still
-- requiring an exact match with the server-persisted selection.
do $patch_v9_selection_guard_v5$
declare
  function_definition text;
  probe_guard text := 'or (step_row.step_type = ''PROBE'' and cardinality(selected_ids) <> 2)';
  guard_count integer;
begin
  select pg_get_functiondef('private.enforce_guided_question_selection_v9()'::regprocedure)
    into function_definition;
  if function_definition is null then raise exception 'V5_SELECTION_GUARD_FUNCTION_MISSING'; end if;
  if position(probe_guard in function_definition) = 0 then return; end if;
  select (length(function_definition)-length(replace(function_definition, probe_guard, '')))/length(probe_guard)
    into guard_count;
  if guard_count <> 1 then raise exception 'V5_SELECTION_GUARD_PATCH_MISMATCH'; end if;
  execute replace(function_definition, probe_guard, '');
end;
$patch_v9_selection_guard_v5$;

-- Hint exposure is recorded by the server before the client receives the text.
create or replace function public.record_guided_learning_hint_v5(
  p_step_id uuid,
  p_question_bank_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  step_row public.learning_guided_steps%rowtype;
  session_row public.learning_guided_sessions%rowtype;
begin
  select step.* into step_row
    from public.learning_guided_steps step
   where step.id = p_step_id
   for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;

  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = step_row.session_id;
  if not found or session_row.planner_version is distinct from 'V4'
     or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then
    raise exception 'LEARNING_STEP_SCOPE_DENIED';
  end if;
  if step_row.status in ('COMPLETED', 'SKIPPED')
     or step_row.step_type not in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') then
    raise exception 'LEARNING_HINT_STEP_NOT_ACTIVE';
  end if;
  if session_row.discipline_journey_id is not null then
    perform private.assert_bncc_discipline_journey_v9(
      session_row.institution_id, session_row.student_id,
      session_row.discipline_journey_id, session_row.target_canonical_skill_id
    );
  end if;
  if not exists (
    select 1
      from public.learning_question_set_items item
      join public.learning_question_bank question
        on question.id = item.question_bank_id and question.active
     where item.question_set_id = step_row.question_set_id
       and item.question_bank_id = p_question_bank_id
       and (session_row.discipline_journey_id is null
            or coalesce(step_row.metadata->'selected_question_ids', '[]'::jsonb) @> jsonb_build_array(p_question_bank_id::text))
  ) then
    raise exception 'LEARNING_HINT_QUESTION_NOT_SELECTED';
  end if;

  update public.learning_guided_steps
     set metadata = case
       when coalesce(metadata->'used_hint_question_ids', '[]'::jsonb) @> jsonb_build_array(p_question_bank_id::text)
         then coalesce(metadata, '{}'::jsonb)
       else coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'used_hint_question_ids',
         coalesce(metadata->'used_hint_question_ids', '[]'::jsonb) || jsonb_build_array(p_question_bank_id::text)
       )
     end,
     updated_at = now()
   where id = p_step_id;
  return jsonb_build_object('step_id', p_step_id, 'question_bank_id', p_question_bank_id, 'recorded', true);
end;
$$;

revoke all on function public.record_guided_learning_hint_v5(uuid, uuid) from public, anon;
grant execute on function public.record_guided_learning_hint_v5(uuid, uuid) to authenticated;

-- Assisted correctness is kept visible, but only unassisted answers count as
-- independent evidence for the adaptive decision and skill-state refresh.
do $patch_v4_grader_hint_evidence_v5$
declare
  function_definition text;
  old_declaration text := 'outcome text; remediation_hint text; error_focus text;';
  old_answer_check text := 'submitted:=coalesce(answer_item->''answer'',''null''::jsonb); expected:=coalesce(item.correct_answer,''null''::jsonb); correct:=submitted=expected;';
  old_feedback text := 'feedback:=feedback||jsonb_build_array(jsonb_build_object(''question_bank_id'',item.id,''is_correct'',correct,''correct_answer'',item.correct_answer,''explanation'',item.explanation,''error_focus'',error_focus,''remediation_hint'',remediation_hint));';
  old_score text := 'score:=round((correct_count::numeric/total::numeric)*100,2);';
  old_evidence text := 'case step_row.purpose when ''PROBE'' then ''DIAGNOSTIC'' else step_row.purpose end,score>=80,score,jsonb_build_object(''engine_version'',''V4'',''content_version'',5,''guided_step_id'',step_row.id,''guided_attempt_id'',attempt_id,''purpose'',step_row.purpose,''feedback'',feedback));';
  old_outcome text := 'outcome:=case when score>=80 then ''SUCCESS'' else ''GAP'' end;';
  old_event text := 'jsonb_build_object(''score'',score,''purpose'',step_row.purpose,''engine_version'',''V4'',''content_version'',5));';
  old_result text := 'jsonb_build_object(''attempt_id'',attempt_id,''idempotent'',false,''score'',score,''correct_count'',correct_count,''total_questions'',total,''feedback'',feedback,''current_step_id'',next_step,''session_status'',(select status from public.learning_guided_sessions where id=session_row.id));';
begin
  select pg_get_functiondef('public.submit_guided_learning_step_v4(uuid,jsonb,text)'::regprocedure)
    into function_definition;
  if function_definition is null then raise exception 'V5_GUIDED_GRADER_FUNCTION_MISSING'; end if;
  if position('used_hint_question_ids' in function_definition) > 0
     and position('independent_score' in function_definition) > 0 then
    return;
  end if;
  if (length(function_definition)-length(replace(function_definition, old_declaration, '')))/length(old_declaration) <> 1
     or (length(function_definition)-length(replace(function_definition, old_answer_check, '')))/length(old_answer_check) <> 1
     or (length(function_definition)-length(replace(function_definition, old_feedback, '')))/length(old_feedback) <> 1
     or (length(function_definition)-length(replace(function_definition, old_score, '')))/length(old_score) <> 1
     or (length(function_definition)-length(replace(function_definition, old_evidence, '')))/length(old_evidence) <> 1
     or (length(function_definition)-length(replace(function_definition, old_outcome, '')))/length(old_outcome) <> 1
     or (length(function_definition)-length(replace(function_definition, old_event, '')))/length(old_event) <> 1
     or (length(function_definition)-length(replace(function_definition, old_result, '')))/length(old_result) <> 1 then
    raise exception 'V5_GUIDED_GRADER_PATCH_MISMATCH';
  end if;

  function_definition := replace(function_definition, old_declaration,
    'outcome text; remediation_hint text; error_focus text; used_hint boolean; independent_total integer:=0; independent_correct_count integer:=0; assisted_count integer:=0; evidence_score numeric(5,2);');
  function_definition := replace(function_definition, old_answer_check,
    old_answer_check || ' used_hint:=coalesce(step_row.metadata->''used_hint_question_ids'',''[]''::jsonb) @> jsonb_build_array(item.id::text); if used_hint then assisted_count:=assisted_count+1; else independent_total:=independent_total+1; if correct then independent_correct_count:=independent_correct_count+1; end if; end if;');
  function_definition := replace(function_definition, old_feedback,
    'feedback:=feedback||jsonb_build_array(jsonb_build_object(''question_bank_id'',item.id,''is_correct'',correct,''used_hint'',used_hint,''correct_answer'',item.correct_answer,''explanation'',item.explanation,''error_focus'',error_focus,''remediation_hint'',remediation_hint));');
  function_definition := replace(function_definition, old_score,
    old_score || ' evidence_score:=case when independent_total>0 then round((independent_correct_count::numeric/independent_total::numeric)*100,2) else 0 end;');
  function_definition := replace(function_definition, old_evidence,
    'case step_row.purpose when ''PROBE'' then ''DIAGNOSTIC'' else step_row.purpose end,evidence_score>=80,evidence_score,jsonb_build_object(''engine_version'',''V4'',''content_version'',5,''guided_step_id'',step_row.id,''guided_attempt_id'',attempt_id,''purpose'',step_row.purpose,''independent_score'',evidence_score,''assisted_question_count'',assisted_count,''feedback'',feedback));');
  function_definition := replace(function_definition, old_outcome,
    'outcome:=case when evidence_score>=80 then ''SUCCESS'' else ''GAP'' end;');
  function_definition := replace(function_definition, old_event,
    'jsonb_build_object(''score'',score,''independent_score'',evidence_score,''assisted_question_count'',assisted_count,''purpose'',step_row.purpose,''engine_version'',''V4'',''content_version'',5));');
  function_definition := replace(function_definition, old_result,
    'jsonb_build_object(''attempt_id'',attempt_id,''idempotent'',false,''score'',score,''independent_score'',evidence_score,''assisted_question_count'',assisted_count,''correct_count'',correct_count,''total_questions'',total,''feedback'',feedback,''current_step_id'',next_step,''session_status'',(select status from public.learning_guided_sessions where id=session_row.id));');
  execute function_definition;
end;
$patch_v4_grader_hint_evidence_v5$;

notify pgrst, 'reload schema';
commit;
