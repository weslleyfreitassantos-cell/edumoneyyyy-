begin;

-- Keep in-progress simulation answers recoverable without revealing correctness
-- before the attempt is submitted.
create or replace function public.save_learning_simulation_attempt_answers(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  answer_map jsonb;
begin
  select attempt.* into attempt_row
    from public.learning_simulation_attempts attempt
   where attempt.id = p_attempt_id
     and attempt.status = 'IN_PROGRESS'
     and exists (
       select 1
         from public.students student
        where student.id = attempt.student_id
          and student.institution_id = attempt.institution_id
          and student.profile_id = auth.uid()
          and student.active
     );
  if not found then
    raise exception 'LEARNING_SIMULATION_ATTEMPT_SCOPE_DENIED';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'LEARNING_SIMULATION_ANSWERS_INVALID';
  end if;

  select coalesce(
    jsonb_object_agg(item->>'question_bank_id', jsonb_build_object('answer', item->'answer')),
    '{}'::jsonb
  )
    into answer_map
    from jsonb_array_elements(p_answers) item
   where item->>'question_bank_id' is not null
     and exists (
       select 1
         from public.learning_simulation_questions question
        where question.simulation_id = attempt_row.simulation_id
          and question.question_bank_id::text = item->>'question_bank_id'
     );

  update public.learning_simulation_attempts
     set answers = answer_map,
         updated_at = now()
   where id = attempt_row.id;

  return jsonb_build_object('attempt_id', attempt_row.id, 'answers', answer_map);
end;
$$;

revoke all on function public.save_learning_simulation_attempt_answers(uuid, jsonb) from public, anon;
grant execute on function public.save_learning_simulation_attempt_answers(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
