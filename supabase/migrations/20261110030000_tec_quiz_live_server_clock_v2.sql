begin;

do $$
begin
  if to_regprocedure('public.tec_quiz_state_core_v1(uuid)') is null then
    if to_regprocedure('public.tec_quiz_state_v1(uuid)') is null then
      raise exception 'TEC_QUIZ_STATE_FUNCTION_MISSING';
    end if;
    execute 'alter function public.tec_quiz_state_v1(uuid) rename to tec_quiz_state_core_v1';
  end if;
end;
$$;

revoke all on function public.tec_quiz_state_core_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.tec_quiz_state_core_v1(uuid) to current_user;

create or replace function public.tec_quiz_state_v1(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  state_payload jsonb;
begin
  state_payload := public.tec_quiz_state_core_v1(p_game_id);
  return state_payload || jsonb_build_object('server_now', clock_timestamp());
end;
$$;

revoke all on function public.tec_quiz_state_v1(uuid) from public, anon;
grant execute on function public.tec_quiz_state_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
