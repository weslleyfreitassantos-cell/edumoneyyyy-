-- Extend account hard-delete coverage to the domains introduced after the
-- original destructive-actions migration. The probe savepoint preserves the
-- original validation contract without duplicating its business rules.

alter function public.hard_delete_client_account(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean
) rename to hard_delete_client_account_legacy;

create or replace function public.delete_client_account_new_domains(
  target_institution_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_rows int;
  summary jsonb := '{}'::jsonb;
begin
  delete from public.learning_post_attachments
   where post_id in (
     select id from public.learning_posts
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPostAttachments', deleted_rows);

  delete from public.learning_post_reads
   where post_id in (
     select id from public.learning_posts
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPostReads', deleted_rows);

  delete from public.learning_guided_session_events
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningGuidedSessionEvents', deleted_rows);

  delete from public.learning_guided_step_attempts
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningGuidedStepAttempts', deleted_rows);

  delete from public.learning_daily_plan_items
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningDailyPlanItems', deleted_rows);

  delete from public.learning_attempt_run_answers
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningAttemptRunAnswers', deleted_rows);

  delete from public.learning_answers
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningAnswers', deleted_rows);

  delete from public.learning_evidence_attributions
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningEvidenceAttributions', deleted_rows);

  delete from public.learning_question_option_misconceptions
   where question_bank_id in (
     select id from public.learning_question_bank
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionOptionMisconceptions', deleted_rows);

  delete from public.learning_question_misconception_links
   where question_id in (
     select id from public.learning_questions
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionMisconceptionLinks', deleted_rows);

  delete from public.learning_question_set_items
   where question_set_id in (
     select id from public.learning_question_sets
      where institution_id = any(target_institution_ids)
   )
   or question_bank_id in (
     select id from public.learning_question_bank
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionSetItems', deleted_rows);

  delete from public.learning_question_bank_skill_links
   where question_bank_id in (
     select id from public.learning_question_bank
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionBankSkillLinks', deleted_rows);

  delete from public.learning_simulation_questions
   where simulation_id in (
     select id from public.learning_simulations
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSimulationQuestions', deleted_rows);

  delete from public.learning_package_steps
   where package_id in (
     select id from public.learning_packages
      where institution_id = any(target_institution_ids)
   );
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPackageSteps', deleted_rows);

  delete from public.learning_resources
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningResources', deleted_rows);

  delete from public.learning_skill_evidence
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSkillEvidence', deleted_rows);

  delete from public.learning_misconception_signals
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningMisconceptionSignals', deleted_rows);

  delete from public.learning_gamification_events
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningGamificationEvents', deleted_rows);

  delete from public.learning_error_notebook
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningErrorNotebook', deleted_rows);

  delete from public.learning_skill_reviews
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSkillReviews', deleted_rows);

  delete from public.learning_skill_progress
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSkillProgress', deleted_rows);

  delete from public.learning_student_skill_state
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningStudentSkillState', deleted_rows);

  delete from public.learning_student_gamification
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningStudentGamification', deleted_rows);

  delete from public.learning_simulation_attempts
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSimulationAttempts', deleted_rows);

  delete from public.learning_attempt_runs
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningAttemptRuns', deleted_rows);

  delete from public.learning_attempts
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningAttempts', deleted_rows);

  delete from public.learning_guided_steps
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningGuidedSteps', deleted_rows);

  delete from public.learning_guided_sessions
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningGuidedSessions', deleted_rows);

  delete from public.learning_daily_plans
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningDailyPlans', deleted_rows);

  delete from public.learning_package_assignments
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPackageAssignments', deleted_rows);

  delete from public.learning_package_progress
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPackageProgress', deleted_rows);

  delete from public.learning_question_skill_links
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionSkillLinks', deleted_rows);

  delete from public.learning_question_sets
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionSets', deleted_rows);

  delete from public.learning_questions
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestions', deleted_rows);

  delete from public.learning_assignments
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningAssignments', deleted_rows);

  delete from public.learning_activities
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningActivities', deleted_rows);

  delete from public.learning_packages
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPackages', deleted_rows);

  delete from public.learning_simulations
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSimulations', deleted_rows);

  delete from public.learning_collections
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningCollections', deleted_rows);

  delete from public.learning_question_bank
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningQuestionBank', deleted_rows);

  delete from public.learning_skill_canonical_links
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSkillCanonicalLinks', deleted_rows);

  delete from public.learning_curriculum_subject_links
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningCurriculumSubjectLinks', deleted_rows);

  delete from public.learning_skills
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningSkills', deleted_rows);

  delete from public.learning_units
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningUnits', deleted_rows);

  delete from public.learning_posts
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('learningPosts', deleted_rows);

  delete from public.timetable_version_entries
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('timetableVersionEntries', deleted_rows);

  delete from public.timetable_versions
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('timetableVersions', deleted_rows);

  return summary;
end;
$$;

revoke all on function public.delete_client_account_new_domains(uuid[]) from public, anon, authenticated;

create or replace function public.hard_delete_client_account(
  target_account_id uuid,
  actor_profile_id uuid,
  change_reason text,
  confirmation_email text,
  confirmation_text text,
  acknowledgement boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  institution_ids uuid[];
  probe_message text;
  new_domain_summary jsonb;
  delete_result jsonb;
begin
  select coalesce(array_agg(id), array[]::uuid[])
    into institution_ids
    from public.institutions
   where account_id = target_account_id;

  -- Run the legacy validation and deletion inside a savepoint after deleting
  -- the new-domain rows. Any failure rolls the probe back in full.
  begin
    perform public.delete_client_account_new_domains(institution_ids);
    perform public.hard_delete_client_account_legacy(
      target_account_id,
      actor_profile_id,
      change_reason,
      confirmation_email,
      confirmation_text,
      acknowledgement
    );
    raise exception '__HARD_DELETE_VALIDATION_OK__' using errcode = 'P0001';
  exception
    when others then
      get stacked diagnostics probe_message = message_text;
      if probe_message <> '__HARD_DELETE_VALIDATION_OK__' then
        raise;
      end if;
  end;

  new_domain_summary := public.delete_client_account_new_domains(institution_ids);
  delete_result := public.hard_delete_client_account_legacy(
    target_account_id,
    actor_profile_id,
    change_reason,
    confirmation_email,
    confirmation_text,
    acknowledgement
  );

  return delete_result || jsonb_build_object(
    'newDomainSummary', new_domain_summary
  );
end;
$$;

revoke all on function public.hard_delete_client_account(uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.hard_delete_client_account(uuid, uuid, text, text, text, boolean)
  to service_role;
