-- Optimize row-level security evaluation and foreign-key lookups.
-- This migration preserves policy predicates and only changes evaluation/indexing.

-- These tables are written through trusted server-side flows only. Keep the
-- deny-by-default behavior explicit for direct Data API roles.
create policy "camera_gateway_request_nonces_no_direct_access"
  on public."camera_gateway_request_nonces"
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "camera_stream_sessions_no_direct_access"
  on public."camera_stream_sessions"
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "financial_contract_adjustments_no_direct_access"
  on public."financial_contract_adjustments"
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "financial_reminder_settings_no_direct_access"
  on public."financial_reminder_settings"
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "payment_events_no_direct_access"
  on public."payment_events"
  for all to anon, authenticated
  using (false)
  with check (false);

alter policy "assessments_insert_policy" on public."assessments"
  WITH CHECK (private.offering_belongs_to_institution(subject_offering_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (private.is_teacher_for_offering(subject_offering_id, institution_id) AND (created_by = (select auth.uid())))));

alter policy "assessments_update_policy" on public."assessments"
  USING (private.is_admin_or_director(institution_id) OR private.is_teacher_for_offering(subject_offering_id, institution_id))
  WITH CHECK (private.offering_belongs_to_institution(subject_offering_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (private.is_teacher_for_offering(subject_offering_id, institution_id) AND (created_by = (select auth.uid())))));

alter policy "grades_insert_policy" on public."grades"
  WITH CHECK (private.can_manage_assessment(assessment_id, institution_id) AND private.is_student_enrolled_for_assessment(student_id, assessment_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (recorded_by = (select auth.uid()))));

alter policy "grades_update_policy" on public."grades"
  USING (private.can_manage_assessment(assessment_id, institution_id))
  WITH CHECK (private.can_manage_assessment(assessment_id, institution_id) AND private.is_student_enrolled_for_assessment(student_id, assessment_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (recorded_by = (select auth.uid()))));

alter policy "attendance_sessions_insert_policy" on public."attendance_sessions"
  WITH CHECK (private.offering_belongs_to_institution(subject_offering_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (private.is_teacher_for_offering(subject_offering_id, institution_id) AND (created_by = (select auth.uid())))));

alter policy "attendance_sessions_update_policy" on public."attendance_sessions"
  USING (private.is_admin_or_director(institution_id) OR private.is_teacher_for_offering(subject_offering_id, institution_id))
  WITH CHECK (private.offering_belongs_to_institution(subject_offering_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (private.is_teacher_for_offering(subject_offering_id, institution_id) AND (created_by = (select auth.uid())))));

alter policy "attendance_records_insert_policy" on public."attendance_records"
  WITH CHECK (private.can_manage_attendance_session(attendance_session_id, institution_id) AND private.is_student_enrolled_for_attendance_session(student_id, attendance_session_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (recorded_by = (select auth.uid()))));

alter policy "attendance_records_update_policy" on public."attendance_records"
  USING (private.can_manage_attendance_session(attendance_session_id, institution_id))
  WITH CHECK (private.can_manage_attendance_session(attendance_session_id, institution_id) AND private.is_student_enrolled_for_attendance_session(student_id, attendance_session_id, institution_id) AND (private.is_admin_or_director(institution_id) OR (recorded_by = (select auth.uid()))));

alter policy "profiles_select_policy" on public."profiles"
  USING ((id = (select auth.uid())) OR is_platform_super_admin() OR (EXISTS ( SELECT 1
   FROM memberships membership
  WHERE ((membership.profile_id = profiles.id) AND can_access_institution(membership.institution_id)))));

alter policy "memberships_select_policy" on public."memberships"
  USING ((profile_id = (select auth.uid())) OR can_access_institution(institution_id));

alter policy "students_select_policy" on public."students"
  USING (can_manage_institution_operations(institution_id) OR (profile_id = (select auth.uid())) OR private.is_guardian_of_student(id));

alter policy "guardianships_select_policy" on public."guardianships"
  USING ((guardian_profile_id = (select auth.uid())) OR private.can_manage_student(student_id));

alter policy "subject_offerings_select_policy" on public."subject_offerings"
  USING ((teacher_profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM classes class
  WHERE ((class.id = subject_offerings.class_id) AND can_access_institution(class.institution_id)))));

alter policy "profiles_update_own_name_policy" on public."profiles"
  USING (id = (select auth.uid()))
  WITH CHECK ((id = (select auth.uid())) AND (full_name = btrim(full_name)) AND ((char_length(full_name) >= 2) AND (char_length(full_name) <= 120)));

