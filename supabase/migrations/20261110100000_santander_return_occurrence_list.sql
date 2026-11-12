-- Read-only operational view for accepted, rejected and review-required returns.
begin;

create or replace function public.finance_list_santander_return_occurrences(
  p_institution_id uuid,
  p_status text,
  p_page integer,
  p_page_size integer
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_total bigint;
  v_rows jsonb;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if coalesce(p_status, '') <> '' and p_status not in ('APPLIED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE') then
    raise exception using errcode = '22023', message = 'SANTANDER_INVALID_RETURN_STATUS';
  end if;
  select count(*) into v_total
    from public.finance_santander_return_occurrences occurrence
    where occurrence.institution_id = p_institution_id
      and (coalesce(p_status, '') = '' or occurrence.status = p_status);
  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select occurrence.id, occurrence.return_file_id, occurrence.invoice_id,
        invoice.reference, occurrence.provider_event_id, occurrence.our_number,
        occurrence.occurrence_code, occurrence.event_type, occurrence.amount_cents,
        occurrence.paid_at, occurrence.status, occurrence.review_reason, occurrence.created_at
      from public.finance_santander_return_occurrences occurrence
      left join public.invoices invoice
        on invoice.id = occurrence.invoice_id and invoice.institution_id = occurrence.institution_id
      where occurrence.institution_id = p_institution_id
        and (coalesce(p_status, '') = '' or occurrence.status = p_status)
      order by occurrence.created_at desc
      limit v_size offset (v_page - 1) * v_size
    ) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

revoke all on function public.finance_list_santander_return_occurrences(uuid, text, integer, integer) from public, anon;
grant execute on function public.finance_list_santander_return_occurrences(uuid, text, integer, integer) to authenticated;

commit;
