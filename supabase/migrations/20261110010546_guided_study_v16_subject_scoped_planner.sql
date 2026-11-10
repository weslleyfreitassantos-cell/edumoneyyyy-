begin;

-- Only bind content to a discipline when the authored curriculum supports that
-- relationship. Broad BNCC areas are not treated as subject equivalence.
create or replace view private.learning_guided_subject_skill_bindings_v16
with (security_barrier = true)
as
  select subject.institution_id,
         subject.id as subject_id,
         skill.id as canonical_skill_id
    from public.subjects subject
    join (values
      ('MAT', 'EM13MAT101'),
      ('FIS', 'EM13CNT101')
    ) as mapping(subject_code, official_skill_code)
      on upper(btrim(coalesce(subject.code, ''))) = mapping.subject_code
    join public.learning_curriculum_skills skill
      on skill.code = mapping.official_skill_code
     and skill.active
    join public.learning_curriculum_catalogs catalog
      on catalog.id = skill.catalog_id
     and catalog.code = 'BNCC_2018'
   where subject.active;

do $guided_study_v16_scope_planner$
declare
  function_owner name;
  definition text;
  declaration_count integer;
  scope_anchor_count integer;
  subject_join_count integer;
  scoped_join_count integer;
begin
  select owner_role.rolname into function_owner
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_roles owner_role on owner_role.oid = procedure.proowner
   where procedure.oid = 'private.recommend_guided_study_v11(uuid)'::regprocedure;
  if function_owner is null then
    raise exception 'GUIDED_STUDY_V16_V11_PLANNER_MISSING';
  end if;

  execute format('grant usage on schema private to %I', function_owner);
  execute format('grant select on private.learning_guided_subject_skill_bindings_v16 to %I', function_owner);

  definition := pg_get_functiondef('private.recommend_guided_study_v11(uuid)'::regprocedure);
  declaration_count := (length(definition) - length(replace(definition, 'v_grade_label text;', ''))) /
    length('v_grade_label text;');
  scope_anchor_count := (length(definition) - length(replace(definition,
    'if p_institution_id is null or auth.uid() is null then', ''))) /
    length('if p_institution_id is null or auth.uid() is null then');
  subject_join_count := (length(definition) - length(replace(definition,
    'and subject_link.subject_area = target.subject_area', ''))) /
    length('and subject_link.subject_area = target.subject_area');
  scoped_join_count := (length(definition) - length(replace(definition,
    'private.learning_guided_subject_skill_bindings_v16 binding', ''))) /
    length('private.learning_guided_subject_skill_bindings_v16 binding');

  if declaration_count = 1 and scope_anchor_count = 1 and subject_join_count = 3 and scoped_join_count = 0 then
    definition := replace(definition, 'v_grade_label text;',
      'v_grade_label text; v_requested_subject_id uuid;');
    definition := replace(definition,
      'if p_institution_id is null or auth.uid() is null then',
      'v_requested_subject_id := case when current_setting(''app.guided_study_v16_subject_id'', true) ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' then current_setting(''app.guided_study_v16_subject_id'', true)::uuid else null end;' || E'\n  if p_institution_id is null or auth.uid() is null then');
    definition := replace(definition,
      'and subject_link.subject_area = target.subject_area',
      'and subject_link.subject_area = target.subject_area' || E'\n' ||
      '          and (v_requested_subject_id is null or (' || E'\n' ||
      '            subject_link.subject_id = v_requested_subject_id' || E'\n' ||
      '            and exists (' || E'\n' ||
      '              select 1 from private.learning_guided_subject_skill_bindings_v16 binding' || E'\n' ||
      '               where binding.institution_id = p_institution_id' || E'\n' ||
      '                 and binding.subject_id = subject_link.subject_id' || E'\n' ||
      '                 and binding.canonical_skill_id = target.target_canonical_skill_id' || E'\n' ||
      '            )' || E'\n' ||
      '          ))');
  elsif declaration_count = 1 and scope_anchor_count = 1 and subject_join_count = 3 and scoped_join_count = 3 then
    null;
  else
    raise exception 'GUIDED_STUDY_V16_V11_SOURCE_SHAPE_CHANGED declarations=% scope_anchor=% subject_joins=% scoped_joins=%',
      declaration_count, scope_anchor_count, subject_join_count, scoped_join_count;
  end if;

  execute definition;
end;
$guided_study_v16_scope_planner$;

create or replace function public.get_guided_study_subject_overview_v16(
  p_institution_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_subject_scope text;
  recommendation jsonb;
  v_subject_name text;
  v_student_id uuid;
  v_topic_title text;
  v_open_session record;
begin
  if auth.uid() is null or p_institution_id is null or p_subject_id is null then
    return jsonb_build_object('state', 'SUBJECT_NOT_AVAILABLE',
      'reason', 'Esta matéria não está disponível para sua matrícula.');
  end if;

  select subject.name into v_subject_name
    from public.subjects subject
   where subject.id = p_subject_id
     and subject.institution_id = p_institution_id
     and subject.active
     and exists (
       select 1
         from public.students student
         join public.enrollments enrollment
           on enrollment.student_id = student.id and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
         join public.academic_years academic_year
           on academic_year.id = enrollment.academic_year_id
          and academic_year.institution_id = p_institution_id and academic_year.active
         join public.classes class
           on class.id = enrollment.class_id and class.institution_id = p_institution_id
          and class.academic_year_id = enrollment.academic_year_id and class.active
         join public.subject_offerings offering
           on offering.class_id = class.id and offering.subject_id = p_subject_id and offering.active
        where student.profile_id = auth.uid()
          and student.institution_id = p_institution_id and student.active
     );
  if v_subject_name is null then
    return jsonb_build_object('state', 'SUBJECT_NOT_AVAILABLE',
      'reason', 'Esta matéria não está disponível para sua matrícula.');
  end if;

  previous_subject_scope := current_setting('app.guided_study_v16_subject_id', true);
  perform set_config('app.guided_study_v16_subject_id', p_subject_id::text, true);
  recommendation := private.recommend_guided_study_v11(p_institution_id);
  perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);

  v_student_id := nullif(recommendation->>'student_id', '')::uuid;
  if recommendation->>'state' = 'READY' and v_student_id is not null then
    select session.id, session.subject_id into v_open_session
      from public.learning_guided_sessions session
     where session.institution_id = p_institution_id
       and session.student_id = v_student_id
       and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
       and coalesce(session.metadata->>'demo_preview', 'false') <> 'true'
       and coalesce(session.metadata->>'demo_preview_only', 'false') <> 'true'
       and coalesce(session.metadata->>'demonstration_only', 'false') <> 'true'
     order by session.updated_at desc
     limit 1;
    if found then
      return jsonb_build_object(
        'state', 'ACTIVE_SESSION_OTHER_SUBJECT',
        'session_id', v_open_session.id,
        'session_subject_id', v_open_session.subject_id,
        'subject_id', p_subject_id,
        'subject_name', v_subject_name,
        'reason', 'Você já tem uma jornada salva. Retome-a antes de iniciar outra matéria.'
      );
    end if;
  end if;

  if recommendation->>'state' = 'ACTIVE' and recommendation->>'session_id' is not null then
    select coalesce(current_skill.title, target_skill.title)
      into v_topic_title
      from public.learning_guided_sessions session
      join public.learning_curriculum_skills target_skill
        on target_skill.id = session.target_canonical_skill_id
      left join public.learning_curriculum_skills current_skill
        on current_skill.id = session.current_canonical_skill_id
     where session.id = (recommendation->>'session_id')::uuid
       and session.institution_id = p_institution_id
       and session.student_id = v_student_id;
  elsif recommendation->>'target_canonical_skill_id' is not null then
    select skill.title into v_topic_title
      from public.learning_curriculum_skills skill
     where skill.id = (recommendation->>'target_canonical_skill_id')::uuid;
  end if;

  return (recommendation - 'student_id' - 'target_canonical_skill_id') || jsonb_build_object(
    'subject_id', p_subject_id,
    'subject_name', v_subject_name,
    'topic_title', v_topic_title
  );
end;
$$;

create or replace function public.start_guided_study_subject_v16(
  p_institution_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_subject_scope text;
  recommendation jsonb;
  started jsonb;
  v_subject_name text;
  v_student_id uuid;
  v_open_session record;
  v_topic_title text;
begin
  if auth.uid() is null or p_institution_id is null or p_subject_id is null then
    return jsonb_build_object('state', 'SUBJECT_NOT_AVAILABLE',
      'reason', 'Esta matéria não está disponível para sua matrícula.');
  end if;

  select subject.name into v_subject_name
    from public.subjects subject
   where subject.id = p_subject_id
     and subject.institution_id = p_institution_id
     and subject.active
     and exists (
       select 1
         from public.students student
         join public.enrollments enrollment
           on enrollment.student_id = student.id and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
         join public.academic_years academic_year
           on academic_year.id = enrollment.academic_year_id
          and academic_year.institution_id = p_institution_id and academic_year.active
         join public.classes class
           on class.id = enrollment.class_id and class.institution_id = p_institution_id
          and class.academic_year_id = enrollment.academic_year_id and class.active
         join public.subject_offerings offering
           on offering.class_id = class.id and offering.subject_id = p_subject_id and offering.active
        where student.profile_id = auth.uid()
          and student.institution_id = p_institution_id and student.active
     );
  if v_subject_name is null then
    return jsonb_build_object('state', 'SUBJECT_NOT_AVAILABLE',
      'reason', 'Esta matéria não está disponível para sua matrícula.');
  end if;

  previous_subject_scope := current_setting('app.guided_study_v16_subject_id', true);
  perform set_config('app.guided_study_v16_subject_id', p_subject_id::text, true);
  recommendation := private.recommend_guided_study_v11(p_institution_id);
  v_student_id := nullif(recommendation->>'student_id', '')::uuid;

  if v_student_id is null then
    perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);
    return (recommendation - 'student_id' - 'target_canonical_skill_id') || jsonb_build_object(
      'subject_id', p_subject_id, 'subject_name', v_subject_name);
  end if;

  -- Serialize all subject starts for this student, then recompute eligibility
  -- before checking for an existing session. V11 takes the same lock below.
  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || p_institution_id::text, 0));
  recommendation := private.recommend_guided_study_v11(p_institution_id);
  v_student_id := nullif(recommendation->>'student_id', '')::uuid;

  if v_student_id is null then
    perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);
    return (recommendation - 'student_id' - 'target_canonical_skill_id') || jsonb_build_object(
      'subject_id', p_subject_id, 'subject_name', v_subject_name);
  end if;

  if recommendation->>'state' = 'READY' and v_student_id is not null then
    select session.id, session.subject_id into v_open_session
      from public.learning_guided_sessions session
     where session.institution_id = p_institution_id
       and session.student_id = v_student_id
       and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
       and coalesce(session.metadata->>'demo_preview', 'false') <> 'true'
       and coalesce(session.metadata->>'demo_preview_only', 'false') <> 'true'
       and coalesce(session.metadata->>'demonstration_only', 'false') <> 'true'
     order by session.updated_at desc
     limit 1;
    if found then
      perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);
      return jsonb_build_object(
        'state', 'ACTIVE_SESSION_OTHER_SUBJECT',
        'session_id', v_open_session.id,
        'session_subject_id', v_open_session.subject_id,
        'subject_id', p_subject_id,
        'subject_name', v_subject_name,
        'reason', 'Você já tem uma jornada salva. Retome-a antes de iniciar outra matéria.'
      );
    end if;
  end if;

  if recommendation->>'state' <> 'READY' and recommendation->>'state' <> 'ACTIVE' then
    perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);
    return (recommendation - 'student_id' - 'target_canonical_skill_id') || jsonb_build_object(
      'subject_id', p_subject_id, 'subject_name', v_subject_name);
  end if;

  started := public.start_guided_study_v11(p_institution_id);
  perform set_config('app.guided_study_v16_subject_id', coalesce(previous_subject_scope, ''), true);

  if started->>'session_id' is not null and v_student_id is not null then
    update public.learning_guided_sessions session
       set subject_id = p_subject_id,
           metadata = coalesce(session.metadata, '{}'::jsonb) || jsonb_build_object(
             'subject_scope_version', 'V16', 'subject_scope_id', p_subject_id)
     where session.id = (started->>'session_id')::uuid
       and session.institution_id = p_institution_id
       and session.student_id = v_student_id
       and exists (
         select 1
           from private.learning_guided_subject_skill_bindings_v16 binding
          where binding.institution_id = p_institution_id
            and binding.subject_id = p_subject_id
            and binding.canonical_skill_id = session.target_canonical_skill_id
       );
    select coalesce(current_skill.title, target_skill.title)
      into v_topic_title
      from public.learning_guided_sessions session
      join public.learning_curriculum_skills target_skill
        on target_skill.id = session.target_canonical_skill_id
      left join public.learning_curriculum_skills current_skill
        on current_skill.id = session.current_canonical_skill_id
     where session.id = (started->>'session_id')::uuid
       and session.institution_id = p_institution_id
       and session.student_id = v_student_id;
  elsif recommendation->>'target_canonical_skill_id' is not null then
    select skill.title into v_topic_title
      from public.learning_curriculum_skills skill
     where skill.id = (recommendation->>'target_canonical_skill_id')::uuid;
  end if;

  return (started - 'student_id' - 'target_canonical_skill_id') || jsonb_build_object(
    'subject_id', p_subject_id,
    'subject_name', v_subject_name,
    'topic_title', v_topic_title
  );
end;
$$;

revoke all on function public.get_guided_study_subject_overview_v16(uuid, uuid) from public, anon;
revoke all on function public.start_guided_study_subject_v16(uuid, uuid) from public, anon;
grant execute on function public.get_guided_study_subject_overview_v16(uuid, uuid) to authenticated;
grant execute on function public.start_guided_study_subject_v16(uuid, uuid) to authenticated;

comment on function public.get_guided_study_subject_overview_v16(uuid, uuid) is
  'Returns the V11 guided-study recommendation scoped to one enrolled discipline and its explicit canonical-skill bindings.';
comment on function public.start_guided_study_subject_v16(uuid, uuid) is
  'Resumes or starts the existing V11/V4 adaptive journey for one enrolled discipline without creating a parallel active session.';

notify pgrst, 'reload schema';
commit;
