begin;

create or replace function private.recommend_guided_study_v11(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_ids uuid[];
  v_student_id uuid;
  v_enrollment_count integer;
  v_stage text;
  v_grade_level smallint;
  v_target_count integer;
  v_eligible_count integer;
  v_mastered_count integer;
  v_evidence_count integer;
  v_session record;
  v_target record;
  v_state text;
  v_grade_label text;
begin
  if p_institution_id is null or auth.uid() is null then
    return jsonb_build_object('state', 'NO_STUDENT_PROFILE', 'reason', 'Entre com uma conta de estudante vinculada à instituição.');
  end if;

  select coalesce(array_agg(student.id), '{}'::uuid[])
    into student_ids
    from public.students student
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active;

  if cardinality(student_ids) = 0 then
    return jsonb_build_object('state', 'NO_STUDENT_PROFILE', 'reason', 'Não encontramos um perfil de estudante ativo nesta instituição.');
  end if;
  if cardinality(student_ids) > 1 then
    return jsonb_build_object('state', 'AMBIGUOUS_STUDENT', 'reason', 'Há mais de um perfil de estudante vinculado à sua conta. Peça à secretaria para revisar o vínculo.');
  end if;

  v_student_id := student_ids[1];
  if not private.learning_v2_scope_student(p_institution_id, v_student_id) then
    return jsonb_build_object('state', 'NO_STUDENT_PROFILE', 'reason', 'Esta conta não tem acesso ao Estudo Guiado nesta instituição.');
  end if;

  select count(distinct enrollment.id)::integer
    into v_enrollment_count
    from public.enrollments enrollment
    join public.academic_years academic_year
      on academic_year.id = enrollment.academic_year_id
     and academic_year.institution_id = p_institution_id
     and academic_year.active
    join public.classes class
      on class.id = enrollment.class_id
     and class.institution_id = p_institution_id
     and class.academic_year_id = enrollment.academic_year_id
     and class.active
   where enrollment.student_id = v_student_id
     and enrollment.active
     and upper(enrollment.status::text) = 'ACTIVE';

  if v_enrollment_count = 0 then
    return jsonb_build_object('state', 'NO_ACTIVE_ENROLLMENT', 'reason', 'Não há matrícula ativa em um ano letivo vigente.');
  end if;
  if v_enrollment_count > 1 then
    return jsonb_build_object('state', 'AMBIGUOUS_ENROLLMENT', 'reason', 'Encontramos mais de uma matrícula ativa em anos letivos vigentes. A secretaria precisa confirmar sua turma antes do estudo.');
  end if;

  select normalized.value->>'stage', nullif(normalized.value->>'grade_level', '')::smallint
    into v_stage, v_grade_level
    from public.enrollments enrollment
    join public.academic_years academic_year
      on academic_year.id = enrollment.academic_year_id
     and academic_year.institution_id = p_institution_id
     and academic_year.active
    join public.classes class
      on class.id = enrollment.class_id
     and class.institution_id = p_institution_id
     and class.academic_year_id = enrollment.academic_year_id
     and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
   where enrollment.student_id = v_student_id
     and enrollment.active
     and upper(enrollment.status::text) = 'ACTIVE'
   limit 1;

  if v_stage is null or v_grade_level is null then
    return jsonb_build_object('state', 'GRADE_NOT_SUPPORTED', 'reason', 'Não foi possível identificar sua etapa e série pela matrícula ativa.');
  end if;

  v_grade_label := case v_stage
    when 'ENSINO_FUNDAMENTAL' then format('%sº ano do Ensino Fundamental', v_grade_level)
    when 'ENSINO_MEDIO' then format('%sª série do Ensino Médio', v_grade_level)
    else null
  end;
  if v_grade_label is null then
    return jsonb_build_object('state', 'GRADE_NOT_SUPPORTED', 'reason', 'Sua etapa escolar ainda não está configurada para o Estudo Guiado.');
  end if;

  select count(*)::integer
    into v_target_count
    from public.list_student_guided_learning_targets(p_institution_id, v_student_id) target
   where target.stage = v_stage
     and target.grade_level = v_grade_level;

  if v_target_count = 0 then
    return jsonb_build_object(
      'state', 'NO_BNCC_MAPPING', 'stage', v_stage, 'grade_level', v_grade_level,
      'grade_label', v_grade_label, 'reason', 'Ainda não há habilidades BNCC mapeadas para sua série.'
    );
  end if;

  select count(*)::integer
    into v_evidence_count
    from public.learning_skill_evidence evidence
   where evidence.institution_id = p_institution_id
     and evidence.student_id = v_student_id;

  select count(*)::integer,
         count(*) filter (where state.state = 'MASTERED')::integer
    into v_eligible_count, v_mastered_count
    from public.list_student_guided_learning_targets(p_institution_id, v_student_id) target
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id
     and state.student_id = v_student_id
     and state.canonical_skill_id = target.target_canonical_skill_id
   where target.stage = v_stage
     and target.grade_level = v_grade_level
     and target.availability_status in ('READY', 'NO_ACTIVE_SESSION')
     and target.has_lesson
     and target.question_count > 0
     and (v_evidence_count > 0 or exists (
       select 1
         from public.learning_question_sets question_set
        where question_set.scope = 'GLOBAL'
          and question_set.institution_id is null
          and question_set.teacher_profile_id is null
          and question_set.canonical_skill_id = target.target_canonical_skill_id
          and question_set.purpose = 'PROBE'
          and question_set.version = 4
          and question_set.active
          and coalesce(question_set.metadata->>'demo_preview', 'false') <> 'true'
          and coalesce(question_set.metadata->>'demo_preview_only', 'false') <> 'true'
          and coalesce(question_set.metadata->>'demonstration_only', 'false') <> 'true'
          and exists (
            select 1
              from public.learning_question_set_items item
              join public.learning_question_bank bank
                on bank.id = item.question_bank_id
               and bank.active
               and coalesce(bank.metadata->>'demo_preview', 'false') <> 'true'
               and coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'
               and coalesce(bank.metadata->>'demonstration_only', 'false') <> 'true'
             where item.question_set_id = question_set.id
          )
     ))
     and exists (
       select 1
         from public.enrollments enrollment
         join public.academic_years academic_year
           on academic_year.id = enrollment.academic_year_id
          and academic_year.institution_id = p_institution_id
          and academic_year.active
         join public.classes class
           on class.id = enrollment.class_id
          and class.institution_id = p_institution_id
          and class.academic_year_id = enrollment.academic_year_id
          and class.active
         join public.subject_offerings offering
           on offering.class_id = class.id and offering.active
         join public.learning_curriculum_subject_links subject_link
           on subject_link.institution_id = p_institution_id
          and subject_link.subject_id = offering.subject_id
          and subject_link.subject_area = target.subject_area
          and subject_link.active
        where enrollment.student_id = v_student_id
          and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
     );

  if v_eligible_count = 0 then
    return jsonb_build_object(
      'state', 'NO_ELIGIBLE_CONTENT', 'stage', v_stage, 'grade_level', v_grade_level,
      'grade_label', v_grade_label, 'has_progress', v_evidence_count > 0,
      'reason', 'Ainda não há conteúdo BNCC publicado e aprovado para iniciar sua próxima etapa. Seu progresso anterior foi preservado.'
    );
  end if;

  select session.id, session.status, session.current_step_id,
         session.target_canonical_skill_id, session.updated_at
    into v_session
    from public.list_student_guided_learning_targets(p_institution_id, v_student_id) target
    join public.learning_guided_sessions session
      on session.institution_id = p_institution_id
     and session.student_id = v_student_id
     and session.target_canonical_skill_id = target.target_canonical_skill_id
     and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
     and coalesce(session.metadata->>'demo_preview', 'false') <> 'true'
     and coalesce(session.metadata->>'demo_preview_only', 'false') <> 'true'
     and coalesce(session.metadata->>'demonstration_only', 'false') <> 'true'
   where target.stage = v_stage
     and target.grade_level = v_grade_level
     and target.availability_status in ('READY', 'NO_ACTIVE_SESSION')
     and target.has_lesson
     and target.question_count > 0
     and exists (
       select 1
         from public.enrollments enrollment
         join public.academic_years academic_year
           on academic_year.id = enrollment.academic_year_id
          and academic_year.institution_id = p_institution_id
          and academic_year.active
         join public.classes class
           on class.id = enrollment.class_id
          and class.institution_id = p_institution_id
          and class.academic_year_id = enrollment.academic_year_id
          and class.active
         join public.subject_offerings offering
           on offering.class_id = class.id and offering.active
         join public.learning_curriculum_subject_links subject_link
           on subject_link.institution_id = p_institution_id
          and subject_link.subject_id = offering.subject_id
          and subject_link.subject_area = target.subject_area
          and subject_link.active
        where enrollment.student_id = v_student_id
          and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
     )
   order by session.updated_at desc
   limit 1;

  if found then
    v_state := case when v_session.status = 'NEEDS_TEACHER_SUPPORT' then 'NEEDS_TEACHER_SUPPORT' else 'ACTIVE' end;
    return jsonb_build_object(
      'state', v_state, 'action', case when v_session.status = 'PAUSED' then 'RESUME' else 'CONTINUE' end,
      'student_id', v_student_id, 'stage', v_stage, 'grade_level', v_grade_level,
      'grade_label', v_grade_label, 'has_progress', v_evidence_count > 0,
      'skills_total', v_eligible_count, 'skills_mastered', v_mastered_count,
      'progress_percent', round((v_mastered_count::numeric * 100) / nullif(v_eligible_count, 0)),
      'session_id', v_session.id, 'session_status', v_session.status,
      'current_step_id', v_session.current_step_id,
      'target_canonical_skill_id', v_session.target_canonical_skill_id
    );
  end if;

  select target.target_canonical_skill_id, target.subject_area
    into v_target
    from public.list_student_guided_learning_targets(p_institution_id, v_student_id) target
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id
     and state.student_id = v_student_id
     and state.canonical_skill_id = target.target_canonical_skill_id
    left join lateral (
      select review.review_due_at
        from public.learning_skill_reviews review
       where review.institution_id = p_institution_id
         and review.student_id = v_student_id
         and review.canonical_skill_id = target.target_canonical_skill_id
         and review.completed_at is null
         and review.review_due_at <= now()
       order by review.review_due_at
       limit 1
    ) due_review on true
   where target.stage = v_stage
     and target.grade_level = v_grade_level
     and target.availability_status in ('READY', 'NO_ACTIVE_SESSION')
     and target.has_lesson
     and target.question_count > 0
     and (v_evidence_count > 0 or exists (
       select 1
         from public.learning_question_sets question_set
        where question_set.scope = 'GLOBAL'
          and question_set.institution_id is null
          and question_set.teacher_profile_id is null
          and question_set.canonical_skill_id = target.target_canonical_skill_id
          and question_set.purpose = 'PROBE'
          and question_set.version = 4
          and question_set.active
          and coalesce(question_set.metadata->>'demo_preview', 'false') <> 'true'
          and coalesce(question_set.metadata->>'demo_preview_only', 'false') <> 'true'
          and coalesce(question_set.metadata->>'demonstration_only', 'false') <> 'true'
          and exists (
            select 1
              from public.learning_question_set_items item
              join public.learning_question_bank bank
                on bank.id = item.question_bank_id
               and bank.active
               and coalesce(bank.metadata->>'demo_preview', 'false') <> 'true'
               and coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'
               and coalesce(bank.metadata->>'demonstration_only', 'false') <> 'true'
             where item.question_set_id = question_set.id
          )
     ))
     and exists (
       select 1
         from public.enrollments enrollment
         join public.academic_years academic_year
           on academic_year.id = enrollment.academic_year_id
          and academic_year.institution_id = p_institution_id
          and academic_year.active
         join public.classes class
           on class.id = enrollment.class_id
          and class.institution_id = p_institution_id
          and class.academic_year_id = enrollment.academic_year_id
          and class.active
         join public.subject_offerings offering
           on offering.class_id = class.id and offering.active
         join public.learning_curriculum_subject_links subject_link
           on subject_link.institution_id = p_institution_id
          and subject_link.subject_id = offering.subject_id
          and subject_link.subject_area = target.subject_area
          and subject_link.active
        where enrollment.student_id = v_student_id
          and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
     )
   order by
     case when due_review.review_due_at is not null then 0 else 1 end,
     case state.state when 'NEEDS_REVIEW' then 0 when 'PRACTICING' then 1 when 'LEARNING' then 2 when 'INTRODUCED' then 3 when 'UNKNOWN' then 4 when 'MASTERED' then 5 else 4 end,
     (select count(*)
        from public.learning_student_skill_state coverage
        join public.learning_curriculum_skills covered_skill on covered_skill.id = coverage.canonical_skill_id
       where coverage.institution_id = p_institution_id
         and coverage.student_id = v_student_id
         and covered_skill.subject_area = target.subject_area),
     hashtextextended(v_student_id::text || ':' || coalesce(target.subject_area, ''), 0),
     target.official_code
   limit 1;

  if not found then
    return jsonb_build_object(
      'state', 'NO_ELIGIBLE_CONTENT', 'stage', v_stage, 'grade_level', v_grade_level,
      'grade_label', v_grade_label, 'has_progress', v_evidence_count > 0,
      'reason', 'Não foi possível selecionar uma habilidade BNCC publicada para sua série.'
    );
  end if;

  return jsonb_build_object(
    'state', 'READY', 'action', case when v_evidence_count > 0 then 'CONTINUE' else 'START' end,
    'student_id', v_student_id, 'stage', v_stage, 'grade_level', v_grade_level,
    'grade_label', v_grade_label, 'has_progress', v_evidence_count > 0,
    'skills_total', v_eligible_count, 'skills_mastered', v_mastered_count,
    'progress_percent', round((v_mastered_count::numeric * 100) / nullif(v_eligible_count, 0)),
    'target_canonical_skill_id', v_target.target_canonical_skill_id
  );
end;
$$;

create or replace function public.get_guided_study_overview_v11(p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.recommend_guided_study_v11(p_institution_id)
    - 'student_id'
    - 'target_canonical_skill_id';
$$;

create or replace function public.start_guided_study_v11(p_institution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation jsonb;
  started jsonb;
  session_row public.learning_guided_sessions%rowtype;
  v_probe_question_set_id uuid;
  v_student_id uuid;
  v_initial_diagnostic boolean;
begin
  recommendation := private.recommend_guided_study_v11(p_institution_id);
  v_student_id := nullif(recommendation->>'student_id', '')::uuid;
  if v_student_id is null then
    return recommendation - 'student_id' - 'target_canonical_skill_id';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || p_institution_id::text, 0));
  recommendation := private.recommend_guided_study_v11(p_institution_id);

  if recommendation->>'state' = 'ACTIVE' then
    if recommendation->>'session_status' = 'PAUSED' then
      update public.learning_guided_sessions
         set status = 'ACTIVE', updated_at = now()
       where id = (recommendation->>'session_id')::uuid
         and institution_id = p_institution_id
         and student_id = v_student_id
         and status = 'PAUSED';
      recommendation := recommendation || jsonb_build_object('session_status', 'ACTIVE', 'action', 'RESUME');
    end if;
    return recommendation - 'student_id' - 'target_canonical_skill_id';
  end if;
  if recommendation->>'state' <> 'READY' then
    return recommendation - 'student_id' - 'target_canonical_skill_id';
  end if;

  started := public.start_bncc_guided_learning_session_v4(
    p_institution_id,
    v_student_id,
    (recommendation->>'target_canonical_skill_id')::uuid
  );
  if coalesce((started->>'created')::boolean, false) then
    v_initial_diagnostic := not coalesce((recommendation->>'has_progress')::boolean, false);
    if v_initial_diagnostic then
      select question_set.id
        into v_probe_question_set_id
        from public.learning_question_sets question_set
       where question_set.scope = 'GLOBAL'
         and question_set.institution_id is null
         and question_set.teacher_profile_id is null
         and question_set.canonical_skill_id = (recommendation->>'target_canonical_skill_id')::uuid
         and question_set.purpose = 'PROBE'
         and question_set.version = 4
         and question_set.active
         and coalesce(question_set.metadata->>'demo_preview', 'false') <> 'true'
         and coalesce(question_set.metadata->>'demo_preview_only', 'false') <> 'true'
         and coalesce(question_set.metadata->>'demonstration_only', 'false') <> 'true'
         and exists (
           select 1
             from public.learning_question_set_items item
             join public.learning_question_bank bank
               on bank.id = item.question_bank_id
              and bank.active
              and coalesce(bank.metadata->>'demo_preview', 'false') <> 'true'
              and coalesce(bank.metadata->>'demo_preview_only', 'false') <> 'true'
              and coalesce(bank.metadata->>'demonstration_only', 'false') <> 'true'
            where item.question_set_id = question_set.id
         )
       order by question_set.id
       limit 1;

      if v_probe_question_set_id is null then
        raise exception 'GUIDED_STUDY_V11_DIAGNOSTIC_SET_NOT_FOUND';
      end if;

      update public.learning_guided_steps
         set step_type = 'PROBE',
             purpose = 'PROBE',
             lesson_id = null,
             question_set_id = v_probe_question_set_id
       where id = (started->>'current_step_id')::uuid
         and session_id = (started->>'session_id')::uuid
         and status = 'ACTIVE';
      if not found then
        raise exception 'GUIDED_STUDY_V11_DIAGNOSTIC_STEP_NOT_FOUND';
      end if;
    end if;

    update public.learning_guided_sessions
       set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'orchestration_version', 'V11', 'initial_diagnostic', v_initial_diagnostic
       )
     where id = (started->>'session_id')::uuid
       and institution_id = p_institution_id
       and student_id = v_student_id;
    update public.learning_guided_session_events
       set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
         'step_type', case when v_initial_diagnostic then 'PROBE' else payload->>'step_type' end,
         'orchestration_version', 'V11', 'initial_diagnostic', v_initial_diagnostic
       )
     where session_id = (started->>'session_id')::uuid
       and step_id = (started->>'current_step_id')::uuid
       and event_type = 'STEP_STARTED';
  end if;
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = (started->>'session_id')::uuid
     and session.institution_id = p_institution_id
     and session.student_id = v_student_id;
  if not found then
    raise exception 'GUIDED_STUDY_V11_SESSION_NOT_FOUND';
  end if;

  return recommendation || jsonb_build_object(
    'state', 'ACTIVE', 'action', case when coalesce((started->>'created')::boolean, false) then 'START' else 'RESUME' end,
    'created', coalesce((started->>'created')::boolean, false),
    'session_id', session_row.id, 'session_status', session_row.status,
    'current_step_id', session_row.current_step_id
  ) - 'student_id' - 'target_canonical_skill_id';
