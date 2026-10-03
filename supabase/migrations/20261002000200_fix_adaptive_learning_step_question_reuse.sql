begin;

-- A question set may be reused by later guided steps in the same session.
-- Exclude questions answered in this step only, not in the whole session.
create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; result jsonb;
begin
  select step.* into step_row
    from public.learning_guided_steps step
    join public.learning_guided_sessions session on session.id = step.session_id
   where step.id = p_step_id and session.planner_version = 'V4';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id;
  if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', step_row.id, 'session_id', step_row.session_id, 'canonical_skill_id', step_row.canonical_skill_id,
    'step_type', step_row.step_type, 'purpose', step_row.purpose, 'status', step_row.status,
    'position', step_row.position, 'lesson_id', step_row.lesson_id,
    'lesson', (select jsonb_build_object('id', lesson.id, 'title', lesson.title, 'summary', lesson.summary, 'content_markdown', lesson.content_markdown, 'worked_example', lesson.worked_example, 'tips', lesson.tips, 'estimated_minutes', lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id = step_row.lesson_id),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'statement', question.statement, 'options', question.options, 'difficulty', question.difficulty, 'position', item.position) order by item.position) from public.learning_question_set_items item join public.learning_question_bank question on question.id = item.question_bank_id and question.active where item.question_set_id = step_row.question_set_id and not exists (select 1 from public.learning_guided_step_attempts previous_attempt where previous_attempt.step_id = step_row.id and exists (select 1 from jsonb_array_elements(previous_attempt.answers) answer where answer->>'question_bank_id' = question.id::text))), '[]'::jsonb)
  ) into result;
  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') and jsonb_array_length(result->'questions') = 0 then raise exception 'LEARNING_V4_QUESTION_SET_EMPTY'; end if;
  return result;
end;
$$;

revoke all on function public.get_guided_learning_step_v4(uuid) from public, anon;
grant execute on function public.get_guided_learning_step_v4(uuid) to authenticated;

commit;
