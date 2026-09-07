begin;

-- These functions read or mutate authenticated user data. Keep the public
-- branding resolvers available anonymously, but require a user session here.
-- This RPC exists in the reconciled remote baseline but is not created by the
-- local historical migrations. Keep fresh shadow databases reproducible while
-- preserving the hardening wherever the RPC is present.
do $$
begin
  if to_regprocedure('public.can_view_institution_profile(uuid)') is not null then
    revoke all on function public.can_view_institution_profile(uuid) from public, anon;
    grant execute on function public.can_view_institution_profile(uuid) to authenticated;
  end if;
end
$$;

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
