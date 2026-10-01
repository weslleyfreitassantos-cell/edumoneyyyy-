-- The enrollment editor reads these RLS-protected tables through PostgREST.
-- Writes remain inside the existing SECURITY DEFINER enrollment RPCs.
begin;

revoke all on table
  public.student_registration_details,
  public.student_addresses,
  public.student_previous_schooling,
  public.student_health_information,
  public.student_documents
  from anon;

grant select on table
  public.student_registration_details,
  public.student_addresses,
  public.student_previous_schooling,
  public.student_health_information,
  public.student_documents
  to authenticated;

notify pgrst, 'reload schema';
commit;
