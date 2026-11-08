begin;

alter table public.learning_curriculum_skills
  add column if not exists technical_validation_status text not null default 'VALIDATION_PENDING',
  add column if not exists technical_validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists technical_validated_at timestamptz,
  add column if not exists technical_validator_version text;

alter table public.learning_curriculum_skills
  drop constraint if exists learning_curriculum_skills_technical_validation_status_check;
alter table public.learning_curriculum_skills
  add constraint learning_curriculum_skills_technical_validation_status_check
  check (technical_validation_status in ('DRAFT', 'VALIDATION_PENDING', 'VALIDATION_FAILED', 'READY', 'PUBLISHED', 'DISABLED'));

alter table public.learning_adaptive_content_packs
  add column if not exists technical_validation_status text not null default 'VALIDATION_PENDING',
  add column if not exists technical_validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists technical_validated_at timestamptz,
  add column if not exists technical_validator_version text;

alter table public.learning_adaptive_content_packs
  drop constraint if exists learning_adaptive_content_packs_technical_validation_status_check;
alter table public.learning_adaptive_content_packs
  add constraint learning_adaptive_content_packs_technical_validation_status_check
  check (technical_validation_status in ('DRAFT', 'VALIDATION_PENDING', 'VALIDATION_FAILED', 'READY', 'PUBLISHED', 'DISABLED'));

alter table public.learning_central_studies_v2_candidates
  add column if not exists technical_validation_status text not null default 'VALIDATION_PENDING',
  add column if not exists technical_validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists technical_validated_at timestamptz,
  add column if not exists technical_validator_version text;

alter table public.learning_central_studies_v2_candidates
  drop constraint if exists learning_central_studies_v2_candidates_technical_validation_status_check;
alter table public.learning_central_studies_v2_candidates
  add constraint learning_central_studies_v2_candidates_technical_validation_status_check
  check (technical_validation_status in ('DRAFT', 'VALIDATION_PENDING', 'VALIDATION_FAILED', 'READY', 'PUBLISHED', 'DISABLED'));

alter table public.learning_central_studies_v2_runtime alter column integrated_by drop not null;
alter table public.learning_central_studies_v2_institution_targets
  alter column changed_by drop not null;

create table if not exists private.guided_content_validation_runs_v12 (
  id uuid primary key default extensions.uuid_generate_v4(),
  source_type text not null check (source_type in ('BNCC_SKILL', 'CENTRAL_STUDIES_V2', 'ADAPTIVE_CONTENT_PACK')),
  source_id text not null,
  content_version text not null,
  fingerprint text not null,
  validation_status text not null check (validation_status in ('VALIDATION_FAILED', 'READY', 'PUBLISHED', 'DISABLED')),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  validator_version text not null default 'TECESCOLA_GUIDED_STUDY_V12',
  validated_at timestamptz not null default now(),
  unique (source_type, source_id, content_version, fingerprint, validator_version)
);
alter table private.guided_content_validation_runs_v12 enable row level security;
revoke all on private.guided_content_validation_runs_v12 from public, anon, authenticated;
grant select, insert, update on private.guided_content_validation_runs_v12 to service_role;

