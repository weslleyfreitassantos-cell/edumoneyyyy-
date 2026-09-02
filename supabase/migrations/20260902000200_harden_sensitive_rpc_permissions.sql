begin;

-- These functions read or mutate authenticated user data. Keep the public
-- branding resolvers available anonymously, but require a user session here.
revoke all on function public.can_view_institution_profile(uuid) from public, anon;
grant execute on function public.can_view_institution_profile(uuid) to authenticated;

revoke all on function public.create_full_student_enrollment_bundle(jsonb) from public, anon;
grant execute on function public.create_full_student_enrollment_bundle(jsonb) to authenticated;

revoke all on function public.get_current_self_registration() from public, anon;
grant execute on function public.get_current_self_registration() to authenticated;

revoke all on function public.update_current_self_registration(jsonb) from public, anon;
grant execute on function public.update_current_self_registration(jsonb) to authenticated;

revoke all on function public.update_full_student_enrollment_bundle(jsonb) from public, anon;
grant execute on function public.update_full_student_enrollment_bundle(jsonb) to authenticated;

-- This resolver is intentionally public, but it should not inherit a caller
-- controlled search path while running with elevated privileges.
alter function public.get_public_institution_branding(text)
  set search_path = '';

commit;