alter policy "finance_contract_staff" on public."financial_contracts"
  USING (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = financial_contracts.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = financial_contracts.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))));

alter policy "finance_contract_guardian" on public."financial_contracts"
  USING (financial_responsible_profile_id = (select auth.uid()));

alter policy "finance_invoice_staff" on public."invoices"
  USING (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = invoices.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = invoices.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))));

alter policy "finance_invoice_guardian" on public."invoices"
  USING (financial_responsible_profile_id = (select auth.uid()));

alter policy "finance_payment_staff" on public."payments"
  USING (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = payments.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = payments.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))));

alter policy "finance_payment_guardian" on public."payments"
  USING (EXISTS ( SELECT 1
   FROM invoices i
  WHERE ((i.id = payments.invoice_id) AND (i.financial_responsible_profile_id = (select auth.uid())))));

alter policy "finance_provider_staff" on public."payment_provider_accounts"
  USING (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.profile_id = (select auth.uid())) AND (m.institution_id = payment_provider_accounts.institution_id) AND m.active AND (m.role = ANY (ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role])))));

alter policy "guardianships_student_select" on public."guardianships"
  USING (EXISTS ( SELECT 1
   FROM students student
  WHERE ((student.id = guardianships.student_id) AND (student.profile_id = (select auth.uid())))));

alter policy "institution_announcements_staff_insert" on public."institution_announcements"
  WITH CHECK (private.has_institution_role(institution_id, ARRAY['ADMIN'::user_role, 'DIRECTOR'::user_role, 'SECRETARY'::user_role]) AND (created_by = (select auth.uid())));

alter policy "client_admin_invitations_super_admin_select" on public."client_admin_invitations"
  USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.platform_role = 'SUPER_ADMIN'::platform_role) AND (profiles.active IS TRUE))));

create index if not exists "academic_policies_academic_year_id_idx"
  on public."academic_policies" ("academic_year_id");

-- These audit columns exist in the reconciled remote schema but are absent
-- from the local historical definition. Apply the indexes wherever the
-- columns are present without making a fresh database reset fail.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'account_domains'
       and column_name = 'created_by'
  ) then
    create index if not exists "account_domains_created_by_idx"
      on public."account_domains" ("created_by");
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'account_domains'
       and column_name = 'updated_by'
  ) then
    create index if not exists "account_domains_updated_by_idx"
      on public."account_domains" ("updated_by");
  end if;
end
$$;

create index if not exists "account_status_events_actor_profile_id_idx"
  on public."account_status_events" ("actor_profile_id");

create index if not exists "assessments_created_by_idx"
  on public."assessments" ("created_by");

create index if not exists "attendance_records_recorded_by_idx"
  on public."attendance_records" ("recorded_by");

create index if not exists "attendance_sessions_created_by_idx"
  on public."attendance_sessions" ("created_by");

create index if not exists "branding_settings_updated_by_idx"
  on public."branding_settings" ("updated_by");

create index if not exists "camera_access_logs_camera_id_idx"
  on public."camera_access_logs" ("camera_id");

create index if not exists "camera_access_logs_profile_id_idx"
  on public."camera_access_logs" ("profile_id");

create index if not exists "camera_gateways_created_by_profile_id_idx"
  on public."camera_gateways" ("created_by_profile_id");

create index if not exists "camera_stream_sessions_camera_id_idx"
  on public."camera_stream_sessions" ("camera_id");

create index if not exists "camera_stream_sessions_institution_id_idx"
  on public."camera_stream_sessions" ("institution_id");

create index if not exists "camera_stream_sessions_profile_id_idx"
  on public."camera_stream_sessions" ("profile_id");

create index if not exists "class_curriculum_items_subject_id_idx"
  on public."class_curriculum_items" ("subject_id");

create index if not exists "curriculum_template_items_institution_id_idx"
  on public."curriculum_template_items" ("institution_id");

create index if not exists "curriculum_template_items_subject_id_idx"
  on public."curriculum_template_items" ("subject_id");

create index if not exists "curriculum_templates_institution_id_idx"
  on public."curriculum_templates" ("institution_id");

create index if not exists "enrollments_academic_year_id_idx"
  on public."enrollments" ("academic_year_id");

create index if not exists "financial_contract_adjustments_contract_id_idx"
  on public."financial_contract_adjustments" ("contract_id");