create or replace function private.record_guided_content_validation_v12(
  p_source_type text, p_source_id text, p_content_version text, p_fingerprint text,
  p_status text, p_errors jsonb, p_checks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.guided_content_validation_runs_v12(
    source_type, source_id, content_version, fingerprint, validation_status, errors, checks
  ) values (
    p_source_type, p_source_id, p_content_version, p_fingerprint, p_status,
    coalesce(p_errors, '[]'::jsonb), coalesce(p_checks, '{}'::jsonb)
  )
  on conflict (source_type, source_id, content_version, fingerprint, validator_version)
  do update set validation_status = excluded.validation_status,
                errors = excluded.errors,
                checks = excluded.checks,
                validated_at = now();
end;
$$;
revoke all on function private.record_guided_content_validation_v12(text, text, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function private.guided_json_array_length_v12(p_value jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'array' then jsonb_array_length(p_value) else 0 end;
$$;
revoke all on function private.guided_json_array_length_v12(jsonb) from public, anon, authenticated;

create or replace function private.validate_central_studies_v2_candidate_v12(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.learning_central_studies_v2_candidates%rowtype;
  payload jsonb;
  errors jsonb := '[]'::jsonb;
  expected_purposes text[] := array['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
  purpose text;
  question jsonb;
  question_count integer := 0;
  duplicate_count integer := 0;
  official_skill_id uuid;
  status_value text;
begin
  select * into candidate
    from public.learning_central_studies_v2_candidates row
   where row.id = p_candidate_id;
  if not found then
    return jsonb_build_object('status', 'VALIDATION_FAILED', 'errors', jsonb_build_array('CANDIDATE_NOT_FOUND'));
  end if;
  payload := candidate.payload;

  if payload->>'journeyCode' is distinct from candidate.journey_code
     or payload->>'subject' is distinct from candidate.subject_area
     or (case when coalesce(payload->>'grade', '') ~ '^[0-9]{1,2}$'
          then (payload->>'grade')::smallint is distinct from candidate.grade_level
          else true end)
     or payload->>'officialSkillCode' is distinct from candidate.official_skill_code then
    errors := errors || jsonb_build_array('SOURCE_FIELDS_MISMATCH');
  end if;
  if candidate.official_skill_code !~ '^EF06(MA|LP|CI)[0-9]{2}$' then
    errors := errors || jsonb_build_array('OFFICIAL_CODE_FORMAT_INVALID');
  else
    select skill.id into official_skill_id
      from public.learning_curriculum_skills skill
      join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
       and catalog.code = 'BNCC_2018' and catalog.active
     where skill.active and skill.grade_level = 6
       and (skill.code = candidate.official_skill_code or skill.metadata->>'official_code' = candidate.official_skill_code)
     order by (skill.code = candidate.official_skill_code) desc, skill.id
     limit 1;
    if official_skill_id is null then
      errors := errors || jsonb_build_array('OFFICIAL_BNCC_MAPPING_NOT_FOUND');
    end if;
  end if;

  if jsonb_typeof(payload->'lesson') is distinct from 'object'
     or length(btrim(coalesce(payload#>>'{lesson,title}', ''))) < 4
     or length(btrim(coalesce(payload#>>'{lesson,introduction}', ''))) < 20
     or length(btrim(coalesce(payload#>>'{lesson,explanation}', ''))) < 40
     or length(btrim(coalesce(payload#>>'{lesson,workedExample,prompt}', ''))) < 10
     or length(btrim(coalesce(payload#>>'{lesson,workedExample,answer}', ''))) < 2
     or jsonb_typeof(payload#>'{lesson,workedExample,steps}') is distinct from 'array'
     or private.guided_json_array_length_v12(payload#>'{lesson,workedExample,steps}') < 2
     or jsonb_typeof(payload#>'{lesson,guidedPractice}') is distinct from 'array'
     or private.guided_json_array_length_v12(payload#>'{lesson,guidedPractice}') < 2
     or jsonb_typeof(payload#>'{lesson,application}') is distinct from 'array'
     or private.guided_json_array_length_v12(payload#>'{lesson,application}') < 1
     or jsonb_typeof(payload#>'{lesson,review}') is distinct from 'array'
     or private.guided_json_array_length_v12(payload#>'{lesson,review}') < 3 then
    errors := errors || jsonb_build_array('LESSON_STRUCTURE_INCOMPLETE');
  end if;

  if jsonb_typeof(payload->'questions') is distinct from 'array' then
    errors := errors || jsonb_build_array('QUESTION_COLLECTION_INVALID');
  else
    question_count := jsonb_array_length(payload->'questions');
    if question_count < cardinality(expected_purposes) then
      errors := errors || jsonb_build_array('QUESTION_COUNT_INSUFFICIENT');
    end if;
    foreach purpose in array expected_purposes loop
      if not exists (select 1 from jsonb_array_elements(payload->'questions') item(value)
                      where item.value->>'purpose' = purpose) then
        errors := errors || jsonb_build_array('QUESTION_PURPOSE_MISSING:' || purpose);
      end if;
    end loop;
    for question in select value from jsonb_array_elements(payload->'questions') loop
      if coalesce(question->>'purpose', '') <> all(expected_purposes)
         or length(btrim(coalesce(question->>'statement', ''))) < 12
         or length(btrim(coalesce(question->>'explanation', ''))) < 12
         or coalesce(question->>'interactionType', 'SINGLE_CHOICE') <> 'SINGLE_CHOICE'
         or question->>'officialSkillCode' is distinct from candidate.official_skill_code
         or jsonb_typeof(question->'options') is distinct from 'array'
         or private.guided_json_array_length_v12(question->'options') <> 4
         or not exists (select 1 from jsonb_array_elements_text(coalesce(question->'options', '[]'::jsonb)) option(value)
                          where option.value = question->>'correctAnswer') then
        errors := errors || jsonb_build_array('QUESTION_STRUCTURE_INVALID:' || coalesce(question->>'id', 'NO_ID'));
      end if;
      if question->>'demo_preview' = 'true' or question->>'demonstration_only' = 'true'
         or question->>'is_test_fixture' = 'true' or question->>'test_fixture' = 'true'
         or coalesce(question->>'id', '') ~* '(demo|fixture|test)' then
        errors := errors || jsonb_build_array('DEMONSTRATION_CONTENT');
      end if;
    end loop;
    select count(*) - count(distinct lower(regexp_replace(btrim(item.value->>'statement'), '\s+', ' ', 'g')))
      into duplicate_count
      from jsonb_array_elements(payload->'questions') item(value);
    if duplicate_count > 0 then
      errors := errors || jsonb_build_array('DUPLICATE_QUESTION_STEMS');
    end if;
  end if;

  if payload->>'demonstration_only' = 'true' or payload->>'demo_preview_only' = 'true'
     or payload->>'is_test_fixture' = 'true' or payload->>'test_fixture' = 'true'
     or candidate.journey_code ~* '(demo|fixture|test)' then
    errors := errors || jsonb_build_array('DEMONSTRATION_CONTENT');
  end if;
  status_value := case when jsonb_array_length(errors) = 0 then 'READY' else 'VALIDATION_FAILED' end;
  perform private.record_guided_content_validation_v12(
    'CENTRAL_STUDIES_V2', candidate.id::text, candidate.content_version,
    candidate.snapshot_fingerprint, status_value, errors,
    jsonb_build_object('official_mapping', official_skill_id is not null,
      'lesson_complete', not (errors ? 'LESSON_STRUCTURE_INCOMPLETE'),
      'question_count', question_count, 'duplicate_stems', duplicate_count,
      'required_purposes', expected_purposes)
  );
  update public.learning_central_studies_v2_candidates
     set technical_validation_status = status_value,
         technical_validation_errors = errors,
         technical_validated_at = now(),
         technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
         updated_at = now()
   where id = candidate.id and (technical_validation_status is distinct from status_value
      or technical_validation_errors is distinct from errors
      or technical_validator_version is distinct from 'TECESCOLA_GUIDED_STUDY_V12');
  return jsonb_build_object('status', status_value, 'errors', errors,
    'official_skill_id', official_skill_id, 'question_count', question_count);
end;
$$;
revoke all on function private.validate_central_studies_v2_candidate_v12(uuid) from public, anon, authenticated;

create or replace function private.validate_bncc_high_school_skill_v12(
  p_skill_id uuid, p_skill_code text, p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  errors jsonb := '[]'::jsonb;
  question_count integer := 0;
  distinct_question_count integer := 0;
  distinct_purpose_count integer := 0;
  lesson_row public.learning_skill_lessons%rowtype;
  official_skill_exists boolean;
  set_row record;
  set_question_count integer;
  invalid_question_count integer;
  demo_question_count integer;
  fingerprint text;
  status_value text;
begin
  select exists(
    select 1 from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
     and catalog.active and catalog.code = 'BNCC_2018'
    where skill.id = p_skill_id and skill.active and skill.node_kind = 'LEAF'
      and skill.code = p_skill_code
      and skill.metadata->>'official_code' = p_skill_code
      and p_skill_code ~ '^EM13[A-Z]{3}[0-9]{3}$'
  ) into official_skill_exists;
  if not official_skill_exists then errors := errors || jsonb_build_array('OFFICIAL_BNCC_CODE_NOT_VERIFIABLE'); end if;

  if not exists (
    select 1 from public.learning_curriculum_grade_targets target
     where target.canonical_skill_id = p_skill_id and target.active
       and target.stage = 'ENSINO_MEDIO' and target.grade_level between 1 and 3
  ) then
    errors := errors || jsonb_build_array('GRADE_TARGET_MISSING');
  end if;

  select lesson.* into lesson_row
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = p_skill_id and lesson.active
     and lesson.version = 4
   order by lesson.id limit 1;
  if not found or length(btrim(coalesce(lesson_row.title, ''))) < 4
      or length(btrim(coalesce(lesson_row.summary, ''))) < 20
      or length(btrim(coalesce(lesson_row.content_markdown, ''))) < 120 then
    errors := errors || jsonb_build_array('LESSON_STRUCTURE_INCOMPLETE');
  elsif coalesce(lesson_row.metadata->>'demo_preview_only', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'demonstration_only', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'is_test_fixture', 'false') = 'true' then
    errors := errors || jsonb_build_array('DEMONSTRATION_CONTENT');
  end if;

  for set_row in
    select question_set.id, question_set.purpose, question_set.metadata
      from public.learning_question_sets question_set
     where question_set.canonical_skill_id = p_skill_id
       and question_set.scope = 'GLOBAL' and question_set.version = 4
       and question_set.active and question_set.institution_id is null
       and question_set.teacher_profile_id is null
  loop
    select count(*)::integer,
           count(*) filter (where bank.active and length(btrim(bank.statement)) >= 12
             and jsonb_typeof(bank.options) = 'array'
             and private.guided_json_array_length_v12(bank.options) = 4
             and bank.correct_answer is not null
             and exists (select 1 from jsonb_array_elements_text(bank.options) option(value)
                           where to_jsonb(option.value) = bank.correct_answer)
             and length(btrim(coalesce(bank.explanation, ''))) >= 12)::integer,
           count(*) filter (where not bank.active
             or coalesce(bank.metadata->>'demo_preview', 'false') = 'true'
             or coalesce(bank.metadata->>'demo_preview_only', 'false') = 'true'
             or coalesce(bank.metadata->>'demonstration_only', 'false') = 'true'
             or coalesce(bank.metadata->>'is_test_fixture', 'false') = 'true')::integer
      into set_question_count, invalid_question_count, demo_question_count
      from public.learning_question_set_items item
      join public.learning_question_bank bank on bank.id = item.question_bank_id
     where item.question_set_id = set_row.id;
    if coalesce(set_question_count, 0) < 1 or invalid_question_count <> set_question_count then
      errors := errors || jsonb_build_array('QUESTION_STRUCTURE_INVALID:' || set_row.purpose);
    end if;
    if coalesce(demo_question_count, 0) > 0
       or coalesce(set_row.metadata->>'demo_preview', 'false') = 'true'
       or coalesce(set_row.metadata->>'demo_preview_only', 'false') = 'true'
       or coalesce(set_row.metadata->>'demonstration_only', 'false') = 'true' then
      errors := errors || jsonb_build_array('DEMONSTRATION_CONTENT:' || set_row.purpose);
    end if;
  end loop;

  select count(distinct question_set.purpose)::integer,
         count(item.question_bank_id)::integer,
         count(distinct lower(regexp_replace(btrim(bank.statement), '\s+', ' ', 'g')))::integer
    into distinct_purpose_count, question_count, distinct_question_count
    from public.learning_question_sets question_set
    join public.learning_question_set_items item on item.question_set_id = question_set.id
    join public.learning_question_bank bank on bank.id = item.question_bank_id
   where question_set.canonical_skill_id = p_skill_id
     and question_set.scope = 'GLOBAL' and question_set.version = 4
     and question_set.active and question_set.institution_id is null
     and question_set.teacher_profile_id is null
     and question_set.purpose in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW');
  if distinct_purpose_count <> 5 or question_count < 5 then
    errors := errors || jsonb_build_array('QUESTION_PURPOSE_COVERAGE_INCOMPLETE');
  end if;
  if distinct_question_count <> question_count then
    errors := errors || jsonb_build_array('DUPLICATE_QUESTION_STEMS');
  end if;

  fingerprint := encode(extensions.digest(convert_to(
    coalesce(p_skill_code, '') || ':' || coalesce(p_metadata->>'official_code', '') || ':' ||
    coalesce((select lesson.content_markdown from public.learning_skill_lessons lesson
       where lesson.canonical_skill_id = p_skill_id and lesson.active and lesson.version = 4 limit 1), '') || ':' ||
    coalesce((select string_agg(bank.id::text || ':' || bank.statement || ':' || bank.correct_answer::text, '|' order by bank.id)
      from public.learning_question_bank_skill_links link
      join public.learning_question_bank bank on bank.id = link.question_bank_id
      where link.canonical_skill_id = p_skill_id and bank.active), ''), 'UTF8'), 'sha256'), 'hex');
  status_value := case when jsonb_array_length(errors) = 0 then 'READY' else 'VALIDATION_FAILED' end;
  perform private.record_guided_content_validation_v12(
    'BNCC_SKILL', p_skill_id::text, 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4',
    fingerprint, status_value, errors,
    jsonb_build_object('official_code', p_skill_code, 'lesson_available', lesson_row.id is not null,
      'question_count', question_count, 'purpose_count', distinct_purpose_count,
      'duplicate_stems', greatest(question_count - distinct_question_count, 0))
  );
  return jsonb_build_object('status', status_value, 'errors', errors,
    'fingerprint', fingerprint, 'question_count', question_count);
end;
$$;
revoke all on function private.validate_bncc_high_school_skill_v12(uuid, text, jsonb) from public, anon, authenticated;

create or replace function private.validate_mapped_bncc_skill_v12(
  p_skill_id uuid, p_skill_code text default null, p_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  skill_row public.learning_curriculum_skills%rowtype;
  lesson_row public.learning_skill_lessons%rowtype;
  errors jsonb := '[]'::jsonb;
  expected_purposes text[] := array['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
  question_count integer := 0;
  valid_question_count integer := 0;
  distinct_question_count integer := 0;
  purpose_count integer := 0;
  demo_question_count integer := 0;
  fingerprint text;
  status_value text;
  required_purpose text;
  content_version integer := 4;
  skill_code text;
  skill_metadata jsonb;
begin
  select skill.* into skill_row
    from public.learning_curriculum_skills skill where skill.id = p_skill_id;
  if not found then
    return jsonb_build_object('status', 'VALIDATION_FAILED', 'errors', jsonb_build_array('SKILL_NOT_FOUND'));
  end if;
  skill_code := coalesce(p_skill_code, skill_row.code);
  skill_metadata := coalesce(p_metadata, skill_row.metadata);

  if coalesce(skill_metadata->>'content_version', '') ~ '^[0-9]+$' then
    content_version := (skill_metadata->>'content_version')::integer;
  end if;

  if not exists (
    select 1 from public.learning_curriculum_catalogs catalog
     where catalog.id = skill_row.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
  ) or skill_code !~ '^(EI[0-9]{2}[A-Z]{2}[0-9]{2}|EF[0-9]{2}[A-Z]{2}[0-9]{2}|EM13[A-Z]{3}[0-9]{3})$'
     or coalesce(skill_metadata->>'official_code', skill_code) is distinct from skill_code then
    errors := errors || jsonb_build_array('OFFICIAL_BNCC_MAPPING_NOT_VERIFIABLE');
  end if;
  if not exists (
    select 1 from public.learning_curriculum_grade_targets target
     where target.canonical_skill_id = skill_row.id and target.catalog_id = skill_row.catalog_id
       and target.active and (
           (skill_code ~ '^EF[0-9]{2}'
             and target.grade_level = case when skill_code ~ '^EF[0-9]{2}'
               then substring(skill_code from 3 for 2)::smallint else null end
            and target.stage = 'ENSINO_FUNDAMENTAL')
          or (skill_code ~ '^EM13' and target.stage = 'ENSINO_MEDIO'
           and target.grade_level between 1 and 3)
       )
  ) then
    errors := errors || jsonb_build_array('GRADE_TARGET_MISSING');
  end if;
  if not skill_row.active or skill_row.node_kind <> 'LEAF' then
    errors := errors || jsonb_build_array('SKILL_NOT_ACTIVE_LEAF');
  end if;
  if coalesce(skill_metadata->>'demo_preview', 'false') = 'true'
     or coalesce(skill_metadata->>'demo_preview_only', 'false') = 'true'
     or coalesce(skill_metadata->>'demonstration_only', 'false') = 'true'
     or coalesce(skill_metadata->>'is_test_fixture', 'false') = 'true'
     or coalesce(skill_metadata->>'fixture_only', 'false') = 'true'
     or coalesce(skill_metadata->>'test_fixture', 'false') = 'true'
     or skill_metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8' then
    errors := errors || jsonb_build_array('DEMONSTRATION_OR_TEST_CONTENT');
  end if;

  select lesson.* into lesson_row
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = skill_row.id and lesson.version = content_version and lesson.active
   order by lesson.updated_at desc, lesson.id limit 1;
  if not found or length(btrim(coalesce(lesson_row.title, ''))) < 4
      or length(btrim(coalesce(lesson_row.summary, ''))) < 20
      or length(btrim(coalesce(lesson_row.content_markdown, ''))) < 120
      or coalesce(lesson_row.metadata->>'demo_preview_only', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'demonstration_only', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'is_test_fixture', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'fixture_only', 'false') = 'true'
      or coalesce(lesson_row.metadata->>'test_fixture', 'false') = 'true' then
    errors := errors || jsonb_build_array('LESSON_STRUCTURE_OR_SCOPE_INVALID');
  end if;

  select count(distinct question_set.purpose)::integer,
         count(item.id)::integer,
         count(item.id) filter (where bank.active
           and length(btrim(coalesce(bank.statement, ''))) >= 12
           and length(btrim(coalesce(bank.explanation, ''))) >= 12
           and jsonb_typeof(bank.options) = 'array'
           and private.guided_json_array_length_v12(bank.options) between 2 and 5
           and bank.correct_answer is not null
           and case when jsonb_typeof(bank.options) = 'array' then exists (
             select 1 from jsonb_array_elements(bank.options) option_row(value)
              where option_row.value = bank.correct_answer
                 or option_row.value->'id' = bank.correct_answer
                 or option_row.value->'text' = bank.correct_answer
           ) else false end
           and (bank.metadata->>'official_bncc_code' is null
                or bank.metadata->>'official_bncc_code' = skill_code))::integer,
         count(item.id) filter (where not bank.active
           or coalesce(bank.metadata->>'demo_preview', 'false') = 'true'
           or coalesce(bank.metadata->>'demo_preview_only', 'false') = 'true'
           or coalesce(bank.metadata->>'demonstration_only', 'false') = 'true'
           or coalesce(bank.metadata->>'is_test_fixture', 'false') = 'true'
           or coalesce(bank.metadata->>'fixture_only', 'false') = 'true'
           or coalesce(bank.metadata->>'test_fixture', 'false') = 'true'
           or coalesce(question_set.metadata->>'demo_preview', 'false') = 'true'
           or coalesce(question_set.metadata->>'demo_preview_only', 'false') = 'true'
           or coalesce(question_set.metadata->>'demonstration_only', 'false') = 'true'
           or coalesce(question_set.metadata->>'is_test_fixture', 'false') = 'true'
           or coalesce(question_set.metadata->>'fixture_only', 'false') = 'true'
           or coalesce(question_set.metadata->>'test_fixture', 'false') = 'true'
           or coalesce(bank.metadata->>'qa_only', 'false') = 'true'
           or coalesce(question_set.metadata->>'qa_only', 'false') = 'true')::integer,
         count(distinct lower(regexp_replace(btrim(bank.statement), '\s+', ' ', 'g')))::integer
    into purpose_count, question_count, valid_question_count, demo_question_count, distinct_question_count
    from public.learning_question_sets question_set
    left join public.learning_question_set_items item on item.question_set_id = question_set.id
    left join public.learning_question_bank bank on bank.id = item.question_bank_id
   where question_set.canonical_skill_id = skill_row.id
     and question_set.scope = 'GLOBAL' and question_set.institution_id is null
     and question_set.teacher_profile_id is null and question_set.version = content_version and question_set.active;

  foreach required_purpose in array expected_purposes loop
    if not exists (
      select 1 from public.learning_question_sets question_set
       where question_set.canonical_skill_id = skill_row.id and question_set.scope = 'GLOBAL'
         and question_set.institution_id is null and question_set.teacher_profile_id is null
         and question_set.version = content_version and question_set.active and question_set.purpose = required_purpose
    ) then
      errors := errors || jsonb_build_array('QUESTION_PURPOSE_MISSING:' || required_purpose);
    end if;
  end loop;
  if purpose_count <> 5 or question_count < 5 or valid_question_count <> question_count then
    errors := errors || jsonb_build_array('QUESTION_STRUCTURE_OR_COVERAGE_INCOMPLETE');
  end if;
  if demo_question_count > 0 then
    errors := errors || jsonb_build_array('DEMONSTRATION_OR_TEST_QUESTIONS');
  end if;
  if distinct_question_count <> question_count then
    errors := errors || jsonb_build_array('DUPLICATE_QUESTION_STEMS');
  end if;
  if nullif(skill_metadata->>'content_pack', '') is not null
     and skill_metadata->>'content_pack' <> 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
     and not exists (
    select 1 from public.learning_adaptive_content_packs pack
      where pack.pack_version = skill_metadata->>'content_pack'
       and pack.active and pack.publication_status = 'PUBLISHED'
       and pack.technical_validation_status = 'PUBLISHED'
  ) then
    errors := errors || jsonb_build_array('CONTENT_PACK_NOT_PUBLISHED');
  end if;

  fingerprint := encode(extensions.digest(convert_to(
    skill_code || ':' || coalesce(skill_metadata->>'content_version', '') || ':' ||
    coalesce(lesson_row.id::text || ':' || lesson_row.version::text || ':' || lesson_row.title || ':' || lesson_row.summary || ':' || lesson_row.content_markdown, '') || ':' ||
    coalesce((select string_agg(question_set.purpose || ':' || bank.id::text || ':' || bank.statement || ':' || bank.options::text || ':' || bank.correct_answer::text || ':' || bank.explanation || ':' || bank.active::text || ':' || bank.metadata::text || ':' || question_set.metadata::text, '|' order by question_set.purpose, bank.id)
      from public.learning_question_sets question_set
      join public.learning_question_set_items item on item.question_set_id = question_set.id
      join public.learning_question_bank bank on bank.id = item.question_bank_id
      where question_set.canonical_skill_id = skill_row.id and question_set.scope = 'GLOBAL'
        and question_set.version = content_version and question_set.active), ''), 'UTF8'), 'sha256'), 'hex');
  status_value := case when jsonb_array_length(errors) = 0 then 'READY' else 'VALIDATION_FAILED' end;
  perform private.record_guided_content_validation_v12(
    'BNCC_SKILL', skill_row.id::text, coalesce(skill_metadata->>'content_version', 'BNCC_2018'),
    fingerprint, status_value, errors,
    jsonb_build_object('official_code', skill_code, 'grade_target', exists (
      select 1 from public.learning_curriculum_grade_targets target
       where target.canonical_skill_id = skill_row.id and target.active),
      'content_version', content_version, 'lesson_available', lesson_row.id is not null, 'question_count', question_count,
      'valid_question_count', valid_question_count, 'purpose_count', purpose_count,
      'duplicate_stems', greatest(question_count - distinct_question_count, 0))
  );
  return jsonb_build_object('status', status_value, 'errors', errors, 'fingerprint', fingerprint,
    'question_count', question_count, 'purpose_count', purpose_count);
end;
$$;
revoke all on function private.validate_mapped_bncc_skill_v12(uuid, text, jsonb) from public, anon, authenticated;

create or replace function private.enforce_bncc_high_school_v4_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare validation jsonb;
begin
  if coalesce(new.metadata->>'content_pack', '') = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4' then
    validation := private.validate_bncc_high_school_skill_v12(new.id, new.code, new.metadata);
    new.technical_validation_status := validation->>'status';
    new.technical_validation_errors := coalesce(validation->'errors', '[]'::jsonb);
    new.technical_validated_at := now();
    new.technical_validator_version := 'TECESCOLA_GUIDED_STUDY_V12';
    if validation->>'status' = 'READY' and new.publication_status <> 'QA_ONLY'
       and coalesce(new.metadata->>'qa_only', 'false') <> 'true' then
      new.publication_status := 'PUBLISHED';
      new.bncc_alignment_status := 'MAPPED';
      new.content_readiness := 'ADAPTIVE_READY';
      new.mastery_targetable := true;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', 'PUBLISHED', 'publication_gate', 'AUTOMATIC_TECHNICAL_VALIDATION',
        'technical_validation_status', 'PUBLISHED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
      );
    elsif validation->>'status' = 'READY' then
      new.publication_status := 'QA_ONLY';
      new.mastery_targetable := false;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', 'QA_ONLY', 'publication_gate', 'TECHNICALLY_READY_QA_ONLY',
        'technical_validation_status', 'READY', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
      );
    elsif new.publication_status = 'PUBLISHED' then
      new.publication_status := 'STAGING';
      new.bncc_alignment_status := 'CANDIDATE';
      new.content_readiness := 'CONTENT_READY';
      new.mastery_targetable := false;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', 'STAGING', 'publication_gate', 'TECHNICAL_VALIDATION_FAILED',
        'technical_validation_status', validation->>'status'
      );
    else
      if new.publication_status <> 'QA_ONLY' then new.publication_status := 'STAGING'; end if;
      new.bncc_alignment_status := 'CANDIDATE';
      new.content_readiness := 'CONTENT_READY';
      new.mastery_targetable := false;
      new.technical_validation_status := validation->>'status';
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', new.publication_status, 'publication_gate', 'TECHNICAL_VALIDATION_FAILED',
        'technical_validation_status', validation->>'status'
      );
    end if;
  elsif coalesce(new.metadata->>'content_pack', '') = 'central-estudos-v2' then
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'publication_status', new.publication_status,
      'publication_gate', 'AUTOMATIC_TECHNICAL_VALIDATION',
      'technical_validation_status', new.technical_validation_status,
      'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
    );
  elsif exists (
    select 1 from public.learning_curriculum_catalogs catalog
     where catalog.id = new.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
  ) then
    validation := private.validate_mapped_bncc_skill_v12(new.id, new.code, new.metadata);
    new.technical_validation_status := validation->>'status';
    new.technical_validation_errors := coalesce(validation->'errors', '[]'::jsonb);
    new.technical_validated_at := now();
    new.technical_validator_version := 'TECESCOLA_GUIDED_STUDY_V12';
    if validation->>'status' = 'READY' and new.publication_status <> 'QA_ONLY'
       and coalesce(new.metadata->>'qa_only', 'false') <> 'true' then
      new.publication_status := 'PUBLISHED';
      new.bncc_alignment_status := 'MAPPED';
      new.content_readiness := 'ADAPTIVE_READY';
      new.mastery_targetable := true;
      new.technical_validation_status := 'PUBLISHED';
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', 'PUBLISHED', 'publication_gate', 'AUTOMATIC_TECHNICAL_VALIDATION',
        'technical_validation_status', 'PUBLISHED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
      );
    elsif validation->>'status' = 'READY' then
      new.publication_status := 'QA_ONLY';
      new.mastery_targetable := false;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', 'QA_ONLY', 'publication_gate', 'TECHNICALLY_READY_QA_ONLY',
        'technical_validation_status', 'READY', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
      );
    else
      if new.publication_status <> 'QA_ONLY' then new.publication_status := 'STAGING'; end if;
      new.bncc_alignment_status := case when validation->'errors' ? 'OFFICIAL_BNCC_MAPPING_NOT_VERIFIABLE'
        then 'CANDIDATE' else new.bncc_alignment_status end;
      new.content_readiness := 'CONTENT_READY';
      new.mastery_targetable := false;
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
        'publication_status', new.publication_status, 'publication_gate', 'TECHNICAL_VALIDATION_FAILED',
        'technical_validation_status', 'VALIDATION_FAILED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
      );
    end if;
  else
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'publication_status', new.publication_status,
      'publication_gate', 'NOT_APPLICABLE_TO_THIS_CONTENT_PACK'
    );
  end if;
  return new;
end;
$$;

create or replace function private.revalidate_bncc_v4_skill_after_content_change_v12()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  skill_ids uuid[] := '{}'::uuid[];
  affected_id uuid;
  related_id uuid;
  skill_row public.learning_curriculum_skills%rowtype;
  validation jsonb;
begin
  if tg_table_name = 'learning_curriculum_skills' then
    if tg_op <> 'INSERT' then skill_ids := array_append(skill_ids, old.id); end if;
    if tg_op <> 'DELETE' then skill_ids := array_append(skill_ids, new.id); end if;
  elsif tg_table_name = 'learning_skill_lessons' then
    if tg_op <> 'INSERT' then skill_ids := array_append(skill_ids, old.canonical_skill_id); end if;
    if tg_op <> 'DELETE' then skill_ids := array_append(skill_ids, new.canonical_skill_id); end if;
  elsif tg_table_name = 'learning_question_sets' then
    if tg_op <> 'INSERT' then skill_ids := array_append(skill_ids, old.canonical_skill_id); end if;
    if tg_op <> 'DELETE' then skill_ids := array_append(skill_ids, new.canonical_skill_id); end if;
  elsif tg_table_name = 'learning_question_set_items' then
    if tg_op <> 'INSERT' then
      select question_set.canonical_skill_id into related_id
        from public.learning_question_sets question_set where question_set.id = old.question_set_id;
      skill_ids := array_append(skill_ids, related_id);
    end if;
    if tg_op <> 'DELETE' then
      select question_set.canonical_skill_id into related_id
        from public.learning_question_sets question_set where question_set.id = new.question_set_id;
      skill_ids := array_append(skill_ids, related_id);
    end if;
  elsif tg_table_name = 'learning_question_bank_skill_links' then
    if tg_op <> 'INSERT' then skill_ids := array_append(skill_ids, old.canonical_skill_id); end if;
    if tg_op <> 'DELETE' then skill_ids := array_append(skill_ids, new.canonical_skill_id); end if;
  elsif tg_table_name = 'learning_question_bank' then
    if tg_op <> 'INSERT' then
      skill_ids := skill_ids || coalesce((select array_agg(link.canonical_skill_id)
        from public.learning_question_bank_skill_links link where link.question_bank_id = old.id), '{}'::uuid[]);
    end if;
    if tg_op <> 'DELETE' then
      skill_ids := skill_ids || coalesce((select array_agg(link.canonical_skill_id)
        from public.learning_question_bank_skill_links link where link.question_bank_id = new.id), '{}'::uuid[]);
    end if;
  end if;
  select coalesce(array_agg(distinct ids.id), '{}'::uuid[]) into skill_ids
    from unnest(skill_ids) as ids(id) where ids.id is not null;
  foreach affected_id in array skill_ids loop
    select skill.* into skill_row from public.learning_curriculum_skills skill
      join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
       and catalog.active and catalog.code = 'BNCC_2018'
     where skill.id = affected_id and skill.node_kind = 'LEAF';
    if not found then continue; end if;
    if not skill_row.active then
      update public.learning_curriculum_skills
         set publication_status = case when publication_status = 'QA_ONLY' then 'QA_ONLY' else 'STAGING' end,
             mastery_targetable = false, technical_validation_status = 'DISABLED',
             technical_validation_errors = '[]'::jsonb, technical_validated_at = now(),
             technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'publication_status', case when publication_status = 'QA_ONLY' then 'QA_ONLY' else 'STAGING' end,
               'publication_gate', 'CONTENT_DISABLED', 'technical_validation_status', 'DISABLED'
             ), updated_at = now()
       where id = skill_row.id and (publication_status = 'PUBLISHED' or mastery_targetable
          or technical_validation_status is distinct from 'DISABLED');
      continue;
    end if;
    if skill_row.metadata->>'content_pack' = 'central-estudos-v2'
       and skill_row.metadata->>'central_studies_v2_candidate_id' is not null then
      continue;
    end if;
    if skill_row.metadata->>'content_pack' = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4' then
      validation := private.validate_bncc_high_school_skill_v12(skill_row.id, skill_row.code, skill_row.metadata);
    else
      validation := private.validate_mapped_bncc_skill_v12(skill_row.id);
    end if;
    if validation->>'status' = 'READY' then
      if skill_row.publication_status = 'QA_ONLY'
         or coalesce(skill_row.metadata->>'qa_only', 'false') = 'true' then
        update public.learning_curriculum_skills
           set technical_validation_status = 'READY', technical_validation_errors = '[]'::jsonb,
               technical_validated_at = now(), technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                 'publication_status', 'QA_ONLY', 'publication_gate', 'TECHNICALLY_READY_QA_ONLY',
                 'technical_validation_status', 'READY', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
               ), updated_at = now()
         where id = skill_row.id and (technical_validation_status is distinct from 'READY'
            or technical_validation_errors is distinct from '[]'::jsonb);
        continue;
      end if;
      update public.learning_curriculum_skills
         set publication_status = 'PUBLISHED', bncc_alignment_status = 'MAPPED',
             content_readiness = 'ADAPTIVE_READY', mastery_targetable = true,
             technical_validation_status = 'PUBLISHED', technical_validation_errors = '[]'::jsonb,
             technical_validated_at = now(), technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'publication_status', 'PUBLISHED', 'publication_gate', 'AUTOMATIC_TECHNICAL_VALIDATION',
               'technical_validation_status', 'PUBLISHED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
             ), updated_at = now()
       where id = skill_row.id and (
         publication_status is distinct from 'PUBLISHED' or bncc_alignment_status is distinct from 'MAPPED'
         or content_readiness is distinct from 'ADAPTIVE_READY' or not mastery_targetable
         or technical_validation_status is distinct from 'PUBLISHED'
       );
      perform private.record_guided_content_validation_v12(
        'BNCC_SKILL', skill_row.id::text,
        coalesce(skill_row.metadata->>'content_version', 'BNCC_2018'),
        validation->>'fingerprint', 'PUBLISHED', '[]'::jsonb,
        coalesce((select checks from private.guided_content_validation_runs_v12 run
          where run.source_type = 'BNCC_SKILL' and run.source_id = skill_row.id::text
            and run.fingerprint = validation->>'fingerprint'
          order by run.validated_at desc limit 1), '{}'::jsonb) || jsonb_build_object('publication', 'AUTOMATIC')
      );
    else
      update public.learning_curriculum_skills
         set publication_status = case when publication_status = 'QA_ONLY' then 'QA_ONLY' else 'STAGING' end,
             bncc_alignment_status = case when validation->'errors' ? 'OFFICIAL_BNCC_MAPPING_NOT_VERIFIABLE'
               then 'CANDIDATE' else bncc_alignment_status end,
             content_readiness = 'CONTENT_READY', mastery_targetable = false,
             technical_validation_status = 'VALIDATION_FAILED',
             technical_validation_errors = validation->'errors', technical_validated_at = now(),
             technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'publication_status', case when publication_status = 'QA_ONLY' then 'QA_ONLY' else 'STAGING' end,
               'publication_gate', 'TECHNICAL_VALIDATION_FAILED', 'technical_validation_status', 'VALIDATION_FAILED'
             ), updated_at = now()
       where id = skill_row.id and (
         publication_status = 'PUBLISHED' or bncc_alignment_status = 'MAPPED'
         or content_readiness = 'ADAPTIVE_READY' or mastery_targetable
         or technical_validation_status is distinct from 'VALIDATION_FAILED'
         or technical_validation_errors is distinct from validation->'errors'
       );
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.revalidate_bncc_v4_skill_after_content_change_v12() from public, anon, authenticated;

-- Skill-row changes are validated by the BEFORE publication trigger. Revalidating
-- the same row after it updates publication fields would recursively update it.
create constraint trigger guided_v12_bncc_lesson_revalidate
after insert or update or delete on public.learning_skill_lessons
deferrable initially deferred for each row
execute function private.revalidate_bncc_v4_skill_after_content_change_v12();
create constraint trigger guided_v12_bncc_set_revalidate
after insert or update or delete on public.learning_question_sets
deferrable initially deferred for each row
execute function private.revalidate_bncc_v4_skill_after_content_change_v12();
create constraint trigger guided_v12_bncc_item_revalidate
after insert or update or delete on public.learning_question_set_items
deferrable initially deferred for each row
execute function private.revalidate_bncc_v4_skill_after_content_change_v12();
create constraint trigger guided_v12_bncc_bank_link_revalidate
after insert or update or delete on public.learning_question_bank_skill_links
deferrable initially deferred for each row
execute function private.revalidate_bncc_v4_skill_after_content_change_v12();
create constraint trigger guided_v12_bncc_bank_revalidate
after insert or update or delete on public.learning_question_bank
deferrable initially deferred for each row
execute function private.revalidate_bncc_v4_skill_after_content_change_v12();

create or replace function private.validate_adaptive_content_pack_v12(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pack public.learning_adaptive_content_packs%rowtype;
  errors jsonb := '[]'::jsonb;
  fingerprint text;
  status_value text;
  publication_value text;
  publication_gate text;
begin
  select * into pack from public.learning_adaptive_content_packs row where row.id = p_pack_id;
  if not found then return jsonb_build_object('status', 'VALIDATION_FAILED', 'errors', jsonb_build_array('PACK_NOT_FOUND')); end if;
  if coalesce(pack.manifest->>'valid', 'false') <> 'true'
     or pack.manifest->>'canonicalHash' is distinct from pack.canonical_hash
     or pack.canonical_hash !~ '^[0-9a-f]{64}$'
     or private.guided_json_array_length_v12(pack.manifest->'errors') <> 0 then
    errors := errors || jsonb_build_array('MANIFEST_INTEGRITY_FAILED');
  end if;
  if (case when coalesce(pack.manifest->>'genericTemplateQuestions', '') ~ '^[0-9]+$'
       then (pack.manifest->>'genericTemplateQuestions')::integer else 1 end) <> 0
     or (case when coalesce(pack.manifest->>'genericTemplateLessons', '') ~ '^[0-9]+$'
       then (pack.manifest->>'genericTemplateLessons')::integer else 1 end) <> 0
     or (case when coalesce(pack.manifest->>'genericTemplateFamilies', '') ~ '^[0-9]+$'
       then (pack.manifest->>'genericTemplateFamilies')::integer else 1 end) <> 0
     or private.guided_json_array_length_v12(pack.manifest->'duplicateSemanticSkills') <> 0
     or private.guided_json_array_length_v12(pack.manifest->'unknownPrerequisites') <> 0
     or private.guided_json_array_length_v12(pack.manifest->'prerequisiteCycles') <> 0
     or private.guided_json_array_length_v12(pack.manifest->'nearDuplicateStems') <> 0 then
    errors := errors || jsonb_build_array('CONTENT_QUALITY_INTEGRITY_CHECK_FAILED');
  end if;
  if pack.manifest->>'packVersion' is distinct from pack.pack_version
     or coalesce(pack.manifest->>'demo_preview', 'false') = 'true'
     or coalesce(pack.manifest->>'demo_preview_only', 'false') = 'true'
     or coalesce(pack.manifest->>'demonstration_only', 'false') = 'true'
     or coalesce(pack.manifest->>'is_test_fixture', 'false') = 'true'
     or coalesce(pack.manifest->>'test_fixture', 'false') = 'true' then
    errors := errors || jsonb_build_array('DEMONSTRATION_OR_TEST_PACK');
  end if;
  fingerprint := pack.canonical_hash;
  status_value := case
    when not pack.active then 'DISABLED'
    when jsonb_array_length(errors) > 0 then 'VALIDATION_FAILED'
    when pack.publication_status = 'QA_ONLY'
      or coalesce(pack.manifest->>'qa_only', 'false') = 'true' then 'READY'
    else 'PUBLISHED'
  end;
  publication_value := case
    when not pack.active then case when pack.publication_status = 'QA_ONLY' then 'QA_ONLY' else 'STAGING' end
    when pack.publication_status = 'QA_ONLY'
      or coalesce(pack.manifest->>'qa_only', 'false') = 'true' then 'QA_ONLY'
    when status_value = 'PUBLISHED' then 'PUBLISHED'
    else 'STAGING'
  end;
  publication_gate := case status_value
    when 'PUBLISHED' then 'AUTOMATIC_TECHNICAL_VALIDATION'
    when 'READY' then 'TECHNICALLY_READY_QA_ONLY'
    when 'DISABLED' then 'CONTENT_DISABLED'
    else 'TECHNICAL_VALIDATION_FAILED'
  end;
  perform private.record_guided_content_validation_v12(
    'ADAPTIVE_CONTENT_PACK', pack.id::text, pack.pack_version, fingerprint, status_value, errors,
    jsonb_build_object('manifest_valid', coalesce(pack.manifest->>'valid', 'false') = 'true',
      'skill_count', pack.manifest->>'skillCount', 'lesson_count', pack.manifest->>'lessonCount',
      'question_count', pack.manifest->>'questionCount', 'generic_templates', false,
      'human_review_status_preserved', pack.pedagogical_review_status)
  );
  update public.learning_adaptive_content_packs
     set publication_status = publication_value,
         manifest = coalesce(manifest, '{}'::jsonb) || jsonb_build_object(
           'publication_status', publication_value, 'publication_gate', publication_gate,
           'technical_validation_status', status_value, 'technical_validation_errors', errors,
           'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
         ),
         technical_validation_status = status_value, technical_validation_errors = errors,
         technical_validated_at = now(), technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12',
         updated_at = now()
   where id = pack.id and (technical_validation_status is distinct from status_value
      or technical_validation_errors is distinct from errors
      or technical_validator_version is distinct from 'TECESCOLA_GUIDED_STUDY_V12'
      or publication_status is distinct from publication_value
      or manifest->>'publication_gate' is distinct from publication_gate
      or manifest->>'technical_validation_status' is distinct from status_value);
  return jsonb_build_object('status', status_value, 'errors', errors, 'fingerprint', fingerprint);
end;
$$;
revoke all on function private.validate_adaptive_content_pack_v12(uuid) from public, anon, authenticated;

create or replace function private.validate_adaptive_content_pack_after_change_v12()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_adaptive_content_pack_v12(new.id);
  return new;
end;
$$;
revoke all on function private.validate_adaptive_content_pack_after_change_v12() from public, anon, authenticated;
drop trigger if exists adaptive_content_pack_v12_automatic_validation on public.learning_adaptive_content_packs;
create trigger adaptive_content_pack_v12_automatic_validation
after insert or update of canonical_hash, manifest, active, publication_status on public.learning_adaptive_content_packs
for each row execute function private.validate_adaptive_content_pack_after_change_v12();

create or replace function private.integrate_central_studies_v2_candidate_v12(
  p_candidate_id uuid, p_expected_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.learning_central_studies_v2_candidates%rowtype;
  validation jsonb;
  canonical_subject_id uuid;
  official_skill_id uuid;
  execution_skill_id uuid;
  journey_id uuid;
  lesson_id uuid;
  question_set_id uuid;
  bank_id uuid;
  question jsonb;
  purpose text;
  markdown text;
  written integer := 0;
  purpose_position integer;
  existing_runtime public.learning_central_studies_v2_runtime%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 12026));
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.id = p_candidate_id for update;
  if not found then return jsonb_build_object('integrated', false, 'status', 'VALIDATION_FAILED', 'errors', jsonb_build_array('CANDIDATE_NOT_FOUND')); end if;
  if p_expected_fingerprint is not null and candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001';
  end if;
  if candidate.publication_status = 'UNPUBLISHED' then
    update public.learning_central_studies_v2_candidates
       set technical_validation_status = 'DISABLED', updated_at = now() where id = candidate.id;
    return jsonb_build_object('integrated', false, 'status', 'DISABLED', 'errors', '[]'::jsonb);
  end if;
  validation := private.validate_central_studies_v2_candidate_v12(candidate.id);
  if validation->>'status' <> 'READY' then
    update public.learning_central_studies_v2_candidates
       set technical_validation_status = 'VALIDATION_FAILED', publication_status = 'STAGING', updated_at = now()
     where id = candidate.id;
    return jsonb_build_object('integrated', false, 'status', 'VALIDATION_FAILED', 'errors', validation->'errors',
      'journey_code', candidate.journey_code, 'snapshot_fingerprint', candidate.snapshot_fingerprint);
  end if;

  select * into existing_runtime from public.learning_central_studies_v2_runtime runtime
   where runtime.candidate_id = candidate.id;
  if found then
    if existing_runtime.snapshot_fingerprint is distinct from candidate.snapshot_fingerprint then
      raise exception 'CENTRAL_STUDIES_V2_RUNTIME_FINGERPRINT_MISMATCH';
    end if;
    update public.learning_central_studies_v2_candidates
       set publication_status = 'PUBLISHED', technical_validation_status = 'PUBLISHED', updated_at = now()
     where id = candidate.id and publication_status is distinct from 'PUBLISHED';
    perform private.record_guided_content_validation_v12(
      'CENTRAL_STUDIES_V2', candidate.id::text, candidate.content_version,
      candidate.snapshot_fingerprint, 'PUBLISHED', '[]'::jsonb,
      jsonb_build_object('idempotent_reuse', true, 'journey_id', existing_runtime.journey_id)
    );
    return jsonb_build_object('integrated', true, 'status', 'PUBLISHED', 'journey_id', existing_runtime.journey_id,
      'snapshot_fingerprint', candidate.snapshot_fingerprint, 'idempotent', true);
  end if;

  select canonical.id into canonical_subject_id from public.learning_canonical_subjects canonical
   where canonical.code = candidate.subject_area and canonical.active;
  select skill.id into official_skill_id from public.learning_curriculum_skills skill
   join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id
     and catalog.code = 'BNCC_2018' and catalog.active
   where skill.active and skill.grade_level = candidate.grade_level
     and (skill.code = candidate.official_skill_code or skill.metadata->>'official_code' = candidate.official_skill_code)
   order by (skill.code = candidate.official_skill_code) desc, skill.id limit 1;
  if canonical_subject_id is null or official_skill_id is null then
    raise exception 'CENTRAL_STUDIES_V2_OFFICIAL_MAPPING_CHANGED';
  end if;

  insert into public.learning_curriculum_skills(
    catalog_id, code, stage, grade_level, subject_area, domain, title, description, active,
    canonical_subject_id, node_kind, content_readiness, mastery_targetable,
    pedagogical_review_status, bncc_alignment_status, publication_status,
    technical_validation_status, technical_validation_errors, technical_validated_at, technical_validator_version, metadata
  ) select catalog.id, candidate.journey_code, 'FUNDAMENTAL_II', candidate.grade_level,
      candidate.subject_area, candidate.payload->>'unitCode', candidate.payload->>'journeyTitle',
      candidate.payload->>'officialText', true, canonical_subject_id, 'LEAF', 'ADAPTIVE_READY', true,
      'PEDAGOGICAL_REVIEW_PENDING', 'MAPPED', 'PUBLISHED', 'PUBLISHED', '[]'::jsonb, now(),
      'TECESCOLA_GUIDED_STUDY_V12', jsonb_build_object(
        'content_pack', 'central-estudos-v2', 'central_studies_v2_candidate_id', candidate.id,
        'candidate_skill_code', candidate.payload->>'skill', 'official_code', candidate.official_skill_code,
        'content_version', candidate.content_version, 'snapshot_fingerprint', candidate.snapshot_fingerprint,
        'publication_gate', 'AUTOMATIC_TECHNICAL_VALIDATION', 'technical_validation_status', 'PUBLISHED',
        'pedagogical_review_status', 'PENDING', 'demonstration_only', false
      )
    from public.learning_curriculum_catalogs catalog
   where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and catalog.active
  returning id into execution_skill_id;
  if execution_skill_id is null then raise exception 'CENTRAL_STUDIES_V2_EXECUTION_CATALOG_MISSING'; end if;

  insert into public.learning_bncc_discipline_journeys(
    journey_code, canonical_subject_id, execution_skill_id, unit_code, unit_title, title,
    suggested_stage, suggested_grade, publication_status, mapping_status,
    pedagogical_review_status, content_version, metadata
  ) values (
    candidate.journey_code, canonical_subject_id, execution_skill_id,
    candidate.payload->>'unitCode', candidate.payload->>'unitTitle', candidate.payload->>'journeyTitle',
    'ENSINO_FUNDAMENTAL', candidate.grade_level, 'PUBLISHED', 'MAPPED', 'PEDAGOGICAL_REVIEW_PENDING',
    candidate.content_version, jsonb_build_object(
      'source_pack', 'central-estudos-v2', 'candidate_id', candidate.id,
      'snapshot_fingerprint', candidate.snapshot_fingerprint, 'mapping_status', 'MAPPED',
      'mapping_method', 'EXACT_OFFICIAL_BNCC_CODE', 'technical_validation_status', 'PUBLISHED',
      'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12',
      'pedagogical_review_status', 'PENDING', 'demonstration_only', false
    )
  ) returning id into journey_id;

  insert into public.learning_bncc_discipline_journey_skills(
    journey_id, official_skill_id, relation_type, mapping_status, mapping_reason,
    source_document, source_section, metadata
  ) values (
    journey_id, official_skill_id, 'PRIMARY', 'MAPPED',
    'Código de habilidade igual ao registro ativo do catálogo BNCC_EI_EF_2018; validação técnica V12. Isso não é parecer pedagógico humano.',
    'BNCC_EI_EF_2018', candidate.official_skill_code,
    jsonb_build_object('candidate_id', candidate.id, 'snapshot_fingerprint', candidate.snapshot_fingerprint,
      'mapping_method', 'EXACT_OFFICIAL_BNCC_CODE', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12')
  );

  select pg_catalog.concat(
    '# ', candidate.payload#>>'{lesson,title}', E'\n\n## Introdução\n', candidate.payload#>>'{lesson,introduction}',
    E'\n\n## Explicação\n', candidate.payload#>>'{lesson,explanation}',
    E'\n\n## Exemplo guiado\n', candidate.payload#>>'{lesson,workedExample,prompt}', E'\n',
    coalesce((select string_agg('- ' || value, E'\n' order by ordinality)
      from jsonb_array_elements_text(candidate.payload#>'{lesson,workedExample,steps}') with ordinality step(value, ordinality)), ''),
    E'\n\n**Resposta:** ', candidate.payload#>>'{lesson,workedExample,answer}',
    E'\n\n## Prática acompanhada\n',
    coalesce((select string_agg('- ' || (item->>'prompt') || E'\n  Apoio: ' || (item->>'scaffold'), E'\n')
      from jsonb_array_elements(candidate.payload#>'{lesson,guidedPractice}') item), ''),
    E'\n\n## Aplicação\n',
    coalesce((select string_agg('- **' || (item->>'context') || ':** ' || (item->>'prompt'), E'\n')
      from jsonb_array_elements(candidate.payload#>'{lesson,application}') item), ''),
    E'\n\n## Revisão\n',
    coalesce((select string_agg('- ' || value, E'\n' order by ordinality)
      from jsonb_array_elements_text(candidate.payload#>'{lesson,review}') with ordinality item(value, ordinality)), '')
  ) into markdown;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown, worked_example, tips,
    estimated_minutes, active, metadata
  ) values (
    execution_skill_id, 4, candidate.payload#>>'{lesson,title}', candidate.payload#>>'{lesson,introduction}',
    markdown, candidate.payload#>>'{lesson,workedExample,prompt}',
    array(select jsonb_array_elements_text(candidate.payload#>'{lesson,review}')),
    greatest(1, least(120, coalesce((candidate.payload#>>'{lesson,estimatedMinutes}')::integer, 15))), true,
    jsonb_build_object('central_studies_v2_candidate_id', candidate.id,
      'central_studies_v2_fingerprint', candidate.snapshot_fingerprint, 'content_version', candidate.content_version,
      'source_lesson', candidate.payload->'lesson', 'demo_preview_only', false,
      'technical_validation_status', 'PUBLISHED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12')
  ) returning id into lesson_id;

  foreach purpose in array array['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'] loop
    purpose_position := 0;
    insert into public.learning_question_sets(canonical_skill_id, scope, purpose, version, difficulty, active, metadata)
    values (execution_skill_id, 'GLOBAL', purpose, 4, null, true,
      jsonb_build_object('central_studies_v2_candidate_id', candidate.id,
        'central_studies_v2_fingerprint', candidate.snapshot_fingerprint, 'content_version', candidate.content_version,
        'demo_preview_only', false, 'technical_validation_status', 'PUBLISHED'))
    returning id into question_set_id;
    for question in select value from jsonb_array_elements(candidate.payload->'questions')
                     where value->>'purpose' = purpose order by value->>'id'
    loop
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty, estimated_minutes,
        provenance, metadata, active
      ) values (
        'TECESCOLA', 'CENTRAL_STUDIES_V2', candidate.payload->>'journeyTitle',
        candidate.subject_area, candidate.payload->>'unitCode', candidate.official_skill_code,
        question->>'statement', question->'options', to_jsonb(question->>'correctAnswer'),
        question->>'explanation', question->>'difficulty', 2, 'CENTRAL_STUDIES_V2_AUTOMATIC_TECHNICAL_VALIDATION',
        question || jsonb_build_object(
          'central_studies_v2_candidate_id', candidate.id,
          'central_studies_v2_fingerprint', candidate.snapshot_fingerprint,
          'content_version', candidate.content_version,
          'misconception_code', question->>'misconception', 'demo_preview_only', false,
          'technical_validation_status', 'PUBLISHED', 'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12'
        ), true
      ) returning id into bank_id;
      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
        values (bank_id, execution_skill_id, 'PRIMARY');
      insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
        values (question_set_id, bank_id, purpose_position);
      purpose_position := purpose_position + 1;
      written := written + 1;
    end loop;
  end loop;
  if written <> jsonb_array_length(candidate.payload->'questions') then
    raise exception 'CENTRAL_STUDIES_V2_QUESTION_CONVERSION_MISMATCH';
  end if;

  insert into public.learning_central_studies_v2_runtime(
    candidate_id, snapshot_fingerprint, canonical_skill_id, canonical_subject_id,
    official_skill_id, journey_id, lesson_id, integrated_by
  ) values (candidate.id, candidate.snapshot_fingerprint, execution_skill_id, canonical_subject_id,
    official_skill_id, journey_id, lesson_id, null);

  insert into public.learning_central_studies_v2_institution_targets(
    candidate_id, institution_id, subject_id, enabled, changed_by, changed_at, change_reason
  )
  select candidate.id, selected.institution_id, selected.subject_id, true, null, now(),
         'Habilitação automática por vínculo institucional ativo e mapeamento curricular exato; V12.'
    from (
      select distinct on (subject.institution_id) subject.institution_id, subject.id as subject_id
        from public.subjects subject
        join public.learning_curriculum_subject_links subject_link
          on subject_link.institution_id = subject.institution_id
         and subject_link.subject_id = subject.id and subject_link.active
         and subject_link.subject_area = candidate.subject_area
       where subject.active
       order by subject.institution_id, subject.id
    ) selected
  on conflict (candidate_id, institution_id) do update
    set subject_id = excluded.subject_id, enabled = true, changed_by = null,
        changed_at = now(), change_reason = excluded.change_reason;

  update public.learning_central_studies_v2_candidates
     set publication_status = 'PUBLISHED', technical_validation_status = 'PUBLISHED',
         technical_validation_errors = '[]'::jsonb, technical_validated_at = now(),
         technical_validator_version = 'TECESCOLA_GUIDED_STUDY_V12', updated_at = now()
   where id = candidate.id;
  perform private.record_guided_content_validation_v12(
    'CENTRAL_STUDIES_V2', candidate.id::text, candidate.content_version,
    candidate.snapshot_fingerprint, 'PUBLISHED', '[]'::jsonb,
    jsonb_build_object('journey_id', journey_id, 'lesson_id', lesson_id,
      'question_count', written, 'execution_skill_id', execution_skill_id,
      'official_skill_id', official_skill_id,
      'enabled_institution_count', (select count(*) from public.learning_central_studies_v2_institution_targets target
                                    where target.candidate_id = candidate.id and target.enabled))
  );
  return jsonb_build_object('integrated', true, 'status', 'PUBLISHED', 'journey_id', journey_id,
    'lesson_id', lesson_id, 'question_count', written, 'mapping_status', 'MAPPED',
    'snapshot_fingerprint', candidate.snapshot_fingerprint, 'idempotent', false);
end;
$$;
revoke all on function private.integrate_central_studies_v2_candidate_v12(uuid, text) from public, anon, authenticated;

create or replace function private.integrate_central_studies_v2_candidate_after_insert_v12()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.integrate_central_studies_v2_candidate_v12(new.id, new.snapshot_fingerprint);
  return new;
end;
$$;
revoke all on function private.integrate_central_studies_v2_candidate_after_insert_v12() from public, anon, authenticated;
drop trigger if exists central_studies_v2_automatic_validation_v12 on public.learning_central_studies_v2_candidates;
create trigger central_studies_v2_automatic_validation_v12
after insert on public.learning_central_studies_v2_candidates
for each row execute function private.integrate_central_studies_v2_candidate_after_insert_v12();
grant insert on public.learning_central_studies_v2_candidates to service_role;

create or replace function private.central_studies_v2_student_can_read(p_candidate_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_super_admin() or exists (
    select 1
      from public.learning_central_studies_v2_candidates candidate
      join public.learning_central_studies_v2_runtime runtime
        on runtime.candidate_id = candidate.id and runtime.snapshot_fingerprint = candidate.snapshot_fingerprint
      join public.learning_central_studies_v2_institution_targets target
        on target.candidate_id = candidate.id and target.enabled
      join public.subjects subject on subject.id = target.subject_id
       and subject.institution_id = target.institution_id and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id
       and subject_link.subject_id = target.subject_id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
      join public.students student on student.institution_id = target.institution_id
       and student.profile_id = auth.uid()
      join public.enrollments enrollment on enrollment.student_id = student.id
       and enrollment.active and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = target.institution_id and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where candidate.id::text = p_candidate_id
       and candidate.publication_status = 'PUBLISHED'
       and candidate.technical_validation_status = 'PUBLISHED'
       and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
       and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
       and nullif(normalized.value->>'grade_level', '')::smallint = candidate.grade_level
  );
$$;
revoke all on function private.central_studies_v2_student_can_read(text) from public, anon;
grant execute on function private.central_studies_v2_student_can_read(text) to authenticated;

create or replace function private.central_studies_v2_journey_allowed(
  p_institution_id uuid, p_student_id uuid, p_journey_id uuid, p_execution_skill_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.learning_v2_scope_student(p_institution_id, p_student_id) and exists (
    select 1
      from public.learning_central_studies_v2_runtime runtime
      join public.learning_central_studies_v2_candidates candidate
        on candidate.id = runtime.candidate_id and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
      join public.learning_central_studies_v2_institution_targets target
        on target.candidate_id = candidate.id and target.institution_id = p_institution_id and target.enabled
      join public.subjects subject on subject.id = target.subject_id
       and subject.institution_id = target.institution_id and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id and subject_link.subject_id = target.subject_id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
      join public.learning_bncc_discipline_journeys journey
        on journey.id = runtime.journey_id and journey.active
       and journey.publication_status = 'PUBLISHED' and journey.mapping_status = 'MAPPED'
      join public.learning_curriculum_skills execution_skill
        on execution_skill.id = runtime.canonical_skill_id and execution_skill.active
       and execution_skill.node_kind = 'LEAF' and execution_skill.content_readiness = 'ADAPTIVE_READY'
       and execution_skill.mastery_targetable and execution_skill.publication_status = 'PUBLISHED'
       and execution_skill.technical_validation_status = 'PUBLISHED'
      join public.students student on student.id = p_student_id and student.institution_id = p_institution_id
      join public.enrollments enrollment on enrollment.student_id = student.id
       and enrollment.active and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class on class.id = enrollment.class_id
       and class.institution_id = p_institution_id and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where runtime.journey_id = p_journey_id
       and (p_execution_skill_id is null or runtime.canonical_skill_id = p_execution_skill_id)
       and candidate.publication_status = 'PUBLISHED'
       and candidate.technical_validation_status = 'PUBLISHED'
       and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
       and nullif(normalized.value->>'grade_level', '')::smallint = candidate.grade_level
  );
$$;
revoke all on function private.central_studies_v2_journey_allowed(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.central_studies_v2_journey_allowed(uuid, uuid, uuid, uuid) to authenticated;

create or replace function private.assert_bncc_discipline_journey_v9(
  p_institution_id uuid, p_student_id uuid, p_journey_id uuid, p_execution_skill_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare journey_row public.learning_bncc_discipline_journeys%rowtype;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V9_DEMO_SCOPE_DENIED';
  end if;
  if private.central_studies_v2_journey_allowed(p_institution_id, p_student_id, p_journey_id, p_execution_skill_id) then
    return;
  end if;
  if exists (select 1 from public.learning_central_studies_v2_runtime runtime where runtime.journey_id = p_journey_id) then
    raise exception 'LEARNING_V9_JOURNEY_NOT_AVAILABLE';
  end if;
  if not private.bncc_demo_preview_allowed(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V9_DEMO_SCOPE_DENIED';
  end if;
  select journey.* into journey_row
    from public.learning_bncc_discipline_journeys journey
    join private.learning_demo_subject_bindings binding
      on binding.institution_id = p_institution_id and binding.canonical_subject_id = journey.canonical_subject_id
   where journey.id = p_journey_id and journey.active
     and journey.publication_status = 'DEMO_PREVIEW'
     and journey.mapping_status = 'MAPPING_PENDING'
     and journey.suggested_stage = 'ENSINO_MEDIO' and journey.suggested_grade = 1
     and (p_execution_skill_id is null or journey.execution_skill_id = p_execution_skill_id)
     and exists (
       select 1 from public.learning_curriculum_skills skill
        where skill.id = journey.execution_skill_id and skill.active
          and skill.node_kind = 'LEAF' and skill.content_readiness = 'ADAPTIVE_READY'
          and skill.mastery_targetable and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
     );
  if not found then raise exception 'LEARNING_V9_JOURNEY_NOT_AVAILABLE'; end if;
  if not exists (
    select 1 from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
      and class.institution_id = p_institution_id and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    where enrollment.student_id = p_student_id and enrollment.active
      and upper(enrollment.status::text) = 'ACTIVE'
      and normalized.value->>'stage' = journey_row.suggested_stage
      and nullif(normalized.value->>'grade_level', '')::smallint = journey_row.suggested_grade
  ) then raise exception 'LEARNING_V9_GRADE_NOT_ELIGIBLE'; end if;
end;
$$;

create or replace function public.list_student_central_studies_v2_journeys_v1(
  p_institution_id uuid, p_student_id uuid
)
returns table(
  journey_id uuid, journey_code text, subject_id uuid, subject_code text, subject_name text,
  canonical_subject_code text, unit_code text, unit_title text, title text, execution_skill_id uuid,
  official_codes text[], official_areas text[], mapping_status text, mapping_reason text,
  learning_role text, availability_status text, question_count integer, missing_purposes text[],
  progress numeric, active_session_id uuid, active_session_status text,
  pedagogical_review_status text, reason text, publication_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select runtime.journey_id, candidate.journey_code, target.subject_id, subject.code, subject.name,
         canonical_subject.code, candidate.payload->>'unitCode', candidate.payload->>'unitTitle',
         candidate.payload->>'journeyTitle', runtime.canonical_skill_id,
         array[candidate.official_skill_code]::text[], array[candidate.subject_area]::text[],
         'MAPPED'::text,
         'Habilidade BNCC vinculada por correspondência exata do código oficial e validada estruturalmente.'::text,
         'CENTRAL_STUDIES_V2'::text, 'AVAILABLE'::text,
         (select count(distinct item.question_bank_id)::integer
            from public.learning_question_sets qs
            join public.learning_question_set_items item on item.question_set_id = qs.id
            join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
           where qs.canonical_skill_id = runtime.canonical_skill_id and qs.version = 4
             and qs.scope = 'GLOBAL' and qs.metadata->>'central_studies_v2_candidate_id' = candidate.id::text),
         array[]::text[], coalesce(state.mastery_estimate, 0), active_session.id, active_session.status,
         'PEDAGOGICAL_REVIEW_PENDING'::text, 'Conteúdo publicado após validação técnica automatizada; revisão pedagógica humana não registrada.'::text,
         candidate.publication_status
    from public.learning_central_studies_v2_runtime runtime
    join public.learning_central_studies_v2_candidates candidate
      on candidate.id = runtime.candidate_id and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
    join public.learning_central_studies_v2_institution_targets target
      on target.candidate_id = candidate.id and target.institution_id = p_institution_id and target.enabled
    join public.subjects subject on subject.id = target.subject_id
      and subject.institution_id = target.institution_id and subject.active
    join public.learning_curriculum_subject_links subject_link
      on subject_link.institution_id = target.institution_id and subject_link.subject_id = target.subject_id
     and subject_link.active and subject_link.subject_area = candidate.subject_area
    join public.learning_canonical_subjects canonical_subject
      on canonical_subject.id = runtime.canonical_subject_id and canonical_subject.active
    join public.learning_bncc_discipline_journeys journey
      on journey.id = runtime.journey_id and journey.active and journey.publication_status = 'PUBLISHED'
     and journey.mapping_status = 'MAPPED'
    join public.students student on student.id = p_student_id and student.institution_id = p_institution_id
    join public.enrollments enrollment on enrollment.student_id = student.id
     and enrollment.active and upper(enrollment.status::text) = 'ACTIVE'
    join public.classes class on class.id = enrollment.class_id
     and class.institution_id = p_institution_id and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id and state.student_id = p_student_id
     and state.canonical_skill_id = runtime.canonical_skill_id
    left join lateral (
      select session.id, session.status from public.learning_guided_sessions session
       where session.institution_id = p_institution_id and session.student_id = p_student_id
         and session.discipline_journey_id = runtime.journey_id
         and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
       order by session.updated_at desc limit 1
    ) active_session on true
   where private.learning_v2_scope_student(p_institution_id, p_student_id)
     and candidate.publication_status = 'PUBLISHED'
     and candidate.technical_validation_status = 'PUBLISHED'
     and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
     and nullif(normalized.value->>'grade_level', '')::smallint = candidate.grade_level
   order by candidate.subject_area, candidate.payload->>'unitCode', candidate.journey_code;
$$;

create or replace function public.integrate_central_studies_v2_candidate_v1(
  p_journey_code text, p_content_version text, p_expected_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare candidate_id uuid; result jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501';
  end if;
  select candidate.id into candidate_id from public.learning_central_studies_v2_candidates candidate
   where candidate.journey_code = p_journey_code and candidate.content_version = p_content_version;
  if candidate_id is null then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  result := private.integrate_central_studies_v2_candidate_v12(candidate_id, p_expected_fingerprint);
  if result->>'status' = 'VALIDATION_FAILED' then
    raise exception 'CENTRAL_STUDIES_V2_AUTOMATIC_VALIDATION_FAILED'
      using detail = coalesce(result->'errors', '[]'::jsonb)::text, errcode = '22023';
  end if;
  return result;
end;
$$;

create or replace function public.publish_central_studies_v2_candidate_v1(
  p_journey_code text, p_content_version text, p_expected_fingerprint text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_candidate_id uuid; result jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501';
  end if;
  select candidate.id into v_candidate_id from public.learning_central_studies_v2_candidates candidate
   where candidate.journey_code = p_journey_code and candidate.content_version = p_content_version;
  if v_candidate_id is null then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  result := private.integrate_central_studies_v2_candidate_v12(v_candidate_id, p_expected_fingerprint);
  if result->>'status' <> 'PUBLISHED' then
    raise exception 'CENTRAL_STUDIES_V2_AUTOMATIC_VALIDATION_FAILED'
      using detail = coalesce(result->'errors', '[]'::jsonb)::text, errcode = '22023';
  end if;
  return jsonb_build_object('publication_status', 'PUBLISHED', 'technical_validation_status', 'PUBLISHED',
    'snapshot_fingerprint', p_expected_fingerprint, 'enabled_institution_count',
    (select count(*) from public.learning_central_studies_v2_institution_targets target
      where target.candidate_id = v_candidate_id and target.enabled));
end;
$$;

create or replace function public.set_central_studies_v2_institution_enabled_v1(
  p_journey_code text, p_content_version text, p_expected_fingerprint text,
  p_institution_id uuid, p_subject_id uuid, p_enabled boolean, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare candidate public.learning_central_studies_v2_candidates%rowtype;
  runtime public.learning_central_studies_v2_runtime%rowtype;
  actor public.profiles%rowtype; actor_name text; action_name text;
begin
  if not public.is_platform_super_admin() then
    raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 1000 then
    raise exception 'CENTRAL_STUDIES_V2_RELEASE_REASON_REQUIRED';
  end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001';
  end if;
  select * into runtime from public.learning_central_studies_v2_runtime row
   where row.candidate_id = candidate.id and row.snapshot_fingerprint = candidate.snapshot_fingerprint;
  if not found or candidate.technical_validation_status <> 'PUBLISHED'
     or candidate.publication_status <> 'PUBLISHED' then
    raise exception 'CENTRAL_STUDIES_V2_AUTOMATIC_VALIDATION_REQUIRED';
  end if;
  if not exists (
    select 1 from public.subjects subject
    join public.learning_curriculum_subject_links subject_link
      on subject_link.institution_id = subject.institution_id and subject_link.subject_id = subject.id
     and subject_link.active and subject_link.subject_area = candidate.subject_area
    where subject.id = p_subject_id and subject.institution_id = p_institution_id and subject.active
  ) then raise exception 'CENTRAL_STUDIES_V2_INSTITUTION_SUBJECT_MAPPING_REQUIRED'; end if;
  insert into public.learning_central_studies_v2_institution_targets(
    candidate_id, institution_id, subject_id, enabled, changed_by, changed_at, change_reason
  ) values (candidate.id, p_institution_id, p_subject_id, p_enabled, auth.uid(), now(), btrim(p_reason))
  on conflict (candidate_id, institution_id) do update set subject_id = excluded.subject_id,
    enabled = excluded.enabled, changed_by = excluded.changed_by,
    changed_at = now(), change_reason = excluded.change_reason;
  select * into actor from public.profiles profile where profile.id = auth.uid();
  actor_name := coalesce(nullif(btrim(actor.full_name), ''), actor.email, auth.uid()::text);
  action_name := case when p_enabled then 'INSTITUTION_ENABLED' else 'INSTITUTION_DISABLED' end;
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    institution_id, subject_id, actor_id, actor_name, actor_email, reason, details
  ) values (candidate.id, candidate.journey_code, candidate.content_version,
    candidate.snapshot_fingerprint, action_name, p_institution_id, p_subject_id, auth.uid(),
    actor_name, coalesce(actor.email, ''), btrim(p_reason),
    jsonb_build_object('technical_validation_status', candidate.technical_validation_status,
      'publication_status', candidate.publication_status, 'journey_id', runtime.journey_id));
  return jsonb_build_object('enabled', p_enabled, 'institution_id', p_institution_id,
    'subject_id', p_subject_id, 'technical_validation_status', candidate.technical_validation_status);
end;
$$;

create or replace function private.remove_human_review_claim_from_v12_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.discipline_journey_id is not null and new.metadata ? 'pedagogical_review_status'
     and exists (select 1 from public.learning_central_studies_v2_runtime runtime
                  where runtime.journey_id = new.discipline_journey_id) then
    update public.learning_guided_sessions
       set metadata = (coalesce(metadata, '{}'::jsonb) - 'pedagogical_review_status') ||
         jsonb_build_object('technical_validation_status', 'PUBLISHED',
           'technical_validator_version', 'TECESCOLA_GUIDED_STUDY_V12')
     where id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function private.remove_human_review_claim_from_v12_session() from public, anon, authenticated;
drop trigger if exists guided_session_v12_remove_human_review_claim on public.learning_guided_sessions;
create trigger guided_session_v12_remove_human_review_claim
after insert on public.learning_guided_sessions
for each row execute function private.remove_human_review_claim_from_v12_session();

revoke all on function public.review_central_studies_v2_candidate_v1(text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_central_studies_v2_review_queue_v1(),
  public.get_central_studies_v2_review_preview_v1(text, text) from public, anon, authenticated;

create or replace function public.get_guided_study_overview_v11(p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recommendation as (
    select private.recommend_guided_study_v11(p_institution_id) as value
  )
  select (case when recommendation.value->>'state' = 'NO_ELIGIBLE_CONTENT'
    then recommendation.value || jsonb_build_object(
      'reason', 'Ainda não há conteúdo BNCC publicado e validado tecnicamente para iniciar a próxima etapa. O progresso anterior foi preservado.'
    ) else recommendation.value end) - 'student_id' - 'target_canonical_skill_id'
    from recommendation;
$$;

alter function public.start_guided_study_v11(uuid) rename to start_guided_study_v11_pre_v12;
revoke all on function public.start_guided_study_v11_pre_v12(uuid) from public, anon, authenticated;
create function public.start_guided_study_v11(p_institution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  result := public.start_guided_study_v11_pre_v12(p_institution_id);
  if result->>'state' = 'NO_ELIGIBLE_CONTENT' then
    result := result || jsonb_build_object(
      'reason', 'Ainda não há conteúdo BNCC publicado e validado tecnicamente para iniciar a próxima etapa. O progresso anterior foi preservado.'
    );
  end if;
  return result;
end;
$$;
revoke all on function public.get_guided_study_overview_v11(uuid), public.start_guided_study_v11(uuid) from public, anon;
grant execute on function public.get_guided_study_overview_v11(uuid), public.start_guided_study_v11(uuid) to authenticated;

create or replace function public.get_guided_study_v12_validation_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'GUIDED_STUDY_V12_VALIDATION_FORBIDDEN' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'validator_version', 'TECESCOLA_GUIDED_STUDY_V12',
    'content', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_type', latest.source_type, 'source_id', latest.source_id,
        'content_version', latest.content_version, 'validation_status', latest.validation_status,
        'errors', latest.errors, 'checks', latest.checks, 'validated_at', latest.validated_at
      ) order by latest.source_type, latest.source_id)
        from (
          select distinct on (run.source_type, run.source_id) run.*
            from private.guided_content_validation_runs_v12 run
           order by run.source_type, run.source_id, run.validated_at desc
        ) latest
    ), '[]'::jsonb),
    'coverage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stage', coverage.stage, 'grade_level', coverage.grade_level,
        'mapped_skill_count', coverage.mapped_skill_count,
        'technical_ready_count', coverage.technical_ready_count,
        'published_skill_count', coverage.published_skill_count,
        'eligible_skill_count', coverage.eligible_skill_count
      ) order by case coverage.stage when 'ENSINO_FUNDAMENTAL' then 1 when 'ENSINO_MEDIO' then 2 else 3 end,
        coverage.grade_level)
      from (
        select grade_grid.stage, grade_grid.grade_level,
          count(distinct skill.id) filter (where catalog.id is not null
            and skill.bncc_alignment_status = 'MAPPED')::integer as mapped_skill_count,
          count(distinct skill.id) filter (where catalog.id is not null
            and skill.bncc_alignment_status = 'MAPPED'
            and skill.technical_validation_status in ('READY', 'PUBLISHED'))::integer as technical_ready_count,
          count(distinct skill.id) filter (where catalog.id is not null
            and skill.publication_status = 'PUBLISHED'
            and skill.bncc_alignment_status = 'MAPPED' and skill.content_readiness = 'ADAPTIVE_READY'
            and skill.mastery_targetable and skill.technical_validation_status = 'PUBLISHED')::integer as published_skill_count,
          count(distinct skill.id) filter (where catalog.id is not null
            and skill.publication_status = 'PUBLISHED'
            and skill.bncc_alignment_status = 'MAPPED' and skill.content_readiness = 'ADAPTIVE_READY'
            and skill.mastery_targetable and skill.technical_validation_status = 'PUBLISHED' and exists (
              select 1 from public.learning_skill_lessons lesson
               where lesson.canonical_skill_id = skill.id and lesson.active and lesson.version = 4
            ) and (
              select count(distinct qs.purpose)
                from public.learning_question_sets qs
               where qs.canonical_skill_id = skill.id and qs.scope = 'GLOBAL'
                 and qs.institution_id is null and qs.teacher_profile_id is null
                 and qs.active and qs.version = 4
                 and qs.purpose in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')
                 and exists (
                   select 1 from public.learning_question_set_items item
                   join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
                    where item.question_set_id = qs.id
                      and coalesce(qs.metadata->>'demo_preview_only', 'false') <> 'true'
                      and coalesce(qs.metadata->>'demonstration_only', 'false') <> 'true'
                      and coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'
                      and coalesce(bank.metadata->>'demonstration_only', 'false') <> 'true'
                 )
            ) = 5)::integer as eligible_skill_count
        from (
          select 'ENSINO_FUNDAMENTAL'::text as stage, grade::smallint as grade_level
            from generate_series(1, 9) as grades(grade)
          union all
          select 'ENSINO_MEDIO'::text as stage, grade::smallint as grade_level
            from generate_series(1, 3) as grades(grade)
        ) grade_grid
        left join public.learning_curriculum_grade_targets target
          on target.stage = grade_grid.stage and target.grade_level = grade_grid.grade_level and target.active
        left join public.learning_curriculum_skills skill
          on skill.id = target.canonical_skill_id and skill.active and skill.node_kind = 'LEAF'
        left join public.learning_curriculum_catalogs catalog
          on catalog.id = skill.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
        group by grade_grid.stage, grade_grid.grade_level
      ) coverage
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'published', (select count(*)::integer from (
        select distinct on (run.source_type, run.source_id) run.validation_status
          from private.guided_content_validation_runs_v12 run
         order by run.source_type, run.source_id, run.validated_at desc
      ) latest where latest.validation_status = 'PUBLISHED'),
      'ready', (select count(*)::integer from (
        select distinct on (run.source_type, run.source_id) run.validation_status
          from private.guided_content_validation_runs_v12 run
         order by run.source_type, run.source_id, run.validated_at desc
      ) latest where latest.validation_status = 'READY'),
      'failed', (select count(*)::integer from (
        select distinct on (run.source_type, run.source_id) run.validation_status
          from private.guided_content_validation_runs_v12 run
         order by run.source_type, run.source_id, run.validated_at desc
      ) latest where latest.validation_status = 'VALIDATION_FAILED'),
      'disabled', (select count(*)::integer from (
        select distinct on (run.source_type, run.source_id) run.validation_status
          from private.guided_content_validation_runs_v12 run
         order by run.source_type, run.source_id, run.validated_at desc
      ) latest where latest.validation_status = 'DISABLED')
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_guided_study_v12_validation_summary() from public, anon;
grant execute on function public.get_guided_study_v12_validation_summary() to authenticated;

do $guided_study_v12_backfill$
declare row record;
begin
  for row in select id from public.learning_adaptive_content_packs order by pack_version loop
    perform private.validate_adaptive_content_pack_v12(row.id);
  end loop;

  for row in
    select id, snapshot_fingerprint from public.learning_central_studies_v2_candidates
     where publication_status <> 'UNPUBLISHED' order by journey_code, content_version
  loop
    perform private.integrate_central_studies_v2_candidate_v12(row.id, row.snapshot_fingerprint);
  end loop;

  update public.learning_curriculum_skills skill
     set technical_validation_status = 'VALIDATION_PENDING', updated_at = now()
    from public.learning_curriculum_catalogs catalog
   where catalog.id = skill.catalog_id and catalog.active and catalog.code = 'BNCC_2018'
     and skill.node_kind = 'LEAF';
end;
$guided_study_v12_backfill$;

notify pgrst, 'reload schema';
commit;
