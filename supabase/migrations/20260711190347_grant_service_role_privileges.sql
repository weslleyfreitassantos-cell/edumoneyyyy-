begin;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.institutions,
  public.memberships,
  public.students,
  public.guardianships
to service_role;

commit;