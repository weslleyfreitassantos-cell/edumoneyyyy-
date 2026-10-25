import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type Db = SupabaseClient<any, any, any>;
type Actor = { id: string; email: string; client: Db };
type Role = 'ADMIN' | 'DIRECTOR' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';

const url = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const isLoopback = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();
if (url && !isLoopback) throw new Error('Finance V2 runtime tests are restricted to a loopback Supabase instance.');
const localDescribe = url && anonKey && serviceRoleKey && isLoopback ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

async function insertOne(db: Db, table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await db.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createActor(service: Db, institutionId: string, role: Role, suffix: string): Promise<Actor> {
  const email = `finance-v2-${suffix}@local.test`;
  const password = 'FinanceV2-Test!2026';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`auth ${role}: ${error.message}`);
  const user = required(data.user, `${role} user`);
  await insertOne(service, 'profiles', { id: user.id, full_name: `Finance ${suffix}`, email, role, active: true });
  await insertOne(service, 'memberships', { profile_id: user.id, institution_id: institutionId, role, active: true });
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`sign in ${role}: ${session.error?.message ?? 'no session'}`);
  return { id: user.id, email, client };
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

localDescribe('school finance V2 against disposable local Supabase', () => {
  const suffix = `${process.env.GITHUB_RUN_ID ?? 'local'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let service: Db;
  let institutionId: string;
  let foreignInstitutionId: string;
  let basicInstitutionId: string;
  let director: Actor;
  let teacher: Actor;
  let guardian: Actor;
  let secondGuardian: Actor;
  let foreignDirector: Actor;
  let basicDirector: Actor;
  let studentId: string;
  let secondStudentId: string;
  let academicYearId: string;
  let enrollmentId: string;
  let classId: string;
  let guardianPortalContractId: string;
  let today: string;

  beforeAll(async () => {
    service = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const institution = await insertOne(service, 'institutions', { name: `Finance V2 ${suffix}`, active: true, plan: 'PROFESSIONAL' });
    institutionId = institution.id;
    foreignInstitutionId = (await insertOne(service, 'institutions', { name: `Finance V2 foreign ${suffix}`, active: true, plan: 'PROFESSIONAL' })).id;
    basicInstitutionId = (await insertOne(service, 'institutions', { name: `Finance V2 basic ${suffix}`, active: true, plan: 'BASIC' })).id;
    [director, teacher, guardian, secondGuardian, foreignDirector, basicDirector] = await Promise.all([
      createActor(service, institutionId, 'DIRECTOR', `${suffix}-director`),
      createActor(service, institutionId, 'TEACHER', `${suffix}-teacher`),
      createActor(service, institutionId, 'GUARDIAN', `${suffix}-guardian`),
      createActor(service, institutionId, 'GUARDIAN', `${suffix}-guardian2`),
      createActor(service, foreignInstitutionId, 'DIRECTOR', `${suffix}-foreign`),
      createActor(service, basicInstitutionId, 'DIRECTOR', `${suffix}-basic`),
    ]);
    const studentProfile = await createActor(service, institutionId, 'STUDENT', `${suffix}-student`);
    const secondStudentProfile = await createActor(service, institutionId, 'STUDENT', `${suffix}-student2`);
    studentId = (await insertOne(service, 'students', {
      profile_id: studentProfile.id, institution_id: institutionId,
      registration_number: `F-${suffix}-1`, active: true,
    })).id;
    secondStudentId = (await insertOne(service, 'students', {
      profile_id: secondStudentProfile.id, institution_id: institutionId,
      registration_number: `F-${suffix}-2`, active: true,
    })).id;
    await insertOne(service, 'guardianships', {
      student_id: studentId, guardian_profile_id: guardian.id, relationship: 'responsável', active: true, is_primary: true,
    });
    await insertOne(service, 'guardianships', {
      student_id: secondStudentId, guardian_profile_id: secondGuardian.id, relationship: 'responsável', active: true, is_primary: true,
    });
    today = new Date().toISOString().slice(0, 10);
    academicYearId = (await insertOne(service, 'academic_years', {
      institution_id: institutionId, name: `Ano ${suffix}`, start_date: '2026-01-01', end_date: '2028-12-31', active: true,
    })).id;
    classId = (await insertOne(service, 'classes', {
      institution_id: institutionId, academic_year_id: academicYearId, name: `Turma ${suffix}`, active: true,
    })).id;
    enrollmentId = (await insertOne(service, 'enrollments', {
      student_id: studentId, class_id: classId, academic_year_id: academicYearId, status: 'active', active: true,
    })).id;
  }, 120_000);

  it('paginates eligible students and creates twelve calendar-safe installments exactly once', async () => {
    const candidates = await director.client.rpc('finance_list_contract_candidates_v2', {
      p_institution_id: institutionId, p_page: 1, p_page_size: 20, p_search: suffix,
    });
    expect(candidates.error).toBeNull();
    expect(candidates.data.total_count).toBe(2);
    expect(candidates.data.rows.find((row: any) => row.id === studentId).responsibles[0].profile_id).toBe(guardian.id);
    expect(candidates.data.rows.find((row: any) => row.id === studentId).enrollments[0].id).toBe(enrollmentId);
    const foreignCandidates = await foreignDirector.client.rpc('finance_list_contract_candidates_v2', {
      p_institution_id: institutionId, p_page: 1, p_page_size: 20, p_search: '',
    });
    expect(foreignCandidates.error?.code).toBe('42501');
    const basicPlanCandidates = await basicDirector.client.rpc('finance_list_contract_candidates_v2', {
      p_institution_id: basicInstitutionId, p_page: 1, p_page_size: 20, p_search: '',
    });
    expect(basicPlanCandidates.error?.code).toBe('42501');

    const args = {
      p_institution_id: institutionId, p_student_id: studentId, p_enrollment_id: enrollmentId,
      p_academic_year_id: academicYearId, p_responsible_profile_id: guardian.id,
      p_monthly_amount_cents: 10000, p_enrollment_fee_cents: 5000, p_installment_count: 12,
      p_first_due_date: '2028-01-31', p_due_day: 31, p_scholarship_per_installment_cents: 1000,
      p_discount_per_installment_cents: 500, p_punctuality_discount_cents: 200,
      p_fine_rate_bps: 0, p_monthly_interest_rate_bps: 0, p_grace_days: 0,
      p_notes: 'Contrato fictício automatizado', p_idempotency_key: `contract-${suffix}`,
    };
    const created = await director.client.rpc('finance_create_contract_v2', args);
    expect(created.error).toBeNull();
    const contract = required(created.data, 'financial contract');
    guardianPortalContractId = contract.contract_id;
    expect(contract.invoice_ids).toHaveLength(12);
    const replay = await director.client.rpc('finance_create_contract_v2', args);
    expect(replay.error).toBeNull();
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.invoice_ids).toEqual(contract.invoice_ids);

    const invoices = await director.client.from('invoices').select('id, due_date, base_amount, scholarship_amount, discount_amount')
      .eq('contract_id', contract.contract_id).order('sequence_number');
    expect(invoices.error).toBeNull();
    expect(invoices.data).toHaveLength(12);
    expect(invoices.data.map((row: any) => row.due_date)).toEqual([
      '2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30', '2028-05-31', '2028-06-30',
      '2028-07-31', '2028-08-31', '2028-09-30', '2028-10-31', '2028-11-30', '2028-12-31',
    ]);
    expect(invoices.data[0].base_amount).toBe(15000);
    expect(invoices.data[0].scholarship_amount).toBe(1000);
    expect(invoices.data[0].discount_amount).toBe(500);

    const changed = await director.client.rpc('finance_create_contract_v2', {
      ...args, p_monthly_amount_cents: 10001,
    });
    expect(changed.error?.message).toContain('FINANCE_IDEMPOTENCY_MISMATCH');
    const updated = await director.client.rpc('finance_update_contract_terms_v2', {
      p_institution_id: institutionId, p_contract_id: contract.contract_id,
      p_monthly_amount_cents: 11000, p_scholarship_per_installment_cents: 1000,
      p_discount_per_installment_cents: 500, p_punctuality_discount_cents: 200,
      p_fine_rate_bps: 0, p_monthly_interest_rate_bps: 0, p_grace_days: 0,
      p_notes: 'Condições revisadas', p_reason: 'Ajuste de teste autorizado',
    });
    expect(updated.error).toBeNull();
    expect(updated.data.unpaid_invoices_updated).toBe(12);
    const audit = await director.client.rpc('finance_list_audit_events_v2', {
      p_institution_id: institutionId, p_entity_type: 'CONTRACT', p_entity_id: contract.contract_id,
      p_page: 1, p_page_size: 20,
    });
    expect(audit.error).toBeNull();
    expect(audit.data.rows.some((row: any) => row.action === 'CONTRACT_TERMS_CHANGED')).toBe(true);
  }, 60_000);

  it('records partial and final receipts, idempotently, and provides only linked guardian data', async () => {
    const created = await director.client.rpc('finance_create_contract_v2', {
      p_institution_id: institutionId, p_student_id: studentId, p_enrollment_id: enrollmentId,
      p_academic_year_id: academicYearId, p_responsible_profile_id: guardian.id,
      p_monthly_amount_cents: 10000, p_enrollment_fee_cents: 0, p_installment_count: 2,
      p_first_due_date: today, p_due_day: Number(today.slice(8, 10)),
      p_scholarship_per_installment_cents: 1000, p_discount_per_installment_cents: 500,
      p_punctuality_discount_cents: 200, p_fine_rate_bps: 0, p_monthly_interest_rate_bps: 0,
      p_grace_days: 0, p_notes: null, p_idempotency_key: `payment-contract-${suffix}`,
    });
    expect(created.error).toBeNull();
    const contract = created.data;
    const firstInvoiceId = contract.invoice_ids[0];
    const paidAt = new Date(Date.now() - 1_000).toISOString();
    const firstArgs = {
      p_institution_id: institutionId, p_invoice_id: firstInvoiceId, p_amount_cents: 4000,
      p_method: 'MANUAL', p_paid_at: paidAt, p_notes: 'Parcial de teste', p_idempotency_key: `receipt-a-${suffix}`,
    };
    const partial = await director.client.rpc('finance_register_manual_receipt_v2', firstArgs);
    expect(partial.error).toBeNull();
    const partialReplay = await director.client.rpc('finance_register_manual_receipt_v2', firstArgs);
    expect(partialReplay.error).toBeNull();
    expect(partialReplay.data.replayed).toBe(true);
    const finalArgs = { ...firstArgs, p_amount_cents: 4300, p_notes: 'Quitação de teste', p_idempotency_key: `receipt-b-${suffix}` };
    const final = await director.client.rpc('finance_register_manual_receipt_v2', finalArgs);
    expect(final.error).toBeNull();
    const mismatch = await director.client.rpc('finance_register_manual_receipt_v2', { ...firstArgs, p_amount_cents: 4001 });
    expect(mismatch.error?.message).toContain('FINANCE_IDEMPOTENCY_MISMATCH');
    const notesMismatch = await director.client.rpc('finance_register_manual_receipt_v2', { ...firstArgs, p_notes: 'Observação diferente' });
    expect(notesMismatch.error?.message).toContain('FINANCE_IDEMPOTENCY_MISMATCH');
    const invoice = await director.client.from('invoices').select('amount_paid, status, discount_amount')
      .eq('id', firstInvoiceId).single();
    expect(invoice.error).toBeNull();
    expect(invoice.data.amount_paid).toBe(8300);
    expect(invoice.data.status).toBe('PAID');
    expect(invoice.data.discount_amount).toBe(1700);
    const overpay = await director.client.rpc('finance_register_manual_receipt_v2', {
      ...firstArgs, p_invoice_id: contract.invoice_ids[1], p_amount_cents: 8501,
      p_idempotency_key: `receipt-overpay-${suffix}`,
    });
    expect(overpay.error?.message).toContain('FINANCE_PAYMENT_EXCEEDS_OPEN_BALANCE');

    const portal = await guardian.client.rpc('finance_guardian_portal_v2');
    expect(portal.error).toBeNull();
    expect(portal.data.map((row: any) => row.contract_id)).toContain(guardianPortalContractId);
    expect(portal.data.map((row: any) => row.contract_id)).toContain(contract.contract_id);
    const otherPortal = await secondGuardian.client.rpc('finance_guardian_portal_v2');
    expect(otherPortal.error).toBeNull();
    expect(otherPortal.data).toEqual([]);

    const payment = await director.client.from('payments').select('id').eq('invoice_id', firstInvoiceId).eq('status', 'PAID').order('created_at').limit(1).single();
    expect(payment.error).toBeNull();
    const reversed = await director.client.rpc('finance_reverse_payment_v2', {
      p_institution_id: institutionId, p_payment_id: payment.data.id, p_reason: 'Estorno fictício de teste',
    });
    expect(reversed.error).toBeNull();
    const afterReverse = await director.client.from('invoices').select('amount_paid, status').eq('id', firstInvoiceId).single();
    expect(afterReverse.data.amount_paid).toBe(4300);
    expect(afterReverse.data.status).toBe('PARTIALLY_PAID');
  }, 60_000);

  it('isolates staff, drafts reminders, stores private expense documents, recurrence and cash flow', async () => {
    const directWrite = await director.client.from('finance_expenses').insert({
      institution_id: institutionId, category_id: '00000000-0000-0000-0000-000000000000',
      description: 'escrita proibida', amount_cents: 1, competence_date: `${today.slice(0, 7)}-01`,
      due_date: today, idempotency_key: `direct-${suffix}`,
    });
    expect(directWrite.error).not.toBeNull();
    const teacherDashboard = await teacher.client.rpc('finance_dashboard_v2', {
      p_institution_id: institutionId, p_from: today, p_to: today,
    });
    expect(teacherDashboard.error?.code).toBe('42501');
    const foreignDashboard = await foreignDirector.client.rpc('finance_dashboard_v2', {
      p_institution_id: institutionId, p_from: today, p_to: today,
    });
    expect(foreignDashboard.error?.code).toBe('42501');

    const overdueContract = await director.client.rpc('finance_create_contract_v2', {
      p_institution_id: institutionId, p_student_id: secondStudentId, p_enrollment_id: null,
      p_academic_year_id: academicYearId, p_responsible_profile_id: secondGuardian.id,
      p_monthly_amount_cents: 5000, p_enrollment_fee_cents: 0, p_installment_count: 1,
      p_first_due_date: shiftDate(today, -10), p_due_day: Number(today.slice(8, 10)),
      p_scholarship_per_installment_cents: 0, p_discount_per_installment_cents: 0,
      p_punctuality_discount_cents: 0, p_fine_rate_bps: 0, p_monthly_interest_rate_bps: 0,
      p_grace_days: 0, p_notes: null, p_idempotency_key: `overdue-${suffix}`,
    });
    expect(overdueContract.error).toBeNull();
    const secondGuardianPortal = await secondGuardian.client.rpc('finance_guardian_portal_v2');
    expect(secondGuardianPortal.error).toBeNull();
    expect(secondGuardianPortal.data.map((row: any) => row.contract_id)).toEqual([overdueContract.data.contract_id]);
    const firstGuardianPortal = await guardian.client.rpc('finance_guardian_portal_v2');
    expect(firstGuardianPortal.error).toBeNull();
    expect(firstGuardianPortal.data.map((row: any) => row.contract_id)).not.toContain(overdueContract.data.contract_id);

    const sortedInvoices = await director.client.rpc('finance_list_invoices_v2', {
      p_institution_id: institutionId, p_page: 1, p_page_size: 20, p_search: '', p_status: '',
      p_due_from: null, p_due_to: null, p_sort_by: 'balance', p_sort_direction: 'DESC',
    });
    expect(sortedInvoices.error).toBeNull();
    const balances = sortedInvoices.data.rows.map((row: any) => row.balance_cents);
    expect(balances).toEqual([...balances].sort((left: number, right: number) => right - left));
    const reminder = await director.client.rpc('finance_prepare_reminder_v2', {
      p_institution_id: institutionId, p_invoice_id: overdueContract.data.invoice_ids[0],
      p_reminder_type: 'OVERDUE', p_idempotency_key: `draft-${suffix}`,
    });
    expect(reminder.error).toBeNull();
    expect(reminder.data.status).toBe('DRAFT');
    const drafts = await director.client.rpc('finance_list_reminder_drafts_v2', {
      p_institution_id: institutionId, p_page: 1, p_page_size: 20,
    });
    expect(drafts.error).toBeNull();
    expect(drafts.data.rows.some((row: any) => row.id === reminder.data.reminder_id)).toBe(true);

    const category = await director.client.from('finance_expense_categories').select('id').limit(1).single();
    expect(category.error).toBeNull();
    const supplier = await director.client.rpc('finance_create_supplier_v2', {
      p_institution_id: institutionId, p_name: `Fornecedor ${suffix}`, p_tax_id: null, p_contact: null,
    });
    expect(supplier.error).toBeNull();
    const paymentDate = `${today}T12:00:00.000Z`;
    const { data: upload, error: uploadError } = await director.client.storage.from('finance-documents')
      .upload(`${institutionId}/${crypto.randomUUID()}.pdf`, new Blob(['documento fictício'], { type: 'application/pdf' }), { contentType: 'application/pdf' });
    expect(uploadError).toBeNull();
    const objectPath = required(upload?.path, 'uploaded finance document path');
    const downloaded = await director.client.storage.from('finance-documents').download(objectPath);
    expect(downloaded.error).toBeNull();
    const foreignDownload = await foreignDirector.client.storage.from('finance-documents').download(objectPath);
    expect(foreignDownload.error).not.toBeNull();

    const recurring = await director.client.rpc('finance_create_expenses_v2', {
      p_institution_id: institutionId, p_category_id: category.data.id, p_supplier_id: supplier.data,
      p_description: `Despesa recorrente ${suffix}`, p_amount_cents: 2500,
      p_competence_date: '2028-01-01', p_first_due_date: '2028-01-31', p_recurrence_count: 3,
      p_notes: null, p_document_path: objectPath, p_idempotency_key: `expense-recurring-${suffix}`,
    });
    expect(recurring.error).toBeNull();
    const replay = await director.client.rpc('finance_create_expenses_v2', {
      p_institution_id: institutionId, p_category_id: category.data.id, p_supplier_id: supplier.data,
      p_description: `Despesa recorrente ${suffix}`, p_amount_cents: 2500,
      p_competence_date: '2028-01-01', p_first_due_date: '2028-01-31', p_recurrence_count: 3,
      p_notes: null, p_document_path: objectPath, p_idempotency_key: `expense-recurring-${suffix}`,
    });
    expect(replay.error).toBeNull();
    expect(replay.data.replayed).toBe(true);
    const expenses = await director.client.from('finance_expenses').select('due_date, document_path, recurrence_index')
      .eq('recurrence_group_id', (await director.client.from('finance_expenses').select('recurrence_group_id').eq('id', recurring.data.expense_ids[0]).single()).data?.recurrence_group_id)
      .order('recurrence_index');
    expect(expenses.error).toBeNull();
    expect(expenses.data.map((row: any) => row.due_date)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
    expect(expenses.data.every((row: any) => row.document_path === objectPath)).toBe(true);

    const currentExpense = await director.client.rpc('finance_create_expenses_v2', {
      p_institution_id: institutionId, p_category_id: category.data.id, p_supplier_id: null,
      p_description: `Despesa caixa ${suffix}`, p_amount_cents: 1200,
      p_competence_date: `${today.slice(0, 7)}-01`, p_first_due_date: today, p_recurrence_count: 1,
      p_notes: null, p_document_path: null, p_idempotency_key: `expense-cash-${suffix}`,
    });
    expect(currentExpense.error).toBeNull();
    const markedPaid = await director.client.rpc('finance_mark_expense_paid_v2', {
      p_institution_id: institutionId, p_expense_id: currentExpense.data.expense_ids[0],
      p_method: 'MANUAL', p_paid_at: paymentDate, p_idempotency_key: `expense-pay-${suffix}`, p_notes: null,
    });
    expect(markedPaid.error).toBeNull();
    const settings = await director.client.rpc('finance_update_settings_v2', {
      p_institution_id: institutionId, p_default_due_day: 10, p_opening_balance_cents: 10000,
      p_opening_balance_date: today, p_reminder_days_before: 3, p_reminder_days_after: 1,
      p_in_app_reminders_enabled: false,
    });
    expect(settings.error).toBeNull();
    const dashboard = await director.client.rpc('finance_dashboard_v2', {
      p_institution_id: institutionId, p_from: today, p_to: today,
    });
    expect(dashboard.error).toBeNull();
    expect(dashboard.data.received_cents).toBe(4300);
    expect(dashboard.data.expenses_paid_cents).toBe(1200);
    expect(dashboard.data.opening_balance_cents).toBe(10000);
    expect(dashboard.data.closing_balance_cents).toBe(13100);
    expect(dashboard.data.cash_is_bank_reconciled).toBe(false);
    const breakdown = await director.client.rpc('finance_report_breakdown_v2', {
      p_institution_id: institutionId, p_from: today, p_to: today,
    });
    expect(breakdown.error).toBeNull();
    const classRow = breakdown.data.revenue_by_class.find((row: any) => row.class_id === classId);
    expect(classRow.received_cents).toBe(4300);
    expect(breakdown.data.discounts.scholarship_cents).toBeGreaterThanOrEqual(1000);
  }, 60_000);
});
