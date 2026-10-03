begin;

alter table public.learning_simulation_attempts
  add column if not exists navigation_state jsonb not null default '{"current_index":0,"flagged":[]}'::jsonb;

create or replace function public.save_learning_simulation_attempt_navigation(
  p_attempt_id uuid,
  p_navigation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  navigation jsonb;
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
  if jsonb_typeof(coalesce(p_navigation, '{}'::jsonb)) <> 'object' then
    raise exception 'LEARNING_SIMULATION_NAVIGATION_INVALID';
  end if;

  navigation := jsonb_build_object(
    'current_index', coalesce(p_navigation->'current_index', '0'::jsonb),
    'flagged', case when jsonb_typeof(p_navigation->'flagged') = 'array' then p_navigation->'flagged' else '[]'::jsonb end
  );

  update public.learning_simulation_attempts
     set navigation_state = navigation,
         updated_at = now()
   where id = attempt_row.id;

  return jsonb_build_object('attempt_id', attempt_row.id, 'navigation_state', navigation);
end;
$$;

revoke all on function public.save_learning_simulation_attempt_navigation(uuid, jsonb) from public, anon;
grant execute on function public.save_learning_simulation_attempt_navigation(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
