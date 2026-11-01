begin;

create table public.tec_language_placement_attempts_v1 (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  course_code text not null references public.tec_english_courses(course_code) on delete cascade,
  attempt_id uuid not null,
  diagnostic_version integer not null check (diagnostic_version = 1),
  result_kind text not null check (result_kind in ('START_FROM_ZERO', 'ASSESSMENT')),
  score integer not null check (score between 0 and 5),
  question_count integer not null check (question_count between 0 and 5),
  highest_difficulty integer not null check (highest_difficulty between 1 and 3),
  recommended_unit_position integer not null check (recommended_unit_position between 1 and 4),
  created_at timestamptz not null default now(),
  constraint tec_language_placement_attempts_v1_result_shape check (
    score <= question_count
    and ((result_kind = 'START_FROM_ZERO' and score = 0 and question_count = 0 and highest_difficulty = 1 and recommended_unit_position = 1)
      or (result_kind = 'ASSESSMENT' and question_count between 1 and 5))
  ),
  constraint tec_language_placement_attempts_v1_idempotency unique (institution_id, student_id, course_code, attempt_id)
);

create index tec_language_placement_attempts_v1_latest_idx
  on public.tec_language_placement_attempts_v1 (institution_id, student_id, course_code, created_at desc, id desc);

alter table public.tec_language_placement_attempts_v1 enable row level security;

create or replace function private.tec_language_placement_row_is_self(p_institution_id uuid, p_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.institutions institution
     where institution.id = p_institution_id and institution.active
  ) and private.tec_english_current_student_id(p_institution_id) = p_student_id;
exception
  when insufficient_privilege then return false;
end;
$$;

create policy tec_language_placement_attempts_v1_student_select
  on public.tec_language_placement_attempts_v1
  for select to authenticated
  using (private.tec_language_placement_row_is_self(institution_id, student_id));

revoke all on table public.tec_language_placement_attempts_v1 from public, anon, authenticated;
grant select on table public.tec_language_placement_attempts_v1 to authenticated;
grant all on table public.tec_language_placement_attempts_v1 to service_role;
revoke all on function private.tec_language_placement_row_is_self(uuid, uuid) from public, anon;
grant execute on function private.tec_language_placement_row_is_self(uuid, uuid) to authenticated;

create or replace function public.get_tec_language_placement_v1(p_institution_id uuid, p_course_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_result jsonb;
begin
  if p_course_code is null or p_course_code not in (
    'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
    'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
    'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER'
  ) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_COURSE_NOT_ALLOWED' using errcode = '22023';
  end if;

  if not exists (select 1 from public.institutions institution where institution.id = p_institution_id and institution.active) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if not private.tec_english_course_available(p_institution_id, p_course_code, false) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  v_student_id := private.tec_english_current_student_id(p_institution_id);
  if v_student_id is null then
    raise exception 'TEC_IDIOMAS_PLACEMENT_SCOPE_DENIED' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'attemptId', attempt.attempt_id,
    'record', pg_catalog.jsonb_build_object(
      'version', attempt.diagnostic_version,
      'kind', attempt.result_kind,
      'score', attempt.score,
      'questionCount', attempt.question_count,
      'highestDifficulty', attempt.highest_difficulty,
      'recommendedUnitPosition', attempt.recommended_unit_position,
      'completedAt', attempt.created_at
    )
  )
    into v_result
    from public.tec_language_placement_attempts_v1 attempt
   where attempt.institution_id = p_institution_id
     and attempt.student_id = v_student_id
     and attempt.course_code = p_course_code
   order by attempt.created_at desc, attempt.id desc
   limit 1;

  return coalesce(v_result, pg_catalog.jsonb_build_object('attemptId', null, 'record', null));
end;
$$;

