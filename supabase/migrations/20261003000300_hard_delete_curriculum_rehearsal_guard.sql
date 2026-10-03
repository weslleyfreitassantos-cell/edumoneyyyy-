-- The legacy delete order protects curriculum items while offerings or
-- timetable entries are active. Prepare those rows inside the same transaction
-- so account deletion remains compatible with the existing guard trigger.

alter function public.delete_client_account_new_domains(uuid[])
  rename to delete_client_account_new_domains_legacy;

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
  deactivated_rows int;
  summary jsonb := '{}'::jsonb;
begin
  update public.subject_offerings
     set active = false,
         updated_at = now()
   where class_id in (
     select id from public.classes
      where institution_id = any(target_institution_ids)
   )
     and active is true;
  get diagnostics deactivated_rows = row_count;
  summary := jsonb_build_object(
    'subjectOfferingsDeactivated', deactivated_rows
  );

  delete from public.timetable_entries
   where institution_id = any(target_institution_ids);
  get diagnostics deleted_rows = row_count;
  summary := summary || jsonb_build_object(
    'timetableEntriesPrepared', deleted_rows
  );

  return summary || jsonb_build_object(
    'newDomainSummary',
    public.delete_client_account_new_domains_legacy(target_institution_ids)
  );
end;
$$;

revoke all on function public.delete_client_account_new_domains(uuid[])
  from public, anon, authenticated;