create index if not exists "financial_contract_adjustments_institution_id_idx"
  on public."financial_contract_adjustments" ("institution_id");

create index if not exists "financial_contracts_academic_year_id_idx"
  on public."financial_contracts" ("academic_year_id");

create index if not exists "financial_contracts_created_by_idx"
  on public."financial_contracts" ("created_by");

create index if not exists "financial_contracts_enrollment_id_idx"
  on public."financial_contracts" ("enrollment_id");

create index if not exists "grades_recorded_by_idx"
  on public."grades" ("recorded_by");

create index if not exists "institution_announcements_created_by_idx"
  on public."institution_announcements" ("created_by");

create index if not exists "institution_cameras_created_by_profile_id_idx"
  on public."institution_cameras" ("created_by_profile_id");

create index if not exists "institution_cameras_gateway_id_idx"
  on public."institution_cameras" ("gateway_id");

create index if not exists "institutions_suspended_by_profile_id_idx"
  on public."institutions" ("suspended_by_profile_id");

create index if not exists "payment_events_institution_id_idx"
  on public."payment_events" ("institution_id");

create index if not exists "payment_events_payment_id_idx"
  on public."payment_events" ("payment_id");

create index if not exists "payments_institution_id_idx"
  on public."payments" ("institution_id");

create index if not exists "payments_registered_by_idx"
  on public."payments" ("registered_by");

create index if not exists "platform_destructive_actions_performed_by_profile_id_idx"
  on public."platform_destructive_actions" ("performed_by_profile_id");

create index if not exists "platform_security_events_requester_profile_id_idx"
  on public."platform_security_events" ("requester_profile_id");

create index if not exists "platform_security_events_target_profile_id_idx"
  on public."platform_security_events" ("target_profile_id");

create index if not exists "rooms_class_id_idx"
  on public."rooms" ("class_id");

create index if not exists "student_term_results_academic_year_id_idx"
  on public."student_term_results" ("academic_year_id");

create index if not exists "student_term_results_subject_offering_id_idx"
  on public."student_term_results" ("subject_offering_id");

create index if not exists "student_term_results_term_id_idx"
  on public."student_term_results" ("term_id");

create index if not exists "subject_offerings_term_id_idx"
  on public."subject_offerings" ("term_id");

create index if not exists "teacher_availability_teacher_profile_id_idx"
  on public."teacher_availability" ("teacher_profile_id");

create index if not exists "teacher_subjects_subject_id_idx"
  on public."teacher_subjects" ("subject_id");

create index if not exists "teacher_subjects_teacher_profile_id_idx"
  on public."teacher_subjects" ("teacher_profile_id");

create index if not exists "term_closures_academic_year_id_idx"
  on public."term_closures" ("academic_year_id");

create index if not exists "term_closures_closed_by_idx"
  on public."term_closures" ("closed_by");

create index if not exists "term_closures_reopened_by_idx"
  on public."term_closures" ("reopened_by");

create index if not exists "term_closures_submitted_by_idx"
  on public."term_closures" ("submitted_by");

create index if not exists "term_closures_term_id_idx"
  on public."term_closures" ("term_id");

create index if not exists "timetable_entries_academic_year_id_idx"
  on public."timetable_entries" ("academic_year_id");

create index if not exists "timetable_entries_room_id_idx"
  on public."timetable_entries" ("room_id");

create index if not exists "timetable_entries_subject_offering_id_idx"
  on public."timetable_entries" ("subject_offering_id");

create index if not exists "timetable_entries_term_id_idx"
  on public."timetable_entries" ("term_id");

create index if not exists "timetable_version_entries_academic_year_id_idx"
  on public."timetable_version_entries" ("academic_year_id");

create index if not exists "timetable_version_entries_class_id_idx"
  on public."timetable_version_entries" ("class_id");

create index if not exists "timetable_version_entries_room_id_idx"
  on public."timetable_version_entries" ("room_id");

create index if not exists "timetable_version_entries_subject_offering_id_idx"
  on public."timetable_version_entries" ("subject_offering_id");

create index if not exists "timetable_version_entries_term_id_idx"
  on public."timetable_version_entries" ("term_id");

create index if not exists "timetable_versions_academic_year_id_idx"
  on public."timetable_versions" ("academic_year_id");

create index if not exists "timetable_versions_created_by_idx"
  on public."timetable_versions" ("created_by");

create index if not exists "timetable_versions_source_version_id_idx"
  on public."timetable_versions" ("source_version_id");
