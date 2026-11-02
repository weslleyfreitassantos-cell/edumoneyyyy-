begin;

-- A hint is disclosed only by this authenticated, student-scoped RPC. The
-- server records the question on the active step before returning its text.
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
  hint_text text;
begin
  select step.* into step_row
    from public.learning_guided_steps step
   where step.id = p_step_id
   for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;

  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = step_row.session_id
     and session.planner_version = 'V4';
  if not found
     or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then
    raise exception 'LEARNING_STEP_SCOPE_DENIED';
  end if;
  -- Managers may use the shared scope helper for operational reads, but only
  -- the student's own authenticated profile can create learning evidence.
  if not exists (
    select 1
      from public.students student
     where student.id = session_row.student_id
       and student.institution_id = session_row.institution_id
       and student.profile_id = auth.uid()
       and student.active
  ) then
    raise exception 'LEARNING_HINT_STUDENT_AUTH_REQUIRED';
  end if;
  if session_row.status <> 'ACTIVE'
     or session_row.current_step_id is distinct from step_row.id
     or step_row.status <> 'ACTIVE'
     or step_row.step_type not in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') then
    raise exception 'LEARNING_HINT_STEP_NOT_ACTIVE';
  end if;
  if session_row.discipline_journey_id is not null then
    perform private.assert_bncc_discipline_journey_v9(
      session_row.institution_id,
      session_row.student_id,
      session_row.discipline_journey_id,
      session_row.target_canonical_skill_id
    );
  end if;

  select nullif(btrim(question.metadata->>'remediation_hint'), '')
    into hint_text
    from public.learning_question_set_items item
    join public.learning_question_bank question
      on question.id = item.question_bank_id
     and question.active
   where item.question_set_id = step_row.question_set_id
     and item.question_bank_id = p_question_bank_id
     and (
       jsonb_typeof(step_row.metadata->'selected_question_ids') is distinct from 'array'
       or step_row.metadata->'selected_question_ids' @> jsonb_build_array(p_question_bank_id::text)
     )
   order by item.position
   limit 1;
  if hint_text is null then raise exception 'LEARNING_HINT_NOT_AVAILABLE'; end if;

  update public.learning_guided_steps step
     set metadata = case
       when coalesce(step.metadata->'used_hint_question_ids', '[]'::jsonb)
              @> jsonb_build_array(p_question_bank_id::text)
         then coalesce(step.metadata, '{}'::jsonb)
       else coalesce(step.metadata, '{}'::jsonb) || jsonb_build_object(
         'used_hint_question_ids',
         coalesce(step.metadata->'used_hint_question_ids', '[]'::jsonb)
           || jsonb_build_array(p_question_bank_id::text)
       )
     end,
     updated_at = now()
   where step.id = step_row.id;

  return jsonb_build_object(
    'step_id', step_row.id,
    'question_bank_id', p_question_bank_id,
    'hint', hint_text,
    'recorded', true
  );
end;
$$;

revoke all on function public.record_guided_learning_hint_v5(uuid, uuid) from public, anon;
grant execute on function public.record_guided_learning_hint_v5(uuid, uuid) to authenticated;

-- Expose availability, never hint text, in the step payload. Both the V9
-- journey getter and its preserved legacy getter use the same UI contract.
do $patch_guided_step_hint_availability_v5$
declare
  target_function regprocedure;
  function_definition text;
  original_definition text;
  old_clause text;
  new_clause text;
  replacement_count integer;
