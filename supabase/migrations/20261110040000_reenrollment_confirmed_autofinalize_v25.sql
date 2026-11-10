begin;

-- Keep the former implementation unavailable to API roles; the guarded engine
-- below preserves its checks and also supports verified family confirmation.
alter function public.finalize_reenrollment_v2(uuid)
  rename to finalize_reenrollment_v2_core;

revoke all on function public.finalize_reenrollment_v2_core(uuid)
  from public, anon, authenticated, service_role;

create function private.finalize_reenrollment_v25_core(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  result_row public.reenrollment_academic_results%rowtype;
  destination_class public.classes%rowtype;
  finance_link public.reenrollment_finance_links%rowtype;
  invoice_row public.invoices%rowtype;
  receipt_code_value text;
  pending_reason_value text;
  blockers jsonb := '[]'::jsonb;
  pending_documents integer := 0;
  active_enrollment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;

  select request.* into request_row
  from public.reenrollment_requests request
  where request.id = p_request_id
  for update;

  if not found or not (
    public.can_manage_institution_operations(request_row.institution_id)
    or private.reenrollment_user_can_act_on_student(
      request_row.institution_id, request_row.student_id
    )
  ) then
    raise exception 'REENROLLMENT_FINALIZE_NOT_ALLOWED';
  end if;

  select * into campaign
  from public.reenrollment_campaigns
  where id = request_row.campaign_id;

  perform pg_advisory_xact_lock(hashtextextended(
    request_row.student_id::text || ':' || campaign.destination_academic_year_id::text,
    0
  ));

  if request_row.request_status = 'ENROLLED' and request_row.final_enrollment_id is not null then
    return jsonb_build_object(
      'ready', true,
      'replayed', true,
      'enrollment_id', request_row.final_enrollment_id,
      'receipt_code', request_row.receipt_code
    );
  end if;

  if request_row.confirmed_at is null
    or request_row.request_status in ('PENDING_CONFIRMATION', 'CANCELLED', 'REJECTED') then
    return jsonb_build_object(
      'ready', false,
      'replayed', false,
      'blockers', jsonb_build_array('REMATRICULA_NAO_CONFIRMADA'),
      'pending_reason', 'REMATRICULA_NAO_CONFIRMADA',
      'request', to_jsonb(request_row)
    );
  end if;

  if not exists (
    select 1 from public.reenrollment_contract_acceptances acceptance
    where acceptance.request_id = request_row.id
      and acceptance.contract_version = campaign.contract_version
      and acceptance.contract_hash = campaign.contract_hash
  ) then
    blockers := blockers || jsonb_build_array('CONTRATO_NAO_ACEITO');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'CONTRATO_NAO_ACEITO');
  end if;

  select * into result_row
  from public.reenrollment_academic_results result
  where result.request_id = request_row.id
  for update;
  if not found or result_row.homologated_at is null then
    blockers := blockers || jsonb_build_array('RESULTADO_NAO_HOMOLOGADO');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'RESULTADO_NAO_HOMOLOGADO');
  elsif result_row.result_status in ('RECOVERY', 'INCOMPLETE') then
    blockers := blockers || jsonb_build_array(
      case when result_row.result_status = 'RECOVERY' then 'RECUPERACAO_PENDENTE' else 'RESULTADO_INCOMPLETO' end
    );
    pending_reason_value := concat_ws('; ', pending_reason_value,
      case when result_row.result_status = 'RECOVERY' then 'RECUPERACAO_PENDENTE' else 'RESULTADO_INCOMPLETO' end
    );
  elsif result_row.result_status = 'GRADUATING' then
    blockers := blockers || jsonb_build_array('CONCLUIDOR_TRATAMENTO_PROPRIO');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'CONCLUIDOR_TRATAMENTO_PROPRIO');
  elsif result_row.result_status not in ('APPROVED', 'FAILED', 'RETAINED') then
    blockers := blockers || jsonb_build_array('RESULTADO_NAO_ELEGIVEL');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'RESULTADO_NAO_ELEGIVEL');
  end if;

  if coalesce(result_row.result_status, '') <> 'GRADUATING' and request_row.destination_grade_level is null then
    blockers := blockers || jsonb_build_array('SERIE_DESTINO_NAO_DEFINIDA');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'SERIE_DESTINO_NAO_DEFINIDA');
  end if;

  if coalesce(result_row.result_status, '') <> 'GRADUATING' and request_row.destination_class_id is null then
    blockers := blockers || jsonb_build_array('TURMA_DESTINO_NAO_DEFINIDA');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'TURMA_DESTINO_NAO_DEFINIDA');
  elsif coalesce(result_row.result_status, '') <> 'GRADUATING' then
    select * into destination_class
    from public.classes class_record
    where class_record.id = request_row.destination_class_id
      and class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
    for update;
    if not found then
      blockers := blockers || jsonb_build_array('TURMA_DESTINO_INVALIDA');
      pending_reason_value := concat_ws('; ', pending_reason_value, 'TURMA_DESTINO_INVALIDA');
    elsif lower(trim(coalesce(destination_class.grade_level, ''))) <> lower(trim(coalesce(request_row.destination_grade_level, ''))) then
      blockers := blockers || jsonb_build_array('TURMA_SERIE_INCOMPATIVEL');
      pending_reason_value := concat_ws('; ', pending_reason_value, 'TURMA_SERIE_INCOMPATIVEL');
    else
      select count(*) into active_enrollment_count
      from public.enrollments enrollment
      where enrollment.class_id = destination_class.id
        and enrollment.active is true;
      if destination_class.capacity > 0 and active_enrollment_count >= destination_class.capacity then
        blockers := blockers || jsonb_build_array('SEM_VAGA_NA_TURMA');
        pending_reason_value := concat_ws('; ', pending_reason_value, 'SEM_VAGA_NA_TURMA');
      end if;
    end if;
  end if;

  select count(*) into pending_documents
  from public.reenrollment_document_requirements requirement
  where requirement.campaign_id = campaign.id
    and requirement.required is true
    and not exists (
      select 1 from public.student_documents document
      where document.student_id = request_row.student_id
        and document.institution_id = request_row.institution_id
        and lower(trim(document.document_type)) = lower(trim(requirement.document_type))
        and document.status in ('VALIDATED', 'DISPENSED')
    );
  if pending_documents > 0 then
    blockers := blockers || jsonb_build_array('DOCUMENTOS_PENDENTES');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'DOCUMENTOS_PENDENTES');
  end if;

  if campaign.require_financial_clearance then
    select * into finance_link
    from public.reenrollment_finance_links link
    where link.request_id = request_row.id
    for update;
    if not found then
      blockers := blockers || jsonb_build_array('VINCULO_FINANCEIRO_AUSENTE');
      pending_reason_value := concat_ws('; ', pending_reason_value, 'VINCULO_FINANCEIRO_AUSENTE');
    elsif finance_link.status = 'WAIVED' then
      null;
    elsif finance_link.status = 'CLEARED' and finance_link.manual_clearance then
      if not campaign.finance_allow_manual_clearance then
        blockers := blockers || jsonb_build_array('LIQUIDACAO_MANUAL_NAO_AUTORIZADA');
        pending_reason_value := concat_ws('; ', pending_reason_value, 'LIQUIDACAO_MANUAL_NAO_AUTORIZADA');
      end if;
    elsif finance_link.primary_invoice_id is null then
      blockers := blockers || jsonb_build_array('FATURA_NAO_GERADA');
      pending_reason_value := concat_ws('; ', pending_reason_value, 'FATURA_NAO_GERADA');
    else
      select * into invoice_row
      from public.invoices invoice
      where invoice.id = finance_link.primary_invoice_id
        and invoice.institution_id = request_row.institution_id
      for update;
      if not found
        or invoice_row.status::text <> 'PAID'
        or invoice_row.amount_paid < invoice_row.amount_due
        or exists (
          select 1 from public.payments payment
          where payment.invoice_id = invoice_row.id
            and payment.status::text = 'REVERSED'
        ) then
        blockers := blockers || jsonb_build_array('PAGAMENTO_NAO_LIQUIDADO');
        pending_reason_value := concat_ws('; ', pending_reason_value, 'PAGAMENTO_NAO_LIQUIDADO');
      end if;
    end if;
  end if;

  if exists (
    select 1 from public.enrollments enrollment
    where enrollment.student_id = request_row.student_id
      and enrollment.academic_year_id = campaign.destination_academic_year_id
      and enrollment.active is true
      and enrollment.id is distinct from request_row.final_enrollment_id
  ) then
    blockers := blockers || jsonb_build_array('MATRICULA_ATIVA_DUPLICADA');
    pending_reason_value := concat_ws('; ', pending_reason_value, 'MATRICULA_ATIVA_DUPLICADA');
  end if;

  if jsonb_array_length(blockers) > 0 then
    update public.reenrollment_requests
    set request_status = case
          when pending_reason_value like '%PAGAMENTO%'
            or pending_reason_value like '%FINANCEIRO%'
            or pending_reason_value like '%FATURA%'
            then 'AWAITING_PAYMENT'
          when pending_reason_value like '%RESULTADO%'
            or pending_reason_value like '%RECUPERACAO%'
            then 'AWAITING_ACADEMIC_RESULT'
          else request_status
        end,
        pending_reason = pending_reason_value,
        updated_at = now()
    where id = request_row.id
    returning * into request_row;
    return jsonb_build_object(
      'ready', false,
      'replayed', false,
      'blockers', blockers,
      'pending_reason', pending_reason_value,
      'request', to_jsonb(request_row)
    );
  end if;

  insert into public.enrollments (
    student_id, class_id, academic_year_id, status, active
  ) values (
    request_row.student_id, request_row.destination_class_id,
    campaign.destination_academic_year_id, 'active', true
  ) returning id into request_row.final_enrollment_id;

  receipt_code_value := coalesce(request_row.receipt_code, 'RMT-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 12)));

  update public.reenrollment_requests
  set request_status = 'ENROLLED',
      final_enrollment_id = request_row.final_enrollment_id,
      finalized_by = auth.uid(),
      finalized_at = now(),
      receipt_code = receipt_code_value,
      pending_reason = null,
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'ENROLLMENT_EFFECTIVATED', auth.uid(),
    jsonb_build_object('enrollment_id', request_row.final_enrollment_id, 'receipt_code', receipt_code_value)
  );

  return jsonb_build_object(
    'ready', true,
    'replayed', false,
    'enrollment_id', request_row.final_enrollment_id,
    'receipt_code', receipt_code_value,
    'request', to_jsonb(request_row)
  );
