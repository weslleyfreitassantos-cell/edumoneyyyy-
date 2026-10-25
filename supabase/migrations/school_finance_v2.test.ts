import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261025000500_school_finance_v2.sql'), 'utf8');

describe('Financeiro escolar V2 migration contract', () => {
  it('stores school finance in integer cents and makes recurring writes replay-safe', () => {
    expect(sql).toContain('amount_cents bigint not null check (amount_cents > 0)');
    expect(sql).toContain('perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || \':\' || btrim(p_idempotency_key), 0))');
    expect(sql).toContain('FINANCE_IDEMPOTENCY_MISMATCH');
    expect(sql).toContain('unique (institution_id, idempotency_key)');
  });

  it('constrains staff operations and direct writes by institutional role', () => {
    expect(sql).toContain("array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]");
    expect(sql).toContain("institution.plan = 'PROFESSIONAL'::public.institution_plan");
    expect(sql).toContain('create policy finance_expense_staff_read');
    expect(sql).toContain('create policy finance_audit_staff_read');
    expect(sql).toContain('revoke insert, update, delete on public.financial_contracts');
    expect(sql).toContain('create policy finance_reminder_draft_staff_read');
    expect(sql).toContain('where draft.institution_id = p_institution_id');
    expect(sql).toContain('create or replace function public.finance_list_contract_candidates_v2');
    expect(sql).toContain('limit v_size offset (v_page - 1) * v_size');
    expect(sql).toContain("values ('finance-documents', 'finance-documents', false, 10485760");
    expect(sql).toContain('create policy finance_documents_staff_insert on storage.objects');
    expect(sql).toContain('create or replace function private.finance_document_path_allowed(object_name text)');
    expect(sql).toContain('private.finance_can_manage(v_institution_segment::uuid)');
    expect(sql).toContain('and private.finance_document_path_allowed(name)');
    expect(sql).toContain('FINANCE_INVALID_DOCUMENT_PATH');
  });

  it('keeps guardian access tied to the contract financial-responsible profile', () => {
    expect(sql).toContain("profile.role = 'GUARDIAN'::public.user_role");
    expect(sql).toContain('where contract.financial_responsible_profile_id = v_actor');
    expect(sql).toContain('grant execute on function public.finance_guardian_portal_v2() to authenticated');
  });

  it('keeps list search, filters, ordering and pagination on the server', () => {
    expect(sql).toContain("p_sort_by in ('due_date', 'student_name', 'balance', 'status')");
    expect(sql).toContain("p_sort_by in ('created_at', 'student_name', 'monthly_amount', 'status')");
    expect(sql).toContain("p_sort_by in ('paid_at', 'student_name', 'amount', 'status')");
    expect(sql).toContain("p_sort_by in ('due_date', 'description', 'amount', 'status')");
    expect(sql).toContain('limit v_size offset (v_page - 1) * v_size');
    expect(sql).toContain('finance_list_invoices_v2(uuid,integer,integer,text,text,date,date,text,text)');
    expect(sql).toContain('finance_list_contracts_v2(uuid,integer,integer,text,text,text,text)');
  });

  it('requires the full punctuality-discount balance and exact receipt replay details', () => {
    expect(sql).toContain('v_payment.paid_at is distinct from p_paid_at');
    expect(sql).toContain('v_payment.notes is distinct from nullif(btrim(coalesce(p_notes, \'\')), \'\')');
    expect(sql).toContain('p_amount_cents = greatest(0, v_open_balance - v_invoice.punctuality_discount_amount)');
  });

  it('offers audited manual operations, reports, and no outbound payment integration', () => {
    expect(sql).toContain('finance_register_manual_receipt_v2');
    expect(sql).toContain('finance_reverse_payment_v2');
    expect(sql).toContain('finance_update_contract_terms_v2');
    expect(sql).toContain('finance_report_breakdown_v2');
    expect(sql).toContain('external_reminders_enabled boolean not null default false');
    expect(sql).not.toMatch(/stripe|mercado\s?pago|efi\s?bank|pagarme/i);
  });
});
