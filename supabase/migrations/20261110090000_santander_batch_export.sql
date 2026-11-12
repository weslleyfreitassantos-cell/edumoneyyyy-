-- Registers the exact CNAB file exported by the authorized user.
begin;

alter table public.finance_remittance_batches
  add column if not exists file_hash text check (file_hash is null or file_hash ~ '^[0-9a-f]{64}$');

create or replace function public.finance_mark_santander_remittance_exported(
  p_institution_id uuid,
  p_batch_id uuid,
  p_file_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_batch public.finance_remittance_batches%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'SANTANDER_INVALID_FILE_HASH';
  end if;
  select * into v_batch from public.finance_remittance_batches
    where id = p_batch_id and institution_id = p_institution_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SANTANDER_BATCH_NOT_FOUND';
  end if;
  if v_batch.status = 'CANCELLED' then
    raise exception using errcode = '22023', message = 'SANTANDER_BATCH_CANCELLED';
  end if;
  if v_batch.file_hash is not null and v_batch.file_hash <> lower(p_file_hash) then
    raise exception using errcode = '22023', message = 'SANTANDER_BATCH_EXPORT_HASH_MISMATCH';
  end if;
  update public.finance_remittance_batches set
    status = case when status = 'GENERATED' then 'EXPORTED' else status end,
    file_hash = lower(p_file_hash), exported_at = coalesce(exported_at, now()),
    metadata = metadata || jsonb_build_object('exported_file_hash', lower(p_file_hash))
    where id = p_batch_id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
    values (p_institution_id, v_actor, 'FINANCE_SANTANDER_BATCH_EXPORTED', 'REMITTANCE_BATCH', p_batch_id,
      'export:' || p_batch_id::text, jsonb_build_object('file_hash', lower(p_file_hash)))
    on conflict (institution_id, idempotency_key) do nothing;
end;
$$;

revoke all on function public.finance_mark_santander_remittance_exported(uuid, uuid, text) from public, anon;
grant execute on function public.finance_mark_santander_remittance_exported(uuid, uuid, text) to authenticated;

commit;
