-- Remove remaining institution-scoped dependants that the original account
-- deletion order cannot reach because their foreign keys are restrictive.

alter function public.delete_client_account_new_domains(uuid[])
  rename to delete_client_account_new_domains_curriculum_guard;

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
  delete from public.access_events
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('accessEvents', deleted_rows);

  delete from public.class_council_student_notes
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('classCouncilStudentNotes', deleted_rows);

  delete from public.class_council_participants
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('classCouncilParticipants', deleted_rows);

  delete from public.class_councils
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('classCouncils', deleted_rows);

  delete from public.student_term_recoveries
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('studentTermRecoveries', deleted_rows);

  delete from public.book_recommendations
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('bookRecommendations', deleted_rows);

  delete from public.curriculum_template_items
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('curriculumTemplateItems', deleted_rows);

  delete from public.curriculum_templates
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('curriculumTemplates', deleted_rows);

  delete from public.teacher_availability
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('teacherAvailability', deleted_rows);

  delete from public.teacher_subjects
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('teacherSubjects', deleted_rows);

  delete from public.school_schedule_breaks
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('schoolScheduleBreaks', deleted_rows);

  delete from public.school_time_slots
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('schoolTimeSlots', deleted_rows);

  delete from public.payment_events
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('paymentEvents', deleted_rows);

  delete from public.payments
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('payments', deleted_rows);

  delete from public.invoices
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('invoices', deleted_rows);

  delete from public.financial_contract_adjustments
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('financialContractAdjustments', deleted_rows);

  delete from public.financial_contracts
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('financialContracts', deleted_rows);

  delete from public.institution_announcements
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('institutionAnnouncements', deleted_rows);

  delete from public.camera_access_logs
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('cameraAccessLogs', deleted_rows);

  delete from public.institution_cameras
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('institutionCameras', deleted_rows);

  delete from public.camera_gateways
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object('cameraGateways', deleted_rows);

  return summary || jsonb_build_object(
    'curriculumGuardSummary',
    public.delete_client_account_new_domains_curriculum_guard(target_institution_ids)
  );
end;
$$;

revoke all on function public.delete_client_account_new_domains(uuid[])
  from public, anon, authenticated;
