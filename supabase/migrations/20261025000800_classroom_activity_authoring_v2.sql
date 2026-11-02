begin;

-- Production owns the existing SECURITY DEFINER function as supabase_admin,
-- while the official migration connection runs as postgres after Supabase's
-- role hook. Accept only the known local owner path or that exact hosted path.
do $classroom_activity_question_bank_owner_guard$
declare
  function_owner text;
  session_role_is_superuser boolean;
begin
  select pg_catalog.pg_get_userbyid(function_row.proowner)
    into function_owner
    from pg_catalog.pg_proc function_row
   where function_row.oid = pg_catalog.to_regprocedure(
     'public.list_teacher_learning_question_bank(uuid)'
   );

  select role_row.rolsuper
    into session_role_is_superuser
    from pg_catalog.pg_roles role_row
   where role_row.rolname = session_user;

  if function_owner = 'postgres'
     and session_user = 'postgres'
     and current_user = 'postgres' then
    return;
  end if;

  if function_owner = 'supabase_admin'
     and session_user = 'supabase_admin'
     and current_user = 'postgres'
     and coalesce(session_role_is_superuser, false) then
    return;
  end if;

  raise exception 'LEARNING_QUESTION_BANK_OWNER_EXECUTOR_REQUIRED'
    using errcode = '42501';
end;
$classroom_activity_question_bank_owner_guard$;

alter table public.learning_assignments
  add column if not exists available_at timestamptz,
  add column if not exists max_attempts integer;

alter table public.learning_assignments
  drop constraint if exists learning_assignments_max_attempts_check;
alter table public.learning_assignments
  add constraint learning_assignments_max_attempts_check
  check (max_attempts is null or max_attempts between 1 and 50);

create index if not exists learning_assignments_available_idx
  on public.learning_assignments(institution_id, available_at, due_at);

-- The answer key is available only through teacher-scoped RPCs. This replaces
-- the legacy endpoint without changing its result shape for existing callers.

-- Assume the existing function owner only for this replacement and its ACL
-- changes. Local Supabase migrations run as postgres and already own the
-- function; the hosted release connection has session_user=supabase_admin and
-- current_user=postgres because of its role hook. Switch only in that verified
-- hosted context. A DO block is invoker-executed, so the guarded SET ROLE is
-- allowed only when the original session role has the required authority.
do $classroom_activity_question_bank_owner_role$
begin
  if session_user = 'supabase_admin' and current_user = 'postgres' then
    execute 'set role supabase_admin';
  end if;
end;
$classroom_activity_question_bank_owner_role$;

create or replace function public.list_teacher_learning_question_bank(p_institution_id uuid)
returns table(
  id uuid,
  package_type text,
  source_type text,
  source_name text,
  source_year integer,
  subject_area text,
  topic text,
  statement text,
  options jsonb,
  correct_answer jsonb,
  explanation text,
  difficulty text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
      from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = p_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  ) then
    raise exception 'LEARNING_QUESTION_BANK_TEACHER_SCOPE_DENIED';
  end if;

  return query
  select question.id, question.package_type, question.source_type, question.source_name,
         question.source_year, question.subject_area, question.topic, question.statement,
         question.options, question.correct_answer, question.explanation, question.difficulty
    from public.learning_question_bank question
   where question.active
     and (
       (question.institution_id is null and question.package_type in ('TECESCOLA', 'ENEM'))
       or question.institution_id = p_institution_id
     )
     and (
       lower(coalesce(question.metadata->>'pedagogical_review_status', ''))
         in ('approved', 'published', 'approved_for_production')
       or (
         nullif(trim(coalesce(question.metadata->>'pedagogical_review_status', '')), '') is null
         and lower(coalesce(question.metadata->>'content_authoring_status', 'legacy'))
           not in ('candidate', 'draft', 'staging', 'pending', 'needs_review', 'pending_review',
                   'review_pending', 'pedagogical_review_pending', 'rejected', 'authored', 'tech_validated')
       )
     )
     and lower(coalesce(question.metadata->>'content_status', '')) <> 'staging'
     and lower(coalesce(question.metadata->>'publication_status', '')) <> 'staging'
     and lower(coalesce(question.metadata->>'demo_preview_only', 'false')) <> 'true'
   order by question.created_at desc
   limit 100;
end;
$$;
revoke all on function public.list_teacher_learning_question_bank(uuid) from public, anon;
grant execute on function public.list_teacher_learning_question_bank(uuid) to authenticated;
do $classroom_activity_question_bank_role_restore$
begin
  if session_user = 'supabase_admin' and current_user = 'supabase_admin' then
    execute 'set role postgres';
  end if;