create or replace function public.save_tec_language_placement_v1(
  p_institution_id uuid,
  p_course_code text,
  p_attempt_id uuid,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_version_numeric numeric;
  v_score_numeric numeric;
  v_question_count_numeric numeric;
  v_highest_difficulty_numeric numeric;
  v_recommended_unit_position_numeric numeric;
  v_version integer;
  v_kind text;
  v_score integer;
  v_question_count integer;
  v_highest_difficulty integer;
  v_recommended_unit_position integer;
  v_attempt public.tec_language_placement_attempts_v1%rowtype;
begin
  if p_course_code is null or p_course_code not in (
    'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
    'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
    'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER'
  ) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_COURSE_NOT_ALLOWED' using errcode = '22023';
  end if;
  if p_attempt_id is null or p_record is null or pg_catalog.jsonb_typeof(p_record) <> 'object'
     or pg_catalog.octet_length(p_record::text) > 2048
     or pg_catalog.jsonb_typeof(p_record -> 'version') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_record -> 'kind') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_record -> 'score') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_record -> 'questionCount') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_record -> 'highestDifficulty') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_record -> 'recommendedUnitPosition') is distinct from 'number' then
    raise exception 'TEC_IDIOMAS_PLACEMENT_INVALID_RECORD' using errcode = '22023';
  end if;

  v_version_numeric := (p_record ->> 'version')::numeric;
  v_score_numeric := (p_record ->> 'score')::numeric;
  v_question_count_numeric := (p_record ->> 'questionCount')::numeric;
  v_highest_difficulty_numeric := (p_record ->> 'highestDifficulty')::numeric;
  v_recommended_unit_position_numeric := (p_record ->> 'recommendedUnitPosition')::numeric;
  if v_version_numeric <> pg_catalog.trunc(v_version_numeric)
     or v_score_numeric <> pg_catalog.trunc(v_score_numeric)
     or v_question_count_numeric <> pg_catalog.trunc(v_question_count_numeric)
     or v_highest_difficulty_numeric <> pg_catalog.trunc(v_highest_difficulty_numeric)
     or v_recommended_unit_position_numeric <> pg_catalog.trunc(v_recommended_unit_position_numeric)
     or v_version_numeric <> 1
     or v_score_numeric not between 0 and 5
     or v_question_count_numeric not between 0 and 5
     or v_highest_difficulty_numeric not between 1 and 3
     or v_recommended_unit_position_numeric not between 1 and 4 then
    raise exception 'TEC_IDIOMAS_PLACEMENT_INVALID_RECORD' using errcode = '22023';
  end if;

  v_version := v_version_numeric::integer;
  v_kind := p_record ->> 'kind';
  v_score := v_score_numeric::integer;
  v_question_count := v_question_count_numeric::integer;
  v_highest_difficulty := v_highest_difficulty_numeric::integer;
  v_recommended_unit_position := v_recommended_unit_position_numeric::integer;
  if v_version <> 1 or v_kind not in ('START_FROM_ZERO', 'ASSESSMENT')
     or v_score not between 0 and 5 or v_question_count not between 0 and 5
     or v_score > v_question_count or v_highest_difficulty not between 1 and 3
     or v_recommended_unit_position not between 1 and 4
     or (v_kind = 'ASSESSMENT' and v_question_count = 0)
     or (v_kind = 'START_FROM_ZERO' and (v_score <> 0 or v_question_count <> 0 or v_highest_difficulty <> 1 or v_recommended_unit_position <> 1)) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_INVALID_RECORD' using errcode = '22023';
  end if;

  if not exists (select 1 from public.institutions institution where institution.id = p_institution_id and institution.active) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if not private.tec_english_course_available(p_institution_id, p_course_code, false) then
    raise exception 'TEC_IDIOMAS_PLACEMENT_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  v_student_id := private.tec_english_current_student_id(p_institution_id);
  if v_student_id is null then
    raise exception 'TEC_IDIOMAS_PLACEMENT_SCOPE_DENIED' using errcode = '42501';
  end if;

  insert into public.tec_language_placement_attempts_v1 (
    institution_id, student_id, course_code, attempt_id, diagnostic_version,
    result_kind, score, question_count, highest_difficulty, recommended_unit_position
  ) values (
    p_institution_id, v_student_id, p_course_code, p_attempt_id, v_version,
    v_kind, v_score, v_question_count, v_highest_difficulty, v_recommended_unit_position
  )
  on conflict (institution_id, student_id, course_code, attempt_id) do nothing;

  select * into v_attempt
    from public.tec_language_placement_attempts_v1 attempt
   where attempt.institution_id = p_institution_id
     and attempt.student_id = v_student_id
     and attempt.course_code = p_course_code
     and attempt.attempt_id = p_attempt_id;

  if v_attempt.diagnostic_version <> v_version or v_attempt.result_kind <> v_kind
     or v_attempt.score <> v_score or v_attempt.question_count <> v_question_count
     or v_attempt.highest_difficulty <> v_highest_difficulty
     or v_attempt.recommended_unit_position <> v_recommended_unit_position then
    raise exception 'TEC_IDIOMAS_PLACEMENT_IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;

  return pg_catalog.jsonb_build_object(
    'attemptId', v_attempt.attempt_id,
    'record', pg_catalog.jsonb_build_object(
      'version', v_attempt.diagnostic_version,
      'kind', v_attempt.result_kind,
      'score', v_attempt.score,
      'questionCount', v_attempt.question_count,
      'highestDifficulty', v_attempt.highest_difficulty,
      'recommendedUnitPosition', v_attempt.recommended_unit_position,
      'completedAt', v_attempt.created_at
    )
  );
end;
$$;

revoke all on function public.get_tec_language_placement_v1(uuid, text) from public, anon;
revoke all on function public.save_tec_language_placement_v1(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.get_tec_language_placement_v1(uuid, text) to authenticated;
grant execute on function public.save_tec_language_placement_v1(uuid, text, uuid, jsonb) to authenticated;

comment on table public.tec_language_placement_attempts_v1 is
  'Server-scoped, per-student and per-institution Tec Idiomas starting-point diagnostic history; this data does not award XP or unlock lessons.';

commit;
