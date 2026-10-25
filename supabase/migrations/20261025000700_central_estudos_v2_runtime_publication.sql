begin;

-- Central Studies V2 is materialized into the existing V4/V9 runtime only
-- after an explicitly qualified human approval. Publication and institution
-- enablement remain separate audited actions.

alter table public.learning_central_studies_v2_candidates
  drop constraint learning_central_studies_v2_candidates_publication_status_check;
alter table public.learning_central_studies_v2_candidates
  add constraint learning_central_studies_v2_candidates_publication_status_check
  check (publication_status in ('STAGING', 'PUBLISHED', 'UNPUBLISHED'));

create or replace function private.prevent_central_studies_v2_source_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.journey_code is distinct from old.journey_code
     or new.content_version is distinct from old.content_version
     or new.subject_area is distinct from old.subject_area
     or new.grade_level is distinct from old.grade_level
     or new.official_skill_code is distinct from old.official_skill_code
     or new.snapshot_fingerprint is distinct from old.snapshot_fingerprint
     or new.payload is distinct from old.payload then
    raise exception 'CENTRAL_STUDIES_V2_SOURCE_VERSION_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;
drop trigger if exists central_studies_v2_source_immutable on public.learning_central_studies_v2_candidates;
create trigger central_studies_v2_source_immutable
before update on public.learning_central_studies_v2_candidates
for each row execute function private.prevent_central_studies_v2_source_edits();
revoke all on function private.prevent_central_studies_v2_source_edits() from public, anon, authenticated;

