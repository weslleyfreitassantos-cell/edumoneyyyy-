begin;

do $guided_study_v18_owner_role$
declare
  get_owner oid;
  start_owner oid;
  function_owner name;
  executor_is_superuser boolean;
  session_user_is_superuser boolean;
begin
  select procedure.proowner into get_owner
    from pg_catalog.pg_proc procedure
   where procedure.oid = 'public.get_guided_study_subject_overview_v16(uuid,uuid)'::regprocedure;
  select procedure.proowner into start_owner
    from pg_catalog.pg_proc procedure
   where procedure.oid = 'public.start_guided_study_subject_v16(uuid,uuid)'::regprocedure;

  if get_owner is null or start_owner is null then
    raise exception 'GUIDED_STUDY_V18_SUBJECT_RPC_MISSING';
  end if;
  if get_owner <> start_owner then
    raise exception 'GUIDED_STUDY_V18_SUBJECT_RPC_OWNER_MISMATCH';
  end if;

  function_owner := pg_catalog.pg_get_userbyid(get_owner);
  if current_user <> function_owner then
    select role_info.rolsuper into executor_is_superuser
      from pg_catalog.pg_roles role_info where role_info.rolname = current_user;
    select role_info.rolsuper into session_user_is_superuser
      from pg_catalog.pg_roles role_info where role_info.rolname = session_user;

    if (session_user = 'supabase_admin' and current_user = 'postgres'
        and coalesce(session_user_is_superuser, false))
       or coalesce(executor_is_superuser, false)
       or pg_catalog.pg_has_role(current_user, function_owner, 'MEMBER') then
      execute pg_catalog.format('set role %I', function_owner);
    else
      raise exception 'GUIDED_STUDY_V18_CANNOT_ASSUME_FUNCTION_OWNER: session_user=%, current_user=%, function_owner=%', session_user, current_user, function_owner
        using errcode = '42501';
    end if;
  end if;
end;
$guided_study_v18_owner_role$;

do $guided_study_v18_independent_subject_sessions$
declare
  target record;
  definition text;
  guard_marker text := '  if recommendation->>''state'' = ''READY'' and v_student_id is not null then';
  next_marker text;
  guard_count integer;
  declaration_count integer;
  state_count integer;
  guard_start integer;
  guard_end integer;
begin
  for target in
    select procedure.oid, procedure.proname
      from pg_catalog.pg_proc procedure
     where procedure.oid in (
       'public.get_guided_study_subject_overview_v16(uuid,uuid)'::regprocedure,
       'public.start_guided_study_subject_v16(uuid,uuid)'::regprocedure
     )
     order by procedure.proname
  loop
    definition := pg_catalog.pg_get_functiondef(target.oid);
    guard_count := (length(definition) - length(replace(definition, guard_marker, ''))) / length(guard_marker);
    declaration_count := (length(definition) - length(replace(definition, '  v_open_session record;', ''))) / length('  v_open_session record;');
    state_count := (length(definition) - length(replace(definition, '''ACTIVE_SESSION_OTHER_SUBJECT''', ''))) / length('''ACTIVE_SESSION_OTHER_SUBJECT''');

    if guard_count = 0 and declaration_count = 0 and state_count = 0 then
      continue;
    end if;
    if guard_count <> 1 or declaration_count <> 1 or state_count <> 1 then
      raise exception 'GUIDED_STUDY_V18_CROSS_SUBJECT_GUARD_SHAPE_CHANGED function=% guards=% declarations=% states=%',
        target.proname, guard_count, declaration_count, state_count;
    end if;
    if position('app.guided_study_v16_subject_id' in definition) = 0 then
      raise exception 'GUIDED_STUDY_V18_SUBJECT_SCOPE_SHAPE_CHANGED function=%', target.proname;
    end if;
    if target.proname = 'start_guided_study_subject_v16'
       and position('public.start_guided_study_v11(p_institution_id)' in definition) = 0 then
      raise exception 'GUIDED_STUDY_V18_SUBJECT_START_SHAPE_CHANGED';
    end if;

    if target.proname = 'get_guided_study_subject_overview_v16' then
      next_marker := '  if recommendation->>''state'' = ''ACTIVE'' and recommendation->>''session_id'' is not null then';
    else
      next_marker := '  if recommendation->>''state'' <> ''READY'' and recommendation->>''state'' <> ''ACTIVE'' then';
    end if;
    guard_start := strpos(definition, guard_marker);
    guard_end := strpos(substring(definition from guard_start), next_marker);
    if guard_start = 0 or guard_end = 0 then
      raise exception 'GUIDED_STUDY_V18_CROSS_SUBJECT_GUARD_BOUNDARY_CHANGED function=%', target.proname;
    end if;

    definition := overlay(
      definition placing ''
      from guard_start
      for guard_end - 1
    );
    definition := replace(definition, '  v_open_session record;' || E'\n', '');
    execute definition;
  end loop;
end;
$guided_study_v18_independent_subject_sessions$;

revoke all on function public.get_guided_study_subject_overview_v16(uuid, uuid) from public, anon;
revoke all on function public.start_guided_study_subject_v16(uuid, uuid) from public, anon;
grant execute on function public.get_guided_study_subject_overview_v16(uuid, uuid) to authenticated;
grant execute on function public.start_guided_study_subject_v16(uuid, uuid) to authenticated;

comment on function public.get_guided_study_subject_overview_v16(uuid, uuid) is
  'Returns a student-enrolled discipline recommendation and only its own active guided-study session.';
comment on function public.start_guided_study_subject_v16(uuid, uuid) is
  'Resumes or starts the session for one enrolled discipline; active sessions in other disciplines remain independent.';

notify pgrst, 'reload schema';
commit;