end;
$classroom_activity_question_bank_role_restore$;

create or replace function public.search_teacher_learning_question_bank_v1(
  p_institution_id uuid,
  p_subject_area text default null,
  p_query text default null,
  p_difficulty text default null,
  p_package_type text default null,
  p_source_type text default null,
  p_canonical_skill_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns table(
  id uuid,
  package_type text,
  source_type text,
  source_name text,
  source_year integer,
  subject_area text,
  topic text,
  statement text,
  options jsonb,
  correct_answer jsonb,
  explanation text,
  difficulty text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 25), 50));
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if auth.uid() is null or not exists (
    select 1
      from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = p_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  ) then
    raise exception 'LEARNING_QUESTION_BANK_TEACHER_SCOPE_DENIED';
  end if;

  return query
  with filtered as materialized (
    select question.*
      from public.learning_question_bank question
     where question.active
       and (
         (question.institution_id is null and question.package_type in ('TECESCOLA', 'ENEM'))
         or question.institution_id = p_institution_id
       )
       and (
         lower(coalesce(question.metadata->>'pedagogical_review_status', ''))
           in ('approved', 'published', 'approved_for_production')
         or (
           nullif(trim(coalesce(question.metadata->>'pedagogical_review_status', '')), '') is null
           and lower(coalesce(question.metadata->>'content_authoring_status', 'legacy'))
             not in ('candidate', 'draft', 'staging', 'pending', 'needs_review', 'pending_review',
                     'review_pending', 'pedagogical_review_pending', 'rejected', 'authored', 'tech_validated')
         )
       )
       and lower(coalesce(question.metadata->>'content_status', '')) <> 'staging'
       and lower(coalesce(question.metadata->>'publication_status', '')) <> 'staging'
       and lower(coalesce(question.metadata->>'demo_preview_only', 'false')) <> 'true'
       and (
         nullif(trim(coalesce(p_subject_area, '')), '') is null
         or question.subject_area = upper(trim(p_subject_area))
         or (upper(trim(p_subject_area)) in ('MATEMATICA', 'MATHEMATICS', 'MATH')
             and question.subject_area in ('MATEMATICA', 'MATHEMATICS', 'MATH'))
         or (upper(trim(p_subject_area)) in ('PORTUGUESE', 'PORTUGUES', 'LINGUA PORTUGUESA')
             and question.subject_area in ('PORTUGUESE', 'PORTUGUES', 'LINGUA PORTUGUESA'))
         or (upper(trim(p_subject_area)) in ('ENGLISH', 'INGLES', 'LINGUA INGLESA')
             and question.subject_area in ('ENGLISH', 'INGLES', 'LINGUA INGLESA'))
         or (upper(trim(p_subject_area)) in ('BIOLOGY', 'BIOLOGIA')
             and question.subject_area in ('BIOLOGY', 'BIOLOGIA'))
         or (upper(trim(p_subject_area)) in ('HISTORY', 'HISTORIA')
             and question.subject_area in ('HISTORY', 'HISTORIA'))
         or (upper(trim(p_subject_area)) in ('GEOGRAPHY', 'GEOGRAFIA')
             and question.subject_area in ('GEOGRAPHY', 'GEOGRAFIA'))
         or (upper(trim(p_subject_area)) in ('PHYSICS', 'FISICA')
             and question.subject_area in ('PHYSICS', 'FISICA'))
         or (upper(trim(p_subject_area)) in ('CHEMISTRY', 'QUIMICA')
             and question.subject_area in ('CHEMISTRY', 'QUIMICA'))
       )
       and (nullif(trim(coalesce(p_difficulty, '')), '') is null
         or question.difficulty = upper(trim(p_difficulty)))
       and (nullif(trim(coalesce(p_package_type, '')), '') is null
         or question.package_type = upper(trim(p_package_type)))
       and (nullif(trim(coalesce(p_source_type, '')), '') is null
         or question.source_type = upper(trim(p_source_type)))
       and (v_query is null or concat_ws(' ', question.statement, question.topic,
             question.source_name, question.explanation) ilike '%' || v_query || '%')
       and (p_canonical_skill_id is null or exists (
         select 1
           from public.learning_question_bank_skill_links skill_link
          where skill_link.question_bank_id = question.id
            and skill_link.canonical_skill_id = p_canonical_skill_id
       ))
  )
  select filtered.id, filtered.package_type, filtered.source_type, filtered.source_name,
         filtered.source_year, filtered.subject_area, filtered.topic, filtered.statement,
         filtered.options, filtered.correct_answer, filtered.explanation, filtered.difficulty,
         count(*) over ()
    from filtered
   order by filtered.created_at desc, filtered.id
   limit v_page_size
  offset (v_page - 1) * v_page_size;