create table public.learning_central_studies_v2_runtime (
  candidate_id uuid primary key references public.learning_central_studies_v2_candidates(id) on delete restrict,
  snapshot_fingerprint text not null check (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_skill_id uuid not null unique references public.learning_curriculum_skills(id) on delete restrict,
  canonical_subject_id uuid not null references public.learning_canonical_subjects(id) on delete restrict,
  official_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  journey_id uuid not null unique references public.learning_bncc_discipline_journeys(id) on delete restrict,
  lesson_id uuid not null unique references public.learning_skill_lessons(id) on delete restrict,
  integrated_by uuid not null,
  integrated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint learning_central_studies_v2_runtime_candidate_fingerprint_unique unique (candidate_id, snapshot_fingerprint)
);

create table public.learning_central_studies_v2_institution_targets (
  candidate_id uuid not null references public.learning_central_studies_v2_candidates(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  enabled boolean not null default false,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  change_reason text not null,
  primary key (candidate_id, institution_id),
  unique (institution_id, subject_id, candidate_id)
);

create table public.learning_central_studies_v2_release_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  candidate_id uuid not null references public.learning_central_studies_v2_candidates(id) on delete restrict,
  journey_code text not null,
  content_version text not null,
  snapshot_fingerprint text not null check (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  action text not null check (action in ('INTEGRATED', 'PUBLISHED', 'UNPUBLISHED', 'INSTITUTION_ENABLED', 'INSTITUTION_DISABLED')),
  institution_id uuid references public.institutions(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  actor_id uuid not null,
  actor_name text not null,
  actor_email text not null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index learning_central_studies_v2_runtime_journey_idx
  on public.learning_central_studies_v2_runtime(journey_id);
create index learning_central_studies_v2_targets_lookup_idx
  on public.learning_central_studies_v2_institution_targets(institution_id, subject_id, enabled);
create index learning_central_studies_v2_release_events_history_idx
  on public.learning_central_studies_v2_release_events(candidate_id, occurred_at desc);

alter table public.learning_central_studies_v2_runtime enable row level security;
alter table public.learning_central_studies_v2_institution_targets enable row level security;
alter table public.learning_central_studies_v2_release_events enable row level security;
revoke all on public.learning_central_studies_v2_runtime,
  public.learning_central_studies_v2_institution_targets,
  public.learning_central_studies_v2_release_events from public, anon, authenticated;

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
        on runtime.candidate_id = candidate.id
       and runtime.snapshot_fingerprint = candidate.snapshot_fingerprint
      join public.learning_central_studies_v2_institution_targets target
        on target.candidate_id = candidate.id and target.enabled
      join public.subjects subject
        on subject.id = target.subject_id
       and subject.institution_id = target.institution_id
       and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id
       and subject_link.subject_id = target.subject_id
       and subject_link.active
       and subject_link.subject_area = candidate.subject_area
      join public.students student
        on student.institution_id = target.institution_id
       and student.profile_id = auth.uid()
      join public.enrollments enrollment
        on enrollment.student_id = student.id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = target.institution_id
       and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where candidate.id::text = p_candidate_id
       and candidate.publication_status = 'PUBLISHED'
       and candidate.review_status = 'PEDAGOGICAL_REVIEWED'
       and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
       and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
       and nullif(normalized.value->>'grade_level', '')::smallint = candidate.grade_level
  );
$$;
revoke all on function private.central_studies_v2_student_can_read(text) from public, anon;
grant execute on function private.central_studies_v2_student_can_read(text) to authenticated;

-- A review decision is not an approval for release unless the reviewer
-- explicitly attests to pedagogical competence and confirms the BNCC mapping.
create or replace function private.enforce_central_studies_v2_qualified_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status = 'PEDAGOGICAL_REVIEWED'
     and (new.review_checklist->>'reviewerCompetence' is distinct from 'true'
       or length(btrim(coalesce(new.review_checklist->>'reviewerCompetenceBasis', ''))) < 10
       or new.review_checklist->>'curriculumMapping' is distinct from 'true') then
    raise exception 'CENTRAL_STUDIES_V2_QUALIFIED_REVIEW_REQUIRED' using errcode = '22023';
  end if;
  if new.review_status = 'PEDAGOGICAL_REVIEWED'
     and not exists (
       select 1
         from public.learning_central_studies_v2_review_events event
        where event.candidate_id = new.id
          and event.journey_code = new.journey_code
          and event.content_version = new.content_version
          and event.snapshot_fingerprint = new.snapshot_fingerprint
          and event.decision = 'APPROVED_FOR_INTEGRATION'
          and event.reviewer_id_snapshot = new.reviewer_id_snapshot
          and event.checklist = new.review_checklist
     ) then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_AUDIT_REQUIRED' using errcode = '55000';
  end if;
  return new;
end;
$$;
drop trigger if exists central_studies_v2_qualified_review_guard on public.learning_central_studies_v2_candidates;
create trigger central_studies_v2_qualified_review_guard
before insert or update of review_status, review_checklist
on public.learning_central_studies_v2_candidates
for each row execute function private.enforce_central_studies_v2_qualified_review();
revoke all on function private.enforce_central_studies_v2_qualified_review() from public, anon, authenticated;

create or replace function private.enforce_central_studies_v2_active_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare session_row public.learning_guided_sessions%rowtype;
begin
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = new.session_id;
  if not found or session_row.discipline_journey_id is null then
    return new;
  end if;
  if exists (select 1 from public.learning_central_studies_v2_runtime runtime
      where runtime.journey_id = session_row.discipline_journey_id)
     and (session_row.status not in ('ACTIVE', 'PAUSED')
       or not private.central_studies_v2_journey_allowed(
         session_row.institution_id, session_row.student_id,
         session_row.discipline_journey_id, session_row.target_canonical_skill_id
       )) then
    raise exception 'CENTRAL_STUDIES_V2_JOURNEY_REVOKED' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists central_studies_v2_active_step_write_guard on public.learning_guided_session_events;
create trigger central_studies_v2_active_step_write_guard
before insert on public.learning_guided_session_events
for each row when (new.event_type in ('STEP_COMPLETED', 'EVIDENCE_RECORDED'))
execute function private.enforce_central_studies_v2_active_release();
revoke all on function private.enforce_central_studies_v2_active_release() from public, anon, authenticated;

-- V2 content is visible through direct table reads only to a student with an
-- active grade-6 enrollment in an explicitly enabled institution.
drop policy if exists learning_skill_lessons_select on public.learning_skill_lessons;
create policy learning_skill_lessons_select
on public.learning_skill_lessons for select to authenticated
using (active
  and metadata->>'demo_preview_only' is distinct from 'true'
  and (metadata->>'central_studies_v2_candidate_id' is null
       or private.central_studies_v2_student_can_read(metadata->>'central_studies_v2_candidate_id')));

drop policy if exists learning_curriculum_skills_select on public.learning_curriculum_skills;
create policy learning_curriculum_skills_select
on public.learning_curriculum_skills for select to authenticated
using (active is true
  and exists (select 1 from public.learning_curriculum_catalogs catalog
    where catalog.id = catalog_id and catalog.active is true)
  and metadata->>'demo_preview_only' is distinct from 'true'
  and (metadata->>'central_studies_v2_candidate_id' is null
       or private.central_studies_v2_student_can_read(metadata->>'central_studies_v2_candidate_id')));

drop policy if exists learning_question_bank_select on public.learning_question_bank;
create policy learning_question_bank_select
on public.learning_question_bank for select to authenticated
using (active
  and metadata->>'demo_preview_only' is distinct from 'true'
  and (metadata->>'central_studies_v2_candidate_id' is null
       or private.central_studies_v2_student_can_read(metadata->>'central_studies_v2_candidate_id'))
  and ((package_type in ('TECESCOLA', 'ENEM') and institution_id is null)
    or (institution_id is not null and public.can_access_institution(institution_id))));

drop policy if exists learning_question_sets_select on public.learning_question_sets;
create policy learning_question_sets_select
on public.learning_question_sets for select to authenticated
using (active
  and metadata->>'demo_preview_only' is distinct from 'true'
  and (metadata->>'central_studies_v2_candidate_id' is null
       or private.central_studies_v2_student_can_read(metadata->>'central_studies_v2_candidate_id'))
  and (scope = 'GLOBAL' or public.can_access_institution(institution_id) or teacher_profile_id = auth.uid()));

drop policy if exists learning_question_set_items_select on public.learning_question_set_items;
create policy learning_question_set_items_select
on public.learning_question_set_items for select to authenticated
using (exists (
  select 1 from public.learning_question_sets set_row
   where set_row.id = question_set_id
     and set_row.active
     and set_row.metadata->>'demo_preview_only' is distinct from 'true'
     and (set_row.metadata->>'central_studies_v2_candidate_id' is null
          or private.central_studies_v2_student_can_read(set_row.metadata->>'central_studies_v2_candidate_id'))
     and (set_row.scope = 'GLOBAL' or public.can_access_institution(set_row.institution_id)
       or set_row.teacher_profile_id = auth.uid())
));

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
        on candidate.id = runtime.candidate_id
       and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
      join public.learning_central_studies_v2_institution_targets target
        on target.candidate_id = candidate.id
       and target.institution_id = p_institution_id
       and target.enabled
      join public.subjects subject
        on subject.id = target.subject_id
       and subject.institution_id = target.institution_id
       and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id
       and subject_link.subject_id = target.subject_id
       and subject_link.active
       and subject_link.subject_area = candidate.subject_area
      join public.learning_bncc_discipline_journeys journey
        on journey.id = runtime.journey_id
       and journey.active
       and journey.publication_status = 'PUBLISHED'
       and journey.mapping_status = 'MAPPED'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
      join public.learning_curriculum_skills execution_skill
        on execution_skill.id = runtime.canonical_skill_id
       and execution_skill.active
       and execution_skill.node_kind = 'LEAF'
       and execution_skill.content_readiness = 'ADAPTIVE_READY'
      join public.students student
        on student.id = p_student_id
       and student.institution_id = p_institution_id
      join public.enrollments enrollment
        on enrollment.student_id = student.id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where runtime.journey_id = p_journey_id
       and (p_execution_skill_id is null or runtime.canonical_skill_id = p_execution_skill_id)
       and candidate.publication_status = 'PUBLISHED'
       and candidate.review_status = 'PEDAGOGICAL_REVIEWED'
       and candidate.review_checklist->>'reviewerCompetence' = 'true'
       and candidate.review_checklist->>'curriculumMapping' = 'true'
       and length(btrim(coalesce(candidate.review_checklist->>'reviewerCompetenceBasis', ''))) >= 10
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
      on binding.institution_id = p_institution_id
     and binding.canonical_subject_id = journey.canonical_subject_id
   where journey.id = p_journey_id
     and journey.active
     and journey.publication_status = 'DEMO_PREVIEW'
     and journey.mapping_status = 'MAPPING_PENDING'
     and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and journey.suggested_stage = 'ENSINO_MEDIO'
     and journey.suggested_grade = 1
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
    join public.classes class on class.id = enrollment.class_id and class.institution_id = p_institution_id and class.active
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
         'MAPPED'::text, 'Habilidade oficial confirmada na revisão e vinculada ao conteúdo integrado.'::text,
         'CENTRAL_STUDIES_V2'::text, 'AVAILABLE'::text,
         (select count(distinct item.question_bank_id)::integer
            from public.learning_question_sets qs
            join public.learning_question_set_items item on item.question_set_id = qs.id
            join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
           where qs.canonical_skill_id = runtime.canonical_skill_id and qs.version = 4
             and qs.scope = 'GLOBAL' and qs.metadata->>'central_studies_v2_candidate_id' = candidate.id::text),
         array[]::text[], coalesce(state.mastery_estimate, 0), active_session.id, active_session.status,
         'PEDAGOGICAL_REVIEWED'::text, 'Aula publicada e habilitada pela instituição.'::text,
         candidate.publication_status
    from public.learning_central_studies_v2_runtime runtime
    join public.learning_central_studies_v2_candidates candidate
      on candidate.id = runtime.candidate_id
     and candidate.snapshot_fingerprint = runtime.snapshot_fingerprint
    join public.learning_central_studies_v2_institution_targets target
      on target.candidate_id = candidate.id and target.institution_id = p_institution_id and target.enabled
    join public.subjects subject
      on subject.id = target.subject_id and subject.institution_id = target.institution_id and subject.active
    join public.learning_curriculum_subject_links subject_link
      on subject_link.institution_id = target.institution_id and subject_link.subject_id = target.subject_id
     and subject_link.active and subject_link.subject_area = candidate.subject_area
    join public.learning_canonical_subjects canonical_subject
      on canonical_subject.id = runtime.canonical_subject_id and canonical_subject.active
    join public.learning_bncc_discipline_journeys journey
      on journey.id = runtime.journey_id and journey.active and journey.publication_status = 'PUBLISHED'
     and journey.mapping_status = 'MAPPED' and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEWED'
    join public.students student on student.id = p_student_id and student.institution_id = p_institution_id
    join public.enrollments enrollment on enrollment.student_id = student.id
     and enrollment.active
     and upper(enrollment.status::text) = 'ACTIVE'
    join public.classes class on class.id = enrollment.class_id and class.institution_id = p_institution_id and class.active
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
     and candidate.review_status = 'PEDAGOGICAL_REVIEWED'
     and candidate.review_checklist->>'reviewerCompetence' = 'true'
     and candidate.review_checklist->>'curriculumMapping' = 'true'
     and length(btrim(coalesce(candidate.review_checklist->>'reviewerCompetenceBasis', ''))) >= 10
     and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
     and nullif(normalized.value->>'grade_level', '')::smallint = candidate.grade_level
   order by candidate.subject_area, candidate.payload->>'unitCode', candidate.journey_code;
$$;

create or replace function public.start_central_studies_v2_journey_v1(
  p_institution_id uuid, p_student_id uuid, p_journey_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  runtime_row public.learning_central_studies_v2_runtime%rowtype;
  candidate_row public.learning_central_studies_v2_candidates%rowtype;
  journey_row public.learning_bncc_discipline_journeys%rowtype;
  existing_session public.learning_guided_sessions%rowtype;
  created_session public.learning_guided_sessions%rowtype;
  v_subject_id uuid;
  v_class_id uuid;
  v_probe_set uuid;
  v_step_id uuid;
begin
  if not private.central_studies_v2_journey_allowed(p_institution_id, p_student_id, p_journey_id) then
    raise exception 'CENTRAL_STUDIES_V2_STUDENT_ACCESS_DENIED' using errcode = '42501';
  end if;
  perform private.assert_bncc_discipline_journey_v9(p_institution_id, p_student_id, p_journey_id, null);
  select runtime.* into runtime_row from public.learning_central_studies_v2_runtime runtime
   where runtime.journey_id = p_journey_id;
  select candidate.* into candidate_row from public.learning_central_studies_v2_candidates candidate
   where candidate.id = runtime_row.candidate_id;
  select journey.* into journey_row from public.learning_bncc_discipline_journeys journey
   where journey.id = p_journey_id;

  select session.* into existing_session from public.learning_guided_sessions session
   where session.institution_id = p_institution_id and session.student_id = p_student_id
     and session.discipline_journey_id = p_journey_id
     and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
   order by session.updated_at desc limit 1;
  if found and existing_session.planner_version = 'V4' then
    return pg_catalog.jsonb_build_object('session_id', existing_session.id, 'created', false,
      'current_step_id', existing_session.current_step_id,
      'target_canonical_skill_id', existing_session.target_canonical_skill_id, 'engine_version', 'V4');
  end if;

  select question_set.id into v_probe_set
    from public.learning_question_sets question_set
    join public.learning_question_set_items item on item.question_set_id = question_set.id
    join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
   where question_set.canonical_skill_id = runtime_row.canonical_skill_id
     and question_set.scope = 'GLOBAL' and question_set.version = 4 and question_set.active
     and question_set.purpose = 'PROBE'
     and question_set.metadata->>'central_studies_v2_candidate_id' = runtime_row.candidate_id::text
   group by question_set.id
  having count(distinct item.question_bank_id) >= 1;
  if v_probe_set is null then raise exception 'CENTRAL_STUDIES_V2_RUNTIME_QUESTION_SET_MISSING'; end if;
  if (select count(distinct question_set.purpose)
        from public.learning_question_sets question_set
        join public.learning_question_set_items item on item.question_set_id = question_set.id
        join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
       where question_set.canonical_skill_id = runtime_row.canonical_skill_id
         and question_set.scope = 'GLOBAL' and question_set.version = 4 and question_set.active
         and question_set.metadata->>'central_studies_v2_candidate_id' = runtime_row.candidate_id::text) <> 5 then
    raise exception 'CENTRAL_STUDIES_V2_RUNTIME_PATH_INCOMPLETE';
  end if;

  select target.subject_id, enrollment.class_id into v_subject_id, v_class_id
    from public.learning_central_studies_v2_institution_targets target
    join public.subjects subject on subject.id = target.subject_id and subject.institution_id = target.institution_id and subject.active
    join public.learning_curriculum_subject_links subject_link
      on subject_link.institution_id = target.institution_id and subject_link.subject_id = target.subject_id
     and subject_link.active and subject_link.subject_area = candidate_row.subject_area
    join public.students student on student.id = p_student_id and student.institution_id = target.institution_id
    join public.enrollments enrollment on enrollment.student_id = student.id
     and enrollment.active and upper(enrollment.status::text) = 'ACTIVE'
    join public.classes class on class.id = enrollment.class_id and class.institution_id = target.institution_id and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
   where target.candidate_id = candidate_row.id and target.institution_id = p_institution_id and target.enabled
     and normalized.value->>'stage' = 'ENSINO_FUNDAMENTAL'
     and nullif(normalized.value->>'grade_level', '')::smallint = candidate_row.grade_level
   order by enrollment.created_at desc limit 1;
  if v_subject_id is null or v_class_id is null then
    raise exception 'CENTRAL_STUDIES_V2_ACTIVE_ENROLLMENT_REQUIRED';
  end if;

  insert into public.learning_guided_sessions(
    institution_id, student_id, target_canonical_skill_id, original_target_canonical_skill_id,
    current_canonical_skill_id, subject_id, class_id, discipline_journey_id,
    planner_version, decision_reason, metadata
  ) values (
    p_institution_id, p_student_id, runtime_row.canonical_skill_id, runtime_row.canonical_skill_id,
    runtime_row.canonical_skill_id, v_subject_id, v_class_id, p_journey_id,
    'V4', 'CENTRAL_STUDIES_V2_PUBLISHED',
    pg_catalog.jsonb_build_object(
      'engine_version', 'V4', 'discipline_journey_id', p_journey_id,
      'journey_code', candidate_row.journey_code, 'journey_title', candidate_row.payload->>'journeyTitle',
      'unit_code', candidate_row.payload->>'unitCode', 'unit_title', candidate_row.payload->>'unitTitle',
      'canonical_subject_id', journey_row.canonical_subject_id,
      'publication_status', 'PUBLISHED', 'availability_status', 'AVAILABLE',
      'mapping_status', 'MAPPED', 'pedagogical_review_status', 'PEDAGOGICAL_REVIEWED',
      'demonstration_only', false, 'central_studies_v2_candidate_id', runtime_row.candidate_id,
      'central_studies_v2_fingerprint', runtime_row.snapshot_fingerprint,
      'adaptive_policy_version', 'V8', 'replan_count', 0
    )
  ) returning * into created_session;

  insert into public.learning_guided_steps(
    institution_id, session_id, canonical_skill_id, step_type, purpose,
    position, status, lesson_id, started_at, metadata
  ) values (
    p_institution_id, created_session.id, runtime_row.canonical_skill_id, 'LESSON', null,
    0, 'ACTIVE', runtime_row.lesson_id, now(),
    pg_catalog.jsonb_build_object('journey_id', p_journey_id, 'central_studies_v2_candidate_id', runtime_row.candidate_id,
      'selection_integrity_version', 'SERVER_SELECTED_V1')
  ) returning id into v_step_id;
  update public.learning_guided_sessions set current_step_id = v_step_id where id = created_session.id;

  insert into public.learning_guided_session_events(
    institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload
  ) values (
    p_institution_id, created_session.id, p_student_id, 'SESSION_STARTED', v_step_id,
    'central-studies-v2-session-start:' || created_session.id::text,
    pg_catalog.jsonb_build_object('engine_version', 'V4', 'journey_id', p_journey_id,
      'candidate_id', runtime_row.candidate_id, 'fingerprint', runtime_row.snapshot_fingerprint)
  );
  insert into public.learning_guided_session_events(
    institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload
  ) values (
    p_institution_id, created_session.id, p_student_id, 'STEP_STARTED', v_step_id,
    'central-studies-v2-step-start:' || v_step_id::text,
    pg_catalog.jsonb_build_object('step_type', 'LESSON', 'journey_id', p_journey_id)
  );
  return pg_catalog.jsonb_build_object('session_id', created_session.id, 'created', true,
    'current_step_id', v_step_id, 'target_canonical_skill_id', runtime_row.canonical_skill_id,
    'engine_version', 'V4');
end;
$$;

create or replace function public.get_central_studies_v2_release_status_v1(
  p_journey_code text, p_content_version text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare candidate public.learning_central_studies_v2_candidates%rowtype;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object(
    'journey_code', candidate.journey_code, 'content_version', candidate.content_version,
    'snapshot_fingerprint', candidate.snapshot_fingerprint, 'review_status', candidate.review_status,
    'publication_status', candidate.publication_status,
    'integrated', exists(select 1 from public.learning_central_studies_v2_runtime runtime
      where runtime.candidate_id = candidate.id and runtime.snapshot_fingerprint = candidate.snapshot_fingerprint),
    'mapping_status', case when exists(select 1 from public.learning_central_studies_v2_runtime runtime
      where runtime.candidate_id = candidate.id and runtime.snapshot_fingerprint = candidate.snapshot_fingerprint)
      then 'MAPPED' else 'PENDING' end,
    'integrated_at', (select runtime.integrated_at from public.learning_central_studies_v2_runtime runtime where runtime.candidate_id = candidate.id),
    'enabled_institution_count', (select count(*)::integer
      from public.learning_central_studies_v2_institution_targets target
      join public.subjects subject on subject.id = target.subject_id
       and subject.institution_id = target.institution_id and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id
       and subject_link.subject_id = target.subject_id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
      where target.candidate_id = candidate.id and target.enabled),
    'release_events', coalesce((select jsonb_agg(jsonb_build_object(
      'action', event.action, 'institution_id', event.institution_id, 'subject_id', event.subject_id,
      'actor_name', event.actor_name, 'actor_email', event.actor_email, 'reason', event.reason,
      'occurred_at', event.occurred_at, 'details', event.details
    ) order by event.occurred_at desc) from public.learning_central_studies_v2_release_events event
      where event.candidate_id = candidate.id and event.snapshot_fingerprint = candidate.snapshot_fingerprint), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_central_studies_v2_institution_targets_v1(
  p_journey_code text, p_content_version text
)
returns table(institution_id uuid, institution_name text, subject_id uuid, subject_name text, enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare candidate public.learning_central_studies_v2_candidates%rowtype;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  return query
    select institution.id, institution.name::text, subject.id, subject.name::text,
           coalesce(target.enabled, false)
      from public.institutions institution
      join public.subjects subject on subject.institution_id = institution.id and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = institution.id and subject_link.subject_id = subject.id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
      left join public.learning_central_studies_v2_institution_targets target
        on target.candidate_id = candidate.id and target.institution_id = institution.id and target.subject_id = subject.id
     order by institution.name, subject.name;
end;
$$;

create or replace function public.integrate_central_studies_v2_candidate_v1(
  p_journey_code text, p_content_version text, p_expected_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.learning_central_studies_v2_candidates%rowtype;
  catalog_id uuid;
  canonical_subject_id uuid;
  official_skill_id uuid;
  execution_skill_id uuid;
  journey_id uuid;
  lesson_id uuid;
  bank_id uuid;
  question_set_id uuid;
  question jsonb;
  purpose text;
  markdown text;
  v_name text;
  v_email text;
  v_written integer := 0;
  reviewer_profile public.profiles%rowtype;
  purpose_position integer;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001';
  end if;
  if candidate.review_status <> 'PEDAGOGICAL_REVIEWED'
     or candidate.review_checklist->>'reviewerCompetence' is distinct from 'true'
     or candidate.review_checklist->>'curriculumMapping' is distinct from 'true'
     or length(btrim(coalesce(candidate.review_checklist->>'reviewerCompetenceBasis', ''))) < 10 then
    raise exception 'CENTRAL_STUDIES_V2_QUALIFIED_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.learning_central_studies_v2_review_events event
      where event.candidate_id = candidate.id
        and event.snapshot_fingerprint = candidate.snapshot_fingerprint
        and event.decision = 'APPROVED_FOR_INTEGRATION'
        and event.reviewer_id_snapshot = candidate.reviewer_id_snapshot
        and event.checklist = candidate.review_checklist) then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_AUDIT_REQUIRED' using errcode = '55000';
  end if;
  if exists (select 1 from public.learning_central_studies_v2_runtime runtime where runtime.candidate_id = candidate.id) then
    if exists (select 1 from public.learning_central_studies_v2_runtime runtime
        where runtime.candidate_id = candidate.id and runtime.snapshot_fingerprint = candidate.snapshot_fingerprint) then
      return pg_catalog.jsonb_build_object('integrated', true, 'journey_id',
        (select runtime.journey_id from public.learning_central_studies_v2_runtime runtime where runtime.candidate_id = candidate.id),
        'snapshot_fingerprint', candidate.snapshot_fingerprint);
    end if;
    raise exception 'CENTRAL_STUDIES_V2_RUNTIME_FINGERPRINT_MISMATCH';
  end if;

  if (candidate.official_skill_code !~ '^EF06(MA|LP|CI)[0-9]{2}$') then
    raise exception 'CENTRAL_STUDIES_V2_CURRICULUM_CODE_INVALID';
  end if;
  select canonical.id into canonical_subject_id
    from public.learning_canonical_subjects canonical
   where canonical.code = candidate.subject_area and canonical.active;
  if canonical_subject_id is null then raise exception 'CENTRAL_STUDIES_V2_CANONICAL_SUBJECT_MISSING'; end if;

  select skill.id into official_skill_id
    from public.learning_curriculum_skills skill
   where skill.active and skill.grade_level = 6
     and (skill.code = candidate.official_skill_code or skill.metadata->>'official_code' = candidate.official_skill_code)
   order by (skill.code = candidate.official_skill_code) desc, skill.id
   limit 1;
  if official_skill_id is null then raise exception 'CENTRAL_STUDIES_V2_OFFICIAL_SKILL_MAPPING_MISSING'; end if;

  select catalog.id into catalog_id from public.learning_curriculum_catalogs catalog
   where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and catalog.active;
  if catalog_id is null then raise exception 'CENTRAL_STUDIES_V2_EXECUTION_CATALOG_MISSING'; end if;

  insert into public.learning_curriculum_skills(
    catalog_id, code, stage, grade_level, subject_area, domain, title, description, active,
    canonical_subject_id, node_kind, content_readiness, mastery_targetable,
    pedagogical_review_status, bncc_alignment_status, publication_status, metadata
  ) values (
    catalog_id, candidate.journey_code, 'FUNDAMENTAL_II', candidate.grade_level,
    candidate.subject_area, candidate.payload->>'unitCode', candidate.payload->>'journeyTitle',
    candidate.payload->>'officialText', true, canonical_subject_id, 'LEAF', 'CONTENT_READY', false,
    'PEDAGOGICAL_REVIEWED', 'MAPPED', 'STAGING', pg_catalog.jsonb_build_object(
      'content_pack', 'central-estudos-v2', 'central_studies_v2_candidate_id', candidate.id,
      'candidate_skill_code', candidate.payload->>'skill', 'official_code', candidate.official_skill_code,
      'content_version', candidate.content_version, 'snapshot_fingerprint', candidate.snapshot_fingerprint
    )
  ) returning id into execution_skill_id;

  insert into public.learning_bncc_discipline_journeys(
    journey_code, canonical_subject_id, execution_skill_id, unit_code, unit_title, title,
    suggested_stage, suggested_grade, publication_status, mapping_status,
    pedagogical_review_status, content_version, metadata
  ) values (
    candidate.journey_code, canonical_subject_id, execution_skill_id,
    candidate.payload->>'unitCode', candidate.payload->>'unitTitle', candidate.payload->>'journeyTitle',
    'ENSINO_FUNDAMENTAL', candidate.grade_level, 'STAGING', 'MAPPED', 'PEDAGOGICAL_REVIEWED',
    candidate.content_version, pg_catalog.jsonb_build_object(
      'source_pack', 'central-estudos-v2', 'candidate_id', candidate.id,
      'snapshot_fingerprint', candidate.snapshot_fingerprint, 'mapping_status', 'MAPPED',
      'pedagogical_review_status', 'PEDAGOGICAL_REVIEWED', 'demonstration_only', false
    )
  ) returning id into journey_id;

  insert into public.learning_bncc_discipline_journey_skills(
    journey_id, official_skill_id, relation_type, mapping_status, mapping_reason,
    source_document, source_section, metadata
  ) values (
    journey_id, official_skill_id, 'PRIMARY', 'MAPPED',
    'Correspondência humana confirmada para ' || candidate.official_skill_code || ' na aprovação da versão ' || candidate.content_version || '.',
    'BNCC_EI_EF_2018', candidate.official_skill_code,
    pg_catalog.jsonb_build_object('candidate_id', candidate.id, 'snapshot_fingerprint', candidate.snapshot_fingerprint)
  );

  select pg_catalog.concat(
    '# ', candidate.payload#>>'{lesson,title}', E'\n\n## Introdução\n', candidate.payload#>>'{lesson,introduction}',
    E'\n\n## Explicação\n', candidate.payload#>>'{lesson,explanation}',
    E'\n\n## Exemplo guiado\n', candidate.payload#>>'{lesson,workedExample,prompt}', E'\n',
    coalesce((select string_agg('- ' || value, E'\n' order by ordinality)
      from jsonb_array_elements_text(candidate.payload#>'{lesson,workedExample,steps}') with ordinality steps(value, ordinality)), ''),
    E'\n\n**Resposta:** ', candidate.payload#>>'{lesson,workedExample,answer}',
    E'\n\n## Prática acompanhada\n',
    coalesce((select string_agg('- ' || (item->>'prompt') || E'\n  Apoio: ' || (item->>'scaffold'), E'\n')
      from jsonb_array_elements(candidate.payload#>'{lesson,guidedPractice}') item), ''),
    E'\n\n## Aplicação\n',
    coalesce((select string_agg('- **' || (item->>'context') || ':** ' || (item->>'prompt'), E'\n')
      from jsonb_array_elements(candidate.payload#>'{lesson,application}') item), ''),
    E'\n\n## Revisão\n',
    coalesce((select string_agg('- ' || value, E'\n' order by ordinality)
      from jsonb_array_elements_text(candidate.payload#>'{lesson,review}') with ordinality review(value, ordinality)), '')
  ) into markdown;

  insert into public.learning_skill_lessons(
    canonical_skill_id, version, title, summary, content_markdown, worked_example, tips,
    estimated_minutes, active, metadata
  ) values (
    execution_skill_id, 4, candidate.payload#>>'{lesson,title}',
    candidate.payload#>>'{lesson,introduction}', markdown,
    candidate.payload#>>'{lesson,workedExample,prompt}',
    array(select jsonb_array_elements_text(candidate.payload#>'{lesson,review}')),
    greatest(1, least(120, coalesce((candidate.payload#>>'{lesson,estimatedMinutes}')::integer, 15))), true,
    pg_catalog.jsonb_build_object('central_studies_v2_candidate_id', candidate.id,
      'central_studies_v2_fingerprint', candidate.snapshot_fingerprint,
      'content_version', candidate.content_version, 'source_lesson', candidate.payload->'lesson',
      'demo_preview_only', false)
  ) returning id into lesson_id;

  for purpose in select unnest(array['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']) loop
    purpose_position := 0;
    insert into public.learning_question_sets(
      canonical_skill_id, scope, purpose, version, difficulty, active, metadata
    ) values (
      execution_skill_id, 'GLOBAL', purpose, 4, null, true,
      pg_catalog.jsonb_build_object('central_studies_v2_candidate_id', candidate.id,
        'central_studies_v2_fingerprint', candidate.snapshot_fingerprint,
        'content_version', candidate.content_version, 'demo_preview_only', false)
    ) returning id into question_set_id;
    for question in select value from jsonb_array_elements(candidate.payload->'questions') where value->>'purpose' = purpose loop
      insert into public.learning_question_bank(
        package_type, source_type, source_name, subject_area, domain, topic,
        statement, options, correct_answer, explanation, difficulty, estimated_minutes,
        provenance, metadata, active
      ) values (
        'TECESCOLA', 'CENTRAL_STUDIES_V2', candidate.payload->>'journeyTitle',
        candidate.subject_area, candidate.payload->>'unitCode', candidate.official_skill_code,
        question->>'statement', question->'options', pg_catalog.to_jsonb(question->>'correctAnswer'),
        question->>'explanation', question->>'difficulty', 2, 'CENTRAL_STUDIES_V2_HUMAN_REVIEW_REQUIRED',
        question || pg_catalog.jsonb_build_object(
          'central_studies_v2_candidate_id', candidate.id,
          'central_studies_v2_fingerprint', candidate.snapshot_fingerprint,
          'content_version', candidate.content_version, 'misconception_code', question->>'misconception',
          'demo_preview_only', false
        ), true
      ) returning id into bank_id;
      insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
        values (bank_id, execution_skill_id, 'PRIMARY');
      insert into public.learning_question_set_items(question_set_id, question_bank_id, position)
        values (question_set_id, bank_id, purpose_position);
      purpose_position := purpose_position + 1;
      v_written := v_written + 1;
    end loop;
  end loop;
  if v_written <> jsonb_array_length(candidate.payload->'questions') then
    raise exception 'CENTRAL_STUDIES_V2_QUESTION_CONVERSION_MISMATCH';
  end if;

  insert into public.learning_central_studies_v2_runtime(
    candidate_id, snapshot_fingerprint, canonical_skill_id, canonical_subject_id,
    official_skill_id, journey_id, lesson_id, integrated_by
  ) values (
    candidate.id, candidate.snapshot_fingerprint, execution_skill_id, canonical_subject_id,
    official_skill_id, journey_id, lesson_id, auth.uid()
  );
  select * into reviewer_profile from public.profiles profile where profile.id = auth.uid();
  v_name := coalesce(nullif(btrim(reviewer_profile.full_name), ''), reviewer_profile.email, auth.uid()::text);
  v_email := coalesce(reviewer_profile.email, '');
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    actor_id, actor_name, actor_email, reason, details
  ) values (
    candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
    'INTEGRATED', auth.uid(), v_name, v_email, 'Integração explícita ao runtime V4/V9 após aprovação humana.',
    pg_catalog.jsonb_build_object('journey_id', journey_id, 'lesson_id', lesson_id,
      'question_count', v_written, 'execution_skill_id', execution_skill_id, 'official_skill_id', official_skill_id)
  );
  return pg_catalog.jsonb_build_object('integrated', true, 'journey_id', journey_id,
    'lesson_id', lesson_id, 'question_count', v_written, 'mapping_status', 'MAPPED',
    'snapshot_fingerprint', candidate.snapshot_fingerprint);
end;
$$;

-- A human review must include an explicit competence attestation and the
-- evidence basis before the exact content version can be approved.
create or replace function public.review_central_studies_v2_candidate_v1(
  p_journey_code text, p_content_version text, p_decision text, p_notes text,
  p_expected_fingerprint text, p_checklist jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.learning_central_studies_v2_candidates%rowtype;
  reviewer public.profiles%rowtype;
  v_reviewer_name text;
  event_id uuid;
begin
  if not public.is_platform_super_admin() then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('APPROVED_FOR_INTEGRATION', 'CHANGES_REQUESTED')
     or length(btrim(coalesce(p_notes, ''))) < 10 or length(p_notes) > 2000 then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_INVALID_DECISION' using errcode = '22023';
  end if;
  if p_decision = 'APPROVED_FOR_INTEGRATION' and (
    p_checklist is null or pg_catalog.jsonb_typeof(p_checklist) is distinct from 'object'
    or p_checklist->>'officialAlignment' is distinct from 'true'
    or p_checklist->>'pedagogicalAccuracy' is distinct from 'true'
    or p_checklist->>'ageAndGradeSuitability' is distinct from 'true'
    or p_checklist->>'clarityAndAccessibility' is distinct from 'true'
    or p_checklist->>'answerQuality' is distinct from 'true'
    or p_checklist->>'culturalAndContextualSuitability' is distinct from 'true'
    or p_checklist->>'reviewerCompetence' is distinct from 'true'
    or length(btrim(coalesce(p_checklist->>'reviewerCompetenceBasis', ''))) < 10
    or p_checklist->>'curriculumMapping' is distinct from 'true'
  ) then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001';
  end if;
  if candidate.review_status = 'PEDAGOGICAL_REVIEWED' then
    raise exception 'CENTRAL_STUDIES_V2_APPROVED_VERSION_IMMUTABLE' using errcode = '55000';
  end if;
  select * into reviewer from public.profiles profile where profile.id = auth.uid();
  v_reviewer_name := coalesce(nullif(btrim(reviewer.full_name), ''), reviewer.email, auth.uid()::text);
  insert into public.learning_central_studies_v2_review_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, decision, notes, checklist,
    reviewer_profile_id, reviewer_id_snapshot, reviewer_name, reviewer_email
  ) values (
    candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
    p_decision, btrim(p_notes), coalesce(p_checklist, '{}'::jsonb), reviewer.id, auth.uid(), v_reviewer_name,
    coalesce(reviewer.email, '')
  ) returning id into event_id;
  update public.learning_central_studies_v2_candidates
     set review_status = case when p_decision = 'APPROVED_FOR_INTEGRATION' then 'PEDAGOGICAL_REVIEWED' else 'CHANGES_REQUESTED' end,
         reviewer_profile_id = reviewer.id, reviewer_id_snapshot = auth.uid(), reviewer_name = v_reviewer_name,
         reviewer_email = coalesce(reviewer.email, ''), reviewed_at = now(), review_notes = btrim(p_notes),
         review_checklist = coalesce(p_checklist, '{}'::jsonb), updated_at = now()
   where id = candidate.id;
  return pg_catalog.jsonb_build_object(
    'review_event_id', event_id, 'journey_code', candidate.journey_code,
    'content_version', candidate.content_version, 'decision', p_decision,
    'publication_status', 'STAGING', 'reviewer_name', v_reviewer_name,
    'reviewer_email', coalesce(reviewer.email, ''), 'reviewed_at', now(),
    'snapshot_fingerprint', candidate.snapshot_fingerprint
  );
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
declare candidate public.learning_central_studies_v2_candidates%rowtype; runtime public.learning_central_studies_v2_runtime%rowtype;
  actor public.profiles%rowtype; v_name text;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 1000 then raise exception 'CENTRAL_STUDIES_V2_RELEASE_REASON_REQUIRED'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001'; end if;
  if candidate.review_status <> 'PEDAGOGICAL_REVIEWED'
     or candidate.review_checklist->>'reviewerCompetence' is distinct from 'true'
     or candidate.review_checklist->>'curriculumMapping' is distinct from 'true'
     or length(btrim(coalesce(candidate.review_checklist->>'reviewerCompetenceBasis', ''))) < 10 then
    raise exception 'CENTRAL_STUDIES_V2_QUALIFIED_REVIEW_REQUIRED';
  end if;
  if not exists (select 1 from public.learning_central_studies_v2_review_events event
      where event.candidate_id = candidate.id
        and event.snapshot_fingerprint = candidate.snapshot_fingerprint
        and event.decision = 'APPROVED_FOR_INTEGRATION'
        and event.reviewer_id_snapshot = candidate.reviewer_id_snapshot
        and event.checklist = candidate.review_checklist) then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_AUDIT_REQUIRED' using errcode = '55000';
  end if;
  select * into runtime from public.learning_central_studies_v2_runtime row
   where row.candidate_id = candidate.id and row.snapshot_fingerprint = candidate.snapshot_fingerprint;
  if not found then raise exception 'CENTRAL_STUDIES_V2_RUNTIME_INTEGRATION_REQUIRED'; end if;
  if not exists (select 1 from public.learning_bncc_discipline_journeys journey
      where journey.id = runtime.journey_id and journey.active and journey.mapping_status = 'MAPPED'
        and exists(select 1 from public.learning_bncc_discipline_journey_skills mapped
          where mapped.journey_id = journey.id and mapped.official_skill_id = runtime.official_skill_id and mapped.mapping_status = 'MAPPED'))
     or not exists (select 1 from public.learning_skill_lessons lesson where lesson.id = runtime.lesson_id and lesson.active)
     or (select count(distinct question_set.purpose) from public.learning_question_sets question_set
          join public.learning_question_set_items item on item.question_set_id = question_set.id
          join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
         where question_set.canonical_skill_id = runtime.canonical_skill_id and question_set.scope = 'GLOBAL'
           and question_set.version = 4 and question_set.active
           and question_set.metadata->>'central_studies_v2_candidate_id' = candidate.id::text) <> 5 then
    raise exception 'CENTRAL_STUDIES_V2_RUNTIME_VALIDATION_FAILED';
  end if;
  if not exists (
    select 1
      from public.learning_central_studies_v2_institution_targets target
      join public.subjects subject on subject.id = target.subject_id
       and subject.institution_id = target.institution_id and subject.active
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = target.institution_id
       and subject_link.subject_id = target.subject_id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
     where target.candidate_id = candidate.id and target.enabled
  ) then
    raise exception 'CENTRAL_STUDIES_V2_ENABLED_INSTITUTION_REQUIRED';
  end if;
  if candidate.publication_status = 'PUBLISHED' then
    return pg_catalog.jsonb_build_object('publication_status', candidate.publication_status, 'snapshot_fingerprint', candidate.snapshot_fingerprint);
  end if;
  update public.learning_central_studies_v2_candidates
     set publication_status = 'PUBLISHED', updated_at = now() where id = candidate.id;
  update public.learning_curriculum_skills
     set publication_status = 'PUBLISHED', content_readiness = 'ADAPTIVE_READY',
         mastery_targetable = false, updated_at = now()
   where id = runtime.canonical_skill_id;
  update public.learning_bncc_discipline_journeys set publication_status = 'PUBLISHED', updated_at = now()
   where id = runtime.journey_id;
  select * into actor from public.profiles profile where profile.id = auth.uid();
  v_name := coalesce(nullif(btrim(actor.full_name), ''), actor.email, auth.uid()::text);
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    actor_id, actor_name, actor_email, reason, details
  ) values (candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
    'PUBLISHED', auth.uid(), v_name, coalesce(actor.email, ''), btrim(p_reason),
    pg_catalog.jsonb_build_object('journey_id', runtime.journey_id, 'institution_enabled', true,
      'enabled_institution_count', (select count(*) from public.learning_central_studies_v2_institution_targets target
        where target.candidate_id = candidate.id and target.enabled)));
  return pg_catalog.jsonb_build_object('publication_status', 'PUBLISHED', 'snapshot_fingerprint', candidate.snapshot_fingerprint,
    'institution_enabled', true,
    'enabled_institution_count', (select count(*) from public.learning_central_studies_v2_institution_targets target
      where target.candidate_id = candidate.id and target.enabled));
end;
$$;

create or replace function public.unpublish_central_studies_v2_candidate_v1(
  p_journey_code text, p_content_version text, p_expected_fingerprint text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare candidate public.learning_central_studies_v2_candidates%rowtype; runtime public.learning_central_studies_v2_runtime%rowtype;
  actor public.profiles%rowtype; v_name text;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 1000 then raise exception 'CENTRAL_STUDIES_V2_RELEASE_REASON_REQUIRED'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001'; end if;
  select * into runtime from public.learning_central_studies_v2_runtime row where row.candidate_id = candidate.id;
  if not found then raise exception 'CENTRAL_STUDIES_V2_RUNTIME_INTEGRATION_REQUIRED'; end if;
  update public.learning_central_studies_v2_candidates set publication_status = 'UNPUBLISHED', updated_at = now() where id = candidate.id;
  update public.learning_curriculum_skills
     set publication_status = 'STAGING', content_readiness = 'CONTENT_READY',
         mastery_targetable = false, updated_at = now()
   where id = runtime.canonical_skill_id;
  update public.learning_bncc_discipline_journeys set publication_status = 'STAGING', updated_at = now() where id = runtime.journey_id;
  select * into actor from public.profiles profile where profile.id = auth.uid();
  v_name := coalesce(nullif(btrim(actor.full_name), ''), actor.email, auth.uid()::text);
  with disabled_targets as (
    update public.learning_central_studies_v2_institution_targets target
       set enabled = false, changed_by = auth.uid(), changed_at = now(),
           change_reason = 'Despublicação da versão: ' || btrim(p_reason)
     where target.candidate_id = candidate.id and target.enabled
     returning target.institution_id, target.subject_id
  )
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    institution_id, subject_id, actor_id, actor_name, actor_email, reason, details
  ) select candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
      'INSTITUTION_DISABLED', disabled_targets.institution_id, disabled_targets.subject_id,
      auth.uid(), v_name, coalesce(actor.email, ''), 'Despublicação: ' || btrim(p_reason),
      pg_catalog.jsonb_build_object('publication_status', 'UNPUBLISHED', 'journey_id', runtime.journey_id)
    from disabled_targets;
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    actor_id, actor_name, actor_email, reason, details
  ) values (candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
    'UNPUBLISHED', auth.uid(), v_name, coalesce(actor.email, ''), btrim(p_reason),
    pg_catalog.jsonb_build_object('journey_id', runtime.journey_id,
      'enabled_institution_count', 0));
  return pg_catalog.jsonb_build_object('publication_status', 'UNPUBLISHED', 'snapshot_fingerprint', candidate.snapshot_fingerprint);
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
declare candidate public.learning_central_studies_v2_candidates%rowtype; runtime public.learning_central_studies_v2_runtime%rowtype;
  actor public.profiles%rowtype; v_name text; v_action text;
begin
  if not public.is_platform_super_admin() then raise exception 'CENTRAL_STUDIES_V2_RELEASE_FORBIDDEN' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 1000 then raise exception 'CENTRAL_STUDIES_V2_RELEASE_REASON_REQUIRED'; end if;
  select * into candidate from public.learning_central_studies_v2_candidates row
   where row.journey_code = p_journey_code and row.content_version = p_content_version for update;
  if not found then raise exception 'CENTRAL_STUDIES_V2_CANDIDATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if candidate.snapshot_fingerprint is distinct from p_expected_fingerprint then raise exception 'CENTRAL_STUDIES_V2_CONTENT_CHANGED' using errcode = '40001'; end if;
  select * into runtime from public.learning_central_studies_v2_runtime row
   where row.candidate_id = candidate.id and row.snapshot_fingerprint = candidate.snapshot_fingerprint;
  if not found then raise exception 'CENTRAL_STUDIES_V2_RUNTIME_INTEGRATION_REQUIRED'; end if;
  if candidate.review_status <> 'PEDAGOGICAL_REVIEWED'
     or candidate.review_checklist->>'reviewerCompetence' is distinct from 'true'
     or candidate.review_checklist->>'curriculumMapping' is distinct from 'true'
     or length(btrim(coalesce(candidate.review_checklist->>'reviewerCompetenceBasis', ''))) < 10 then
    raise exception 'CENTRAL_STUDIES_V2_QUALIFIED_REVIEW_REQUIRED';
  end if;
  if not exists (select 1 from public.learning_central_studies_v2_review_events event
      where event.candidate_id = candidate.id
        and event.snapshot_fingerprint = candidate.snapshot_fingerprint
        and event.decision = 'APPROVED_FOR_INTEGRATION'
        and event.reviewer_id_snapshot = candidate.reviewer_id_snapshot
        and event.checklist = candidate.review_checklist) then
    raise exception 'CENTRAL_STUDIES_V2_REVIEW_AUDIT_REQUIRED' using errcode = '55000';
  end if;
  if not exists (select 1 from public.subjects subject
      join public.learning_curriculum_subject_links subject_link
        on subject_link.institution_id = subject.institution_id and subject_link.subject_id = subject.id
       and subject_link.active and subject_link.subject_area = candidate.subject_area
     where subject.id = p_subject_id and subject.institution_id = p_institution_id and subject.active) then
    raise exception 'CENTRAL_STUDIES_V2_INSTITUTION_SUBJECT_MAPPING_REQUIRED';
  end if;
  insert into public.learning_central_studies_v2_institution_targets(
    candidate_id, institution_id, subject_id, enabled, changed_by, change_reason
  ) values (candidate.id, p_institution_id, p_subject_id, p_enabled, auth.uid(), btrim(p_reason))
  on conflict (candidate_id, institution_id) do update set subject_id = excluded.subject_id,
    enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = now(), change_reason = excluded.change_reason;
  select * into actor from public.profiles profile where profile.id = auth.uid();
  v_name := coalesce(nullif(btrim(actor.full_name), ''), actor.email, auth.uid()::text);
  v_action := case when p_enabled then 'INSTITUTION_ENABLED' else 'INSTITUTION_DISABLED' end;
  insert into public.learning_central_studies_v2_release_events(
    candidate_id, journey_code, content_version, snapshot_fingerprint, action,
    institution_id, subject_id, actor_id, actor_name, actor_email, reason, details
  ) values (candidate.id, candidate.journey_code, candidate.content_version, candidate.snapshot_fingerprint,
    v_action, p_institution_id, p_subject_id, auth.uid(), v_name, coalesce(actor.email, ''), btrim(p_reason),
    pg_catalog.jsonb_build_object('publication_status', candidate.publication_status, 'journey_id', runtime.journey_id));
  return pg_catalog.jsonb_build_object('candidate_id', candidate.id, 'institution_id', p_institution_id,
    'subject_id', p_subject_id, 'enabled', p_enabled, 'publication_status', candidate.publication_status);
end;
$$;

revoke all on function public.list_student_central_studies_v2_journeys_v1(uuid, uuid),
  public.start_central_studies_v2_journey_v1(uuid, uuid, uuid),
  public.get_central_studies_v2_release_status_v1(text, text),
  public.get_central_studies_v2_institution_targets_v1(text, text),
  public.integrate_central_studies_v2_candidate_v1(text, text, text),
  public.publish_central_studies_v2_candidate_v1(text, text, text, text),
  public.unpublish_central_studies_v2_candidate_v1(text, text, text, text),
  public.set_central_studies_v2_institution_enabled_v1(text, text, text, uuid, uuid, boolean, text)
from public, anon;
revoke all on function public.review_central_studies_v2_candidate_v1(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.list_student_central_studies_v2_journeys_v1(uuid, uuid),
  public.start_central_studies_v2_journey_v1(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_central_studies_v2_release_status_v1(text, text),
  public.get_central_studies_v2_institution_targets_v1(text, text),
  public.integrate_central_studies_v2_candidate_v1(text, text, text),
  public.publish_central_studies_v2_candidate_v1(text, text, text, text),
  public.unpublish_central_studies_v2_candidate_v1(text, text, text, text),
  public.set_central_studies_v2_institution_enabled_v1(text, text, text, uuid, uuid, boolean, text)
to authenticated;
grant execute on function public.review_central_studies_v2_candidate_v1(text, text, text, text, text, jsonb) to authenticated;

comment on table public.learning_central_studies_v2_runtime is 'Materialized V4/V9 runtime mapping for an exact human-reviewed Central Studies V2 candidate fingerprint.';
comment on table public.learning_central_studies_v2_institution_targets is 'Explicit per-institution subject authorization prepared before publication and active only while the candidate version is published.';
comment on table public.learning_central_studies_v2_release_events is 'Append-only audit trail for V2 runtime integration, publication and institution enablement.';

commit;