end;
$$;

revoke all on function private.finalize_reenrollment_v25_core(uuid)
  from public, anon, authenticated, service_role;

create function public.finalize_reenrollment_v2(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_finalizing text;
  result_value jsonb;
begin
  previous_finalizing := current_setting('tecescola.reenrollment_v25_finalizing', true);
  perform set_config('tecescola.reenrollment_v25_finalizing', 'on', true);
  result_value := private.finalize_reenrollment_v25_core(p_request_id);
  perform set_config(
    'tecescola.reenrollment_v25_finalizing',
    coalesce(previous_finalizing, 'off'),
    true
  );
  return result_value;
end;
$$;

revoke all on function public.finalize_reenrollment_v2(uuid) from public, anon;
grant execute on function public.finalize_reenrollment_v2(uuid) to authenticated;

-- Re-evaluate after a verified guardian/adult confirms or staff changes a prerequisite.
create or replace function private.try_finalize_reenrollment_v25()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  request_ids uuid[] := '{}'::uuid[];
  request_id uuid;
  student_id_value uuid;
  campaign_id_value uuid;
  invoice_id_value uuid;
  class_id_value uuid;
  class_ids uuid[] := '{}'::uuid[];
  institution_id_value uuid;
  previous_finalizing text;
begin
  if pg_trigger_depth() > 1
    or current_setting('tecescola.reenrollment_v25_finalizing', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_table_name = 'reenrollment_requests' then
    if row_data ->> 'request_status' in ('ENROLLED', 'CANCELLED', 'REJECTED') then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
    request_ids := array[(row_data ->> 'id')::uuid];
  elsif tg_table_name = 'student_documents' then
    student_id_value := (row_data ->> 'student_id')::uuid;
    select coalesce(array_agg(request.id order by request.created_at, request.id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_requests request
    where request.student_id = student_id_value
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED');
  elsif tg_table_name = 'reenrollment_finance_links' then
    request_ids := array[(row_data ->> 'request_id')::uuid];
  elsif tg_table_name = 'reenrollment_academic_results' then
    request_ids := array[(row_data ->> 'request_id')::uuid];
  elsif tg_table_name = 'reenrollment_contract_acceptances' then
    request_ids := array[(row_data ->> 'request_id')::uuid];
  elsif tg_table_name = 'invoices' then
    invoice_id_value := (row_data ->> 'id')::uuid;
    select coalesce(array_agg(link.request_id order by link.request_id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_finance_links link
    where link.primary_invoice_id = invoice_id_value;
  elsif tg_table_name = 'payments' then
    invoice_id_value := (row_data ->> 'invoice_id')::uuid;
    select coalesce(array_agg(link.request_id order by link.request_id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_finance_links link
    where link.primary_invoice_id = invoice_id_value;
  elsif tg_table_name = 'reenrollment_document_requirements' then
    campaign_id_value := (row_data ->> 'campaign_id')::uuid;
    select coalesce(array_agg(request.id order by request.created_at, request.id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_requests request
    where request.campaign_id = campaign_id_value
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED');
  elsif tg_table_name = 'classes' then
    class_id_value := (row_data ->> 'id')::uuid;
    institution_id_value := (row_data ->> 'institution_id')::uuid;
    if not public.can_manage_institution_operations(institution_id_value) then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
    select coalesce(array_agg(request.id order by request.created_at, request.id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_requests request
    where request.destination_class_id = class_id_value
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED');
  elsif tg_table_name = 'enrollments' then
    if tg_op <> 'INSERT' and old.class_id is not null then
      class_ids := array_append(class_ids, old.class_id);
    end if;
    if tg_op <> 'DELETE' and new.class_id is not null then
      class_ids := array_append(class_ids, new.class_id);
    end if;
    select coalesce(array_agg(request.id order by request.created_at, request.id), '{}'::uuid[])
      into request_ids
    from public.reenrollment_requests request
    where request.destination_class_id = any(class_ids)
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED');
  end if;

  foreach request_id in array request_ids loop
    select request.institution_id into institution_id_value
    from public.reenrollment_requests request
    where request.id = request_id;

    if institution_id_value is not null and exists (
      select 1 from public.reenrollment_requests request
      where request.id = request_id
        and (
          public.can_manage_institution_operations(request.institution_id)
          or private.reenrollment_user_can_act_on_student(
            request.institution_id, request.student_id
          )
        )
    ) then
      previous_finalizing := current_setting('tecescola.reenrollment_v25_finalizing', true);
      perform set_config('tecescola.reenrollment_v25_finalizing', 'on', true);
      perform private.finalize_reenrollment_v25_core(request_id);
      perform set_config(
        'tecescola.reenrollment_v25_finalizing',
        coalesce(previous_finalizing, 'off'),
        true
      );
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.try_finalize_reenrollment_v25()
  from public, anon, authenticated;

drop trigger if exists reenrollment_auto_finalize_request_v25
  on public.reenrollment_requests;
create trigger reenrollment_auto_finalize_request_v25
after insert or update of request_status, confirmed_at, academic_status,
  financial_status, destination_grade_level, destination_class_id
on public.reenrollment_requests
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_documents_v25
  on public.student_documents;
create trigger reenrollment_auto_finalize_documents_v25
after insert or update or delete on public.student_documents
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_finance_link_v25
  on public.reenrollment_finance_links;
create trigger reenrollment_auto_finalize_finance_link_v25
after insert or update or delete on public.reenrollment_finance_links
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_academic_result_v25
  on public.reenrollment_academic_results;
create trigger reenrollment_auto_finalize_academic_result_v25
after insert or update or delete on public.reenrollment_academic_results
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_contract_acceptance_v25
  on public.reenrollment_contract_acceptances;
create trigger reenrollment_auto_finalize_contract_acceptance_v25
after insert or update on public.reenrollment_contract_acceptances
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_invoice_v25
  on public.invoices;
create trigger reenrollment_auto_finalize_invoice_v25
after insert or update or delete on public.invoices
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_payment_v25
  on public.payments;
create trigger reenrollment_auto_finalize_payment_v25
after insert or update or delete on public.payments
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_document_requirement_v25
  on public.reenrollment_document_requirements;
create trigger reenrollment_auto_finalize_document_requirement_v25
after insert or update or delete on public.reenrollment_document_requirements
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_class_v25 on public.classes;
create trigger reenrollment_auto_finalize_class_v25
after update of active, capacity, grade_level on public.classes
for each row execute function private.try_finalize_reenrollment_v25();

drop trigger if exists reenrollment_auto_finalize_enrollment_v25 on public.enrollments;
create trigger reenrollment_auto_finalize_enrollment_v25
after insert or update of active, class_id or delete on public.enrollments
for each row execute function private.try_finalize_reenrollment_v25();

notify pgrst, 'reload schema';
commit;