begin
  foreach target_function in array array[
    'public.get_guided_learning_step_v4(uuid)'::regprocedure,
    'public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(target_function) into function_definition;
    if function_definition is null then
      raise exception 'V5_GUIDED_STEP_FUNCTION_MISSING';
    end if;
    if position('has_hint' in function_definition) > 0 then
      continue;
    end if;

    original_definition := function_definition;
    foreach old_clause in array array[
      $old$'position', item.position$old$,
      $old$'position',item.position$old$
    ] loop
      replacement_count := (length(function_definition) - length(replace(function_definition, old_clause, ''))) / length(old_clause);
      if replacement_count > 0 then
        new_clause := case
          when old_clause = $old$'position', item.position$old$ then
            $new$'has_hint', nullif(btrim(question.metadata->>'remediation_hint'), '') is not null, 'position', item.position$new$
          else
            $new$'has_hint',nullif(btrim(question.metadata->>'remediation_hint'),'') is not null,'position',item.position$new$
        end;
        function_definition := replace(function_definition, old_clause, new_clause);
      end if;
    end loop;
    if function_definition = original_definition then
      raise exception 'V5_GUIDED_STEP_HINT_PATCH_MISMATCH';
    end if;
    execute function_definition;
  end loop;
end;
$patch_guided_step_hint_availability_v5$;

-- Keep the attempt's raw score for feedback/history, but use only answers
-- submitted without a server-recorded hint as adaptive skill evidence.
do $patch_guided_grader_hint_evidence_v5$
declare
  function_definition text;
  original_definition text;
  old_declaration text := 'outcome text; remediation_hint text; error_focus text;';
  old_answer_check text := 'submitted:=coalesce(answer_item->''answer'',''null''::jsonb); expected:=coalesce(item.correct_answer,''null''::jsonb); correct:=submitted=expected;';
  old_feedback text := 'feedback:=feedback||jsonb_build_array(jsonb_build_object(''question_bank_id'',item.id,''is_correct'',correct,''correct_answer'',item.correct_answer,''explanation'',item.explanation,''error_focus'',error_focus,''remediation_hint'',remediation_hint));';
  old_score text := 'score:=round((correct_count::numeric/total::numeric)*100,2);';
  old_evidence text := 'case step_row.purpose when ''PROBE'' then ''DIAGNOSTIC'' else step_row.purpose end,score>=80,score,jsonb_build_object(''engine_version'',''V4'',''content_version'',5,''guided_step_id'',step_row.id,''guided_attempt_id'',attempt_id,''purpose'',step_row.purpose,''feedback'',feedback));';
  old_outcome text := 'outcome:=case when score>=80 then ''SUCCESS'' else ''GAP'' end;';
  old_event text := 'jsonb_build_object(''score'',score,''purpose'',step_row.purpose,''engine_version'',''V4'',''content_version'',5));';
  old_result text := 'jsonb_build_object(''attempt_id'',attempt_id,''idempotent'',false,''score'',score,''correct_count'',correct_count,''total_questions'',total,''feedback'',feedback,''current_step_id'',next_step,''session_status'',(select status from public.learning_guided_sessions where id=session_row.id));';
  old_idempotent text := 'if attempt_id is not null then return (select jsonb_build_object(''attempt_id'',attempt.id,''idempotent'',true,''score'',attempt.score,''correct_count'',attempt.correct_count,''total_questions'',attempt.total_questions,''feedback'',attempt.feedback,''current_step_id'',(select current_step_id from public.learning_guided_sessions where id=attempt.session_id),''session_status'',(select status from public.learning_guided_sessions where id=attempt.session_id)) from public.learning_guided_step_attempts attempt where attempt.id=attempt_id); end if;';
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
     or (length(function_definition)-length(replace(function_definition, old_result, '')))/length(old_result) <> 1
     or (length(function_definition)-length(replace(function_definition, old_idempotent, '')))/length(old_idempotent) <> 1 then
    raise exception 'V5_GUIDED_GRADER_PATCH_MISMATCH';
  end if;

  function_definition := replace(function_definition, old_declaration,
    'outcome text; remediation_hint text; error_focus text; used_hint boolean; independent_total integer:=0; independent_correct_count integer:=0; assisted_count integer:=0; evidence_score numeric(5,2);');
  function_definition := replace(function_definition, old_idempotent,
    'if attempt_id is not null then return (select jsonb_build_object(''attempt_id'',attempt.id,''idempotent'',true,''score'',attempt.score,''independent_score'',case when count(feedback_rows.entry) filter (where not coalesce((feedback_rows.entry->>''used_hint'')::boolean,false)) > 0 then round((count(feedback_rows.entry) filter (where not coalesce((feedback_rows.entry->>''used_hint'')::boolean,false) and coalesce((feedback_rows.entry->>''is_correct'')::boolean,false))::numeric / count(feedback_rows.entry) filter (where not coalesce((feedback_rows.entry->>''used_hint'')::boolean,false))) * 100, 2) else 0 end,''assisted_question_count'',count(feedback_rows.entry) filter (where coalesce((feedback_rows.entry->>''used_hint'')::boolean,false)),''correct_count'',attempt.correct_count,''total_questions'',attempt.total_questions,''feedback'',attempt.feedback,''current_step_id'',(select current_step_id from public.learning_guided_sessions where id=attempt.session_id),''session_status'',(select status from public.learning_guided_sessions where id=attempt.session_id)) from public.learning_guided_step_attempts attempt left join lateral jsonb_array_elements(attempt.feedback) as feedback_rows(entry) on true where attempt.id=attempt_id group by attempt.id); end if;');
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
$patch_guided_grader_hint_evidence_v5$;

notify pgrst, 'reload schema';
commit;