end;
$$;

-- Keep snapshots tied to approved material even if a caller bypasses the UI.
create or replace function private.add_learning_activity_question(
  p_institution_id uuid,
  p_activity_id uuid,
  p_item jsonb,
  p_position integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_bank_id uuid;
  v_bank public.learning_question_bank%rowtype;
  v_question_id uuid;
  v_text text;
  v_options jsonb;
  v_correct jsonb;
  v_explanation text;
  v_type text;
  v_points integer;
begin
  v_question_bank_id := nullif(p_item->>'question_bank_id', '')::uuid;

  if v_question_bank_id is not null then
    select bank.*
      into v_bank
      from public.learning_question_bank bank
     where bank.id = v_question_bank_id
       and bank.active
       and (
         (bank.institution_id is null and bank.package_type in ('TECESCOLA', 'ENEM'))
         or bank.institution_id = p_institution_id
       )
       and (
         lower(coalesce(bank.metadata->>'pedagogical_review_status', ''))
           in ('approved', 'published', 'approved_for_production')
         or (
           nullif(trim(coalesce(bank.metadata->>'pedagogical_review_status', '')), '') is null
           and lower(coalesce(bank.metadata->>'content_authoring_status', 'legacy'))
             not in ('candidate', 'draft', 'staging', 'pending', 'needs_review', 'pending_review',
                     'review_pending', 'pedagogical_review_pending', 'rejected', 'authored', 'tech_validated')
         )
       )
       and lower(coalesce(bank.metadata->>'content_status', '')) <> 'staging'
       and lower(coalesce(bank.metadata->>'publication_status', '')) <> 'staging'
       and lower(coalesce(bank.metadata->>'demo_preview_only', 'false')) <> 'true';
    if not found then
      raise exception 'LEARNING_QUESTION_BANK_SCOPE_OR_REVIEW_DENIED';
    end if;
    v_text := v_bank.statement;
    v_options := coalesce(v_bank.options, '[]'::jsonb);
    v_correct := coalesce(v_bank.correct_answer, 'null'::jsonb);
    v_explanation := v_bank.explanation;
  else
    v_text := nullif(trim(coalesce(p_item->>'question_text', '')), '');
    v_options := coalesce(p_item->'options_json', '[]'::jsonb);
    v_correct := coalesce(p_item->'correct_answer_json', 'null'::jsonb);
    v_explanation := nullif(trim(coalesce(p_item->>'explanation', '')), '');
  end if;

  if v_text is null then raise exception 'LEARNING_QUESTION_TEXT_REQUIRED'; end if;
  v_type := coalesce(nullif(p_item->>'question_type', ''), 'MULTIPLE_CHOICE');
  if v_type not in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER') then
    raise exception 'LEARNING_QUESTION_TYPE_INVALID';
  end if;
  if v_type = 'TRUE_FALSE' then
    v_options := '["Verdadeiro", "Falso"]'::jsonb;
    if v_correct is null or v_correct not in ('"Verdadeiro"'::jsonb, '"Falso"'::jsonb) then
      raise exception 'LEARNING_TRUE_FALSE_ANSWER_INVALID';
    end if;
  elsif v_type = 'MULTIPLE_CHOICE' then
    if jsonb_typeof(v_options) <> 'array' then
      raise exception 'LEARNING_MULTIPLE_CHOICE_OPTIONS_INVALID';
    end if;
    if jsonb_array_length(v_options) < 2 or not exists (
         select 1 from jsonb_array_elements(v_options) option_value(value)
          where option_value.value = v_correct
       ) then
      raise exception 'LEARNING_MULTIPLE_CHOICE_OPTIONS_INVALID';
    end if;
  end if;
  v_points := coalesce((p_item->>'points')::integer, 1);
  if v_points not between 1 and 100 then
    raise exception 'LEARNING_QUESTION_POINTS_INVALID';
  end if;

  insert into public.learning_questions(
    institution_id, activity_id, question_bank_id, question_text, question_type,
    options_json, correct_answer_json, explanation, points, sort_order
  ) values (
    p_institution_id, p_activity_id, v_question_bank_id, v_text, v_type,
    v_options, v_correct, v_explanation, v_points,
    coalesce((p_item->>'sort_order')::integer, p_position)
  ) returning id into v_question_id;

  if v_question_bank_id is not null then
    insert into public.learning_question_skill_links(
      institution_id, question_id, canonical_skill_id, skill_role
    )
    select p_institution_id, v_question_id, link.canonical_skill_id, link.skill_role
      from public.learning_question_bank_skill_links link
     where link.question_bank_id = v_question_bank_id
    on conflict (question_id, canonical_skill_id) do nothing;
  end if;
  return v_question_id;
end;
$$;

create or replace function public.publish_learning_activity_to_classes_v1(
  p_activity_id uuid,
  p_class_ids uuid[],
  p_available_at timestamptz default null,
  p_due_at timestamptz default null,
  p_max_attempts integer default null
)
returns table(class_id uuid, assignment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_class_id uuid;
  v_assignment_id uuid;
begin
  if auth.uid() is null or cardinality(coalesce(p_class_ids, '{}'::uuid[])) not between 1 and 20 then
    raise exception 'LEARNING_ASSIGNMENT_CLASS_SELECTION_INVALID';
  end if;
  if cardinality(array_remove(p_class_ids, null::uuid)) <> cardinality(p_class_ids)
     or cardinality(array(select distinct unnest(p_class_ids))) <> cardinality(p_class_ids) then
    raise exception 'LEARNING_ASSIGNMENT_DUPLICATE_CLASS';
  end if;
  if p_max_attempts is not null and p_max_attempts not between 1 and 50 then
    raise exception 'LEARNING_ASSIGNMENT_MAX_ATTEMPTS_INVALID';
  end if;
  if p_available_at is not null and p_due_at is not null and p_due_at <= p_available_at then
    raise exception 'LEARNING_ASSIGNMENT_DATE_RANGE_INVALID';
  end if;

  select activity.* into v_activity
    from public.learning_activities activity
   where activity.id = p_activity_id and activity.teacher_id = auth.uid()
   for update;
  if not found or v_activity.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'LEARNING_ACTIVITY_SCOPE_OR_STATUS_DENIED';
  end if;
  if not exists (
    select 1 from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = v_activity.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  ) then
    raise exception 'LEARNING_ACTIVITY_TEACHER_SCOPE_DENIED';
  end if;

  foreach v_class_id in array p_class_ids loop
    if not exists (
      select 1
        from public.subject_offerings offering
       where offering.subject_id = v_activity.subject_id
         and offering.class_id = v_class_id
         and offering.teacher_profile_id = auth.uid()
         and offering.active is true
    ) then
      raise exception 'LEARNING_ACTIVITY_CLASS_SUBJECT_SCOPE_DENIED';
    end if;
    if not private.learning_teacher_can_assign_activity(
      v_activity.id, v_activity.institution_id, v_class_id
    ) then
      raise exception 'LEARNING_ACTIVITY_CLASS_SCOPE_DENIED';
    end if;
  end loop;

  foreach v_class_id in array p_class_ids loop
    v_assignment_id := public.publish_learning_activity(
      v_activity.id, v_class_id, p_due_at
    );
    update public.learning_assignments assignment
       set available_at = p_available_at,
           max_attempts = p_max_attempts
     where assignment.id = v_assignment_id;
    class_id := v_class_id;
    assignment_id := v_assignment_id;
    return next;
  end loop;
end;
$$;

create or replace function public.archive_learning_activity_v1(p_activity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.learning_activities%rowtype;
begin
  select activity.* into v_activity
    from public.learning_activities activity
   where activity.id = p_activity_id
     and activity.teacher_id = auth.uid()
   for update;
  if not found then raise exception 'LEARNING_ACTIVITY_SCOPE_DENIED'; end if;
  if not exists (
    select 1 from public.memberships membership
     where membership.profile_id = auth.uid()
       and membership.institution_id = v_activity.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
  ) then raise exception 'LEARNING_ACTIVITY_TEACHER_SCOPE_DENIED'; end if;
  update public.learning_activities
     set status = 'ARCHIVED', updated_at = now()
   where id = p_activity_id;
  return p_activity_id;
end;
$$;

create or replace function public.list_student_learning_activities(p_institution_id uuid)
returns table (
  id uuid,
  subject_id uuid,
  unit_id uuid,
  skill_id uuid,
  teacher_id uuid,
  title text,
  description text,
  activity_type text,
  status text,
  created_at timestamptz,
  subjects jsonb,
  learning_questions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    activity.id,
    activity.subject_id,
    activity.unit_id,
    activity.skill_id,
    activity.teacher_id,
    activity.title,
    activity.description,
    activity.activity_type,
    activity.status,
    activity.created_at,
    jsonb_build_object('name', subject.name),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id,
        'question_text', question.question_text,
        'question_type', question.question_type,
        'options_json', question.options_json,
        'points', question.points,
        'sort_order', question.sort_order
      ) order by question.sort_order, question.id)
      from public.learning_questions question
      where question.activity_id = activity.id
    ), '[]'::jsonb)
  from public.learning_activities activity
  join public.subjects subject on subject.id = activity.subject_id
  where activity.institution_id = p_institution_id
    and activity.status = 'PUBLISHED'
    and subject.institution_id = p_institution_id
    and coalesce(subject.active, true)
    and exists (
      select 1
        from public.learning_assignments assignment
        join public.enrollments enrollment
          on enrollment.class_id = assignment.class_id
         and enrollment.active is true
        join public.students student
          on student.id = enrollment.student_id
         and student.active is true
       where assignment.activity_id = activity.id
         and assignment.institution_id = p_institution_id
         and (assignment.available_at is null or assignment.available_at <= now())
         and (assignment.due_at is null or assignment.due_at >= now())
         and student.profile_id = auth.uid()
         and student.institution_id = p_institution_id
    )
  order by activity.created_at desc;