end;
$$;

create or replace function public.pause_guided_study_v11(p_institution_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_ids uuid[];
  v_student_id uuid;
  session_status text;
begin
  select coalesce(array_agg(student.id), '{}'::uuid[])
    into student_ids
    from public.students student
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active;
  if cardinality(student_ids) <> 1 then
    raise exception 'GUIDED_STUDY_V11_STUDENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  v_student_id := student_ids[1];
  if not private.learning_v2_scope_student(p_institution_id, v_student_id) then
    raise exception 'GUIDED_STUDY_V11_STUDENT_SCOPE_DENIED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || p_institution_id::text, 0));
  select session.status into session_status
    from public.learning_guided_sessions session
   where session.id = p_session_id
     and session.institution_id = p_institution_id
     and session.student_id = v_student_id
   for update;
  if not found then
    raise exception 'GUIDED_STUDY_V11_SESSION_NOT_FOUND' using errcode = '42501';
  end if;
  if session_status = 'PAUSED' then
    return jsonb_build_object('session_id', p_session_id, 'status', 'PAUSED', 'idempotent', true);
  end if;
  if session_status <> 'ACTIVE' then
    raise exception 'GUIDED_STUDY_V11_SESSION_NOT_ACTIVE';
  end if;

  update public.learning_guided_sessions
     set status = 'PAUSED', updated_at = now()
   where id = p_session_id
     and institution_id = p_institution_id
     and student_id = v_student_id;
  return jsonb_build_object('session_id', p_session_id, 'status', 'PAUSED', 'idempotent', false);
end;
$$;

revoke all on function private.recommend_guided_study_v11(uuid) from public, anon, authenticated;
revoke all on function public.get_guided_study_overview_v11(uuid) from public, anon;
revoke all on function public.start_guided_study_v11(uuid) from public, anon;
revoke all on function public.pause_guided_study_v11(uuid, uuid) from public, anon;
grant execute on function public.get_guided_study_overview_v11(uuid) to authenticated;
grant execute on function public.start_guided_study_v11(uuid) to authenticated;
grant execute on function public.pause_guided_study_v11(uuid, uuid) to authenticated;

comment on function public.get_guided_study_overview_v11(uuid) is 'Returns the authenticated student’s server-resolved grade, published BNCC availability, progress summary and active guided session.';
comment on function public.start_guided_study_v11(uuid) is 'Idempotently resumes the student’s eligible session or chooses and starts the next published BNCC skill using the existing V4 adaptive engine.';
comment on function public.pause_guided_study_v11(uuid, uuid) is 'Pauses only the authenticated student’s own active guided session.';

notify pgrst, 'reload schema';
commit;