$$;

create or replace function private.enforce_learning_assignment_attempt_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'LEARNING_ATTEMPT_AUTHENTICATION_REQUIRED';
  end if;
  if new.source not in ('PRACTICE', 'DIAGNOSTIC', 'LOCK_IN', 'REVIEW') then
    return new;
  end if;

  -- Serialize simultaneous attempts for the same learner and activity so a
  -- client cannot evade a limit by racing requests or choosing an old run number.
  perform pg_advisory_xact_lock(
    hashtextextended(new.activity_id::text || ':' || new.student_id::text, 0)
  );

  if not exists (
    select 1
      from public.learning_assignments assignment
      join public.enrollments enrollment
        on enrollment.class_id = assignment.class_id
       and enrollment.student_id = new.student_id
       and enrollment.active is true
      join public.students student
        on student.id = enrollment.student_id
       and student.active is true
       and student.institution_id = assignment.institution_id
      join public.learning_activities activity
        on activity.id = assignment.activity_id
       and activity.institution_id = assignment.institution_id
       and activity.status = 'PUBLISHED'
     where assignment.activity_id = new.activity_id
       and assignment.institution_id = new.institution_id
       and (auth.role() = 'service_role' or student.profile_id = auth.uid())
       and (assignment.available_at is null or assignment.available_at <= now())
       and (assignment.due_at is null or assignment.due_at >= now())
       and new.run_number = (
         select coalesce(max(previous.run_number), 0) + 1
           from public.learning_attempt_runs previous
          where previous.activity_id = new.activity_id
            and previous.institution_id = new.institution_id
            and previous.student_id = new.student_id
       )
       and (assignment.max_attempts is null or (
         select count(*)
           from public.learning_attempt_runs previous
          where previous.activity_id = new.activity_id
            and previous.institution_id = new.institution_id
            and previous.student_id = new.student_id
       ) < assignment.max_attempts)
  ) then
    raise exception 'LEARNING_ASSIGNMENT_NOT_AVAILABLE_OR_ATTEMPTS_EXHAUSTED';
  end if;
  return new;
end;
$$;

drop trigger if exists learning_attempt_runs_assignment_policy on public.learning_attempt_runs;
create trigger learning_attempt_runs_assignment_policy
before insert on public.learning_attempt_runs
for each row execute function private.enforce_learning_assignment_attempt_policy();

revoke all on function public.search_teacher_learning_question_bank_v1(uuid, text, text, text, text, text, uuid, integer, integer) from public, anon;
revoke all on function public.publish_learning_activity_to_classes_v1(uuid, uuid[], timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.archive_learning_activity_v1(uuid) from public, anon;
revoke all on function private.enforce_learning_assignment_attempt_policy() from public, anon, authenticated;
grant execute on function public.search_teacher_learning_question_bank_v1(uuid, text, text, text, text, text, uuid, integer, integer) to authenticated;
grant execute on function public.publish_learning_activity_to_classes_v1(uuid, uuid[], timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.archive_learning_activity_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
