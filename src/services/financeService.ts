import { supabase } from '../lib/supabaseClient';

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIALLY_PAID' | 'NEGOTIATED';
export type FinancePaymentMethod = 'MANUAL' | 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'OTHER';

export interface PagedResult<T> {
  rows: T[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface InvoiceRow {
  id: string;
  institution_id: string;
  contract_id: string;
  student_id: string;
  financial_responsible_profile_id: string;
  reference: string;
  due_date: string;
  base_amount: number;
  discount_amount: number;
  scholarship_amount: number;
  punctuality_discount_amount: number;
  fine_amount: number;
  interest_amount: number;
  amount_paid: number;
  amount_due_now: number;
  balance_cents: number;
  status: InvoiceStatus;
  sequence_number: number;
  student_name: string;
  responsible_name: string | null;
}

export interface ContractRow {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string;
  financial_responsible_profile_id: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';
  base_amount: number;
  enrollment_fee_amount: number;
  installment_count: number;
  first_due_date: string;
  default_due_day: number;
  notes: string | null;
  monthly_amount_cents: number;
  scholarship_per_installment_cents: number;
  discount_per_installment_cents: number;
  punctuality_discount_cents: number;
  fine_rate_bps: number;
  monthly_interest_rate_bps: number;
  grace_days: number;
  created_at: string;
  student_name: string;
  responsible_name: string;
  academic_year_name: string;
  invoice_count: number;
}

export interface PaymentRow {
  id: string;
  institution_id: string;
  invoice_id: string;
  provider: string;
  method: FinancePaymentMethod;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REVERSED';
  paid_at: string | null;
  notes: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reference: string;
  student_name: string;
  responsible_name: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  institution_id: string;
  category_id: string;
  category_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  description: string;
  amount_cents: number;
  competence_date: string;
  due_date: string;
  status: 'OPEN' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'REVERSED';
  paid_at: string | null;
  payment_method: FinancePaymentMethod | null;
  recurrence_group_id: string | null;
  recurrence_index: number;
  document_path: string | null;
  notes: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string;
}

export interface FinanceDashboard {
  period_from: string;
  period_to: string;
  received_cents: number;
  receivable_cents: number;
  receivable_period_cents: number;
  overdue_cents: number;
  delinquency_ratio: number;
  expenses_paid_cents: number;
  expenses_due_cents: number;
  opening_balance_cents: number;
  closing_balance_cents: number;
  forecast_in_cents: number;
  forecast_out_cents: number;
  projected_balance_cents: number;
  opening_balance_configured: boolean;
  cash_is_bank_reconciled: false;
  monthly_series: Array<{ month: string; received_cents: number; expenses_cents: number; net_cents: number }>;
}

export interface FinanceSettings {
  institution_id: string;
  default_due_day: number;
  opening_balance_cents: number;
  opening_balance_date: string;
  reminder_days_before: number;
  reminder_days_after: number;
  in_app_reminders_enabled: boolean;
  external_reminders_enabled: false;
}

export interface FinanceExpenseCategory { id: string; name: string; sort_order: number; }
export interface FinanceSupplier { id: string; name: string; contact: string | null; active: boolean; }
export interface GuardianFinanceContract {
  contract_id: string;
  institution_id: string;
  institution_name: string;
  student_name: string;
  status: string;
  monthly_amount_cents: number;
  installment_count: number;
  invoices: Array<{
    id: string; reference: string; due_date: string; amount_due_cents: number;
    amount_paid_cents: number; balance_cents: number; status: InvoiceStatus;
    receipts: Array<{ id: string; amount_cents: number; method: FinancePaymentMethod; paid_at: string; status: string }>;
  }>;
}

export interface FinanceReminderDraft {
  id: string;
  invoice_id: string;
  recipient_profile_id: string;
  reminder_type: 'UPCOMING' | 'OVERDUE';
  cycle_date: string;
  due_date_snapshot: string;
  balance_cents_snapshot: number;
  message: string;
  status: 'DRAFT' | 'CANCELLED';
  prepared_at: string;
  reference: string;
  recipient_name: string;
  student_name: string;
}

export interface FinanceAuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface FinanceReportBreakdown {
  revenue_by_class: Array<{ class_id: string | null; class_name: string; received_cents: number; invoice_count: number }>;
  discounts: { discount_cents: number; scholarship_cents: number; punctuality_discount_cents: number };
  period_from: string;
  period_to: string;
}

export interface FinanceContractCandidate {
  id: string;
  registration_number: string;
  full_name: string;
  responsibles: Array<{ profile_id: string; full_name: string }>;
  enrollments: Array<{ id: string; class_name: string; academic_year_id: string; academic_year_name: string }>;
}

export interface FinanceContractCandidates extends PagedResult<FinanceContractCandidate> {
  academic_years: Array<{ id: string; name: string }>;
}

interface PageOptions {
  institutionId: string;
  page: number;
  pageSize?: number;
  search?: string;
  status?: string;
  from?: string | null;
  to?: string | null;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

const DEFAULT_PAGE_SIZE = 20;

function requireData<T>(data: unknown, label: string): T {
  if (data === null || data === undefined) throw new Error(`${label}: resposta vazia.`);
  return data as T;
}

function requirePaged<T>(data: unknown, label: string): PagedResult<T> {
  const result = requireData<PagedResult<T>>(data, label);
  return { ...result, rows: result.rows ?? [] };
}

function rpcError(error: { message: string; code?: string } | null, fallback: string): void {
  if (!error) return;
  const messages: Record<string, string> = {
    FINANCE_FORBIDDEN: 'Seu perfil não tem permissão para esta operação financeira.',
    FINANCE_RESPONSIBLE_NOT_LINKED_TO_STUDENT: 'O responsável financeiro precisa estar vinculado ao estudante.',
    FINANCE_PAYMENT_EXCEEDS_OPEN_BALANCE: 'O valor excede o saldo em aberto desta parcela.',
    FINANCE_IDEMPOTENCY_MISMATCH: 'Esta chave já foi usada em uma operação financeira diferente.',
    FINANCE_REVERSAL_REASON_REQUIRED: 'Informe o motivo do estorno.',
  };
  const known = Object.entries(messages).find(([code]) => error.message.includes(code));
  throw new Error(known?.[1] ?? `${fallback}${error.code ? ` (${error.code})` : ''}`);
}

export const financeService = {
  async listContractCandidates(institutionId: string, page: number, search: string): Promise<FinanceContractCandidates> {
    const { data, error } = await supabase.rpc('finance_list_contract_candidates_v2', {
      p_institution_id: institutionId, p_page: page, p_page_size: DEFAULT_PAGE_SIZE,
      p_search: search.trim(),
    });
    rpcError(error, 'Não foi possível carregar os estudantes e responsáveis vinculados.');
    return requireData<FinanceContractCandidates>(data, 'Estudantes elegíveis');
  },

  async dashboard(institutionId: string, from: string, to: string): Promise<FinanceDashboard> {
    const { data, error } = await supabase.rpc('finance_dashboard_v2', {
      p_institution_id: institutionId, p_from: from, p_to: to,
    });
    rpcError(error, 'Não foi possível carregar o resumo financeiro.');
    return requireData<FinanceDashboard>(data, 'Resumo financeiro');
  },

  async listInvoices(options: PageOptions): Promise<PagedResult<InvoiceRow>> {
    const { data, error } = await supabase.rpc('finance_list_invoices_v2', {
      p_institution_id: options.institutionId, p_page: options.page,
      p_page_size: options.pageSize ?? DEFAULT_PAGE_SIZE, p_search: options.search?.trim() ?? '',
      p_status: options.status ?? '', p_due_from: options.from ?? null, p_due_to: options.to ?? null,
      p_sort_by: options.sortBy ?? 'due_date', p_sort_direction: options.sortDirection ?? 'ASC',
    });
    rpcError(error, 'Não foi possível carregar as mensalidades.');
    return requirePaged<InvoiceRow>(data, 'Mensalidades');
  },

  async listContracts(options: Omit<PageOptions, 'from' | 'to'>): Promise<PagedResult<ContractRow>> {
    const { data, error } = await supabase.rpc('finance_list_contracts_v2', {
      p_institution_id: options.institutionId, p_page: options.page,
      p_page_size: options.pageSize ?? DEFAULT_PAGE_SIZE, p_search: options.search?.trim() ?? '',
      p_status: options.status ?? '',
      p_sort_by: options.sortBy ?? 'created_at', p_sort_direction: options.sortDirection ?? 'DESC',
    });
    rpcError(error, 'Não foi possível carregar os contratos.');
    return requirePaged<ContractRow>(data, 'Contratos');
  },

  async listPayments(options: PageOptions): Promise<PagedResult<PaymentRow>> {
    const { data, error } = await supabase.rpc('finance_list_payments_v2', {
      p_institution_id: options.institutionId, p_page: options.page,
      p_page_size: options.pageSize ?? DEFAULT_PAGE_SIZE, p_search: options.search?.trim() ?? '',
      p_status: options.status ?? '', p_paid_from: options.from ?? null, p_paid_to: options.to ?? null,
      p_sort_by: options.sortBy ?? 'paid_at', p_sort_direction: options.sortDirection ?? 'DESC',
    });
    rpcError(error, 'Não foi possível carregar os recebimentos.');
    return requirePaged<PaymentRow>(data, 'Recebimentos');
  },

  async listExpenses(options: PageOptions): Promise<PagedResult<ExpenseRow>> {
    const { data, error } = await supabase.rpc('finance_list_expenses_v2', {
      p_institution_id: options.institutionId, p_page: options.page,
      p_page_size: options.pageSize ?? DEFAULT_PAGE_SIZE, p_search: options.search?.trim() ?? '',
      p_status: options.status ?? '', p_due_from: options.from ?? null, p_due_to: options.to ?? null,
      p_sort_by: options.sortBy ?? 'due_date', p_sort_direction: options.sortDirection ?? 'ASC',
    });
    rpcError(error, 'Não foi possível carregar despesas e contas a pagar.');
    return requirePaged<ExpenseRow>(data, 'Despesas');
  },

  async categories(): Promise<FinanceExpenseCategory[]> {
    const { data, error } = await supabase.from('finance_expense_categories')
      .select('id, name, sort_order').eq('active', true).order('sort_order');
    if (error) throw error;
    return (data ?? []) as FinanceExpenseCategory[];
  },

  async suppliers(institutionId: string, search = ''): Promise<FinanceSupplier[]> {
    const { data, error } = await supabase.rpc('finance_list_suppliers_v2', {
      p_institution_id: institutionId, p_search: search,
    });
    rpcError(error, 'Não foi possível carregar fornecedores.');
    return (data ?? []) as FinanceSupplier[];
  },

  async createSupplier(institutionId: string, name: string, contact?: string): Promise<string> {
    const { data, error } = await supabase.rpc('finance_create_supplier_v2', {
      p_institution_id: institutionId, p_name: name, p_tax_id: null, p_contact: contact?.trim() || null,
    });
    rpcError(error, 'Não foi possível cadastrar o fornecedor.');
    return requireData<string>(data, 'Fornecedor');
  },

  async createContract(input: {
    institutionId: string; studentId: string; enrollmentId?: string | null; academicYearId: string;
    responsibleProfileId: string; monthlyAmountCents: number; enrollmentFeeCents: number;
    installmentCount: number; firstDueDate: string; dueDay: number; scholarshipCents: number;
    discountCents: number; punctualityDiscountCents: number; fineRateBps: number;
    monthlyInterestRateBps: number; graceDays: number; notes?: string; idempotencyKey: string;
  }): Promise<{ contract_id: string; invoice_ids: string[]; replayed: boolean }> {
    const { data, error } = await supabase.rpc('finance_create_contract_v2', {
      p_institution_id: input.institutionId, p_student_id: input.studentId,
      p_enrollment_id: input.enrollmentId ?? null, p_academic_year_id: input.academicYearId,
      p_responsible_profile_id: input.responsibleProfileId,
      p_monthly_amount_cents: input.monthlyAmountCents, p_enrollment_fee_cents: input.enrollmentFeeCents,
      p_installment_count: input.installmentCount, p_first_due_date: input.firstDueDate,
      p_due_day: input.dueDay, p_scholarship_per_installment_cents: input.scholarshipCents,
      p_discount_per_installment_cents: input.discountCents,
      p_punctuality_discount_cents: input.punctualityDiscountCents,
      p_fine_rate_bps: input.fineRateBps, p_monthly_interest_rate_bps: input.monthlyInterestRateBps,
      p_grace_days: input.graceDays, p_notes: input.notes?.trim() || null,
      p_idempotency_key: input.idempotencyKey,
    });
    rpcError(error, 'Não foi possível criar o contrato e suas mensalidades.');
    return requireData(data, 'Contrato');
  },

  async setContractStatus(institutionId: string, contractId: string, status: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('finance_set_contract_status_v2', {
      p_institution_id: institutionId, p_contract_id: contractId, p_status: status, p_reason: reason.trim() || null,
    });
    rpcError(error, 'Não foi possível atualizar o contrato.');
  },

  async updateContractTerms(input: {
    institutionId: string; contractId: string; monthlyAmountCents: number;
    scholarshipCents: number; discountCents: number; punctualityDiscountCents: number;
    fineRateBps: number; monthlyInterestRateBps: number; graceDays: number;
    notes?: string; reason: string;
  }): Promise<{ contract_id: string; unpaid_invoices_updated: number }> {
    const { data, error } = await supabase.rpc('finance_update_contract_terms_v2', {
      p_institution_id: input.institutionId, p_contract_id: input.contractId,
      p_monthly_amount_cents: input.monthlyAmountCents,
      p_scholarship_per_installment_cents: input.scholarshipCents,
      p_discount_per_installment_cents: input.discountCents,
      p_punctuality_discount_cents: input.punctualityDiscountCents,
      p_fine_rate_bps: input.fineRateBps,
      p_monthly_interest_rate_bps: input.monthlyInterestRateBps,
      p_grace_days: input.graceDays, p_notes: input.notes?.trim() || null,
      p_reason: input.reason.trim(),
    });
    rpcError(error, 'Não foi possível alterar as condições do contrato.');
    return requireData(data, 'Atualização do contrato');
  },

  async registerReceipt(input: {
    institutionId: string; invoiceId: string; amountCents: number; method: FinancePaymentMethod;
    paidAt: string; notes?: string; idempotencyKey: string;
  }): Promise<{ payment_id: string; invoice_id: string; replayed: boolean }> {
    const { data, error } = await supabase.rpc('finance_register_manual_receipt_v2', {
      p_institution_id: input.institutionId, p_invoice_id: input.invoiceId,
      p_amount_cents: input.amountCents, p_method: input.method, p_paid_at: input.paidAt,
      p_notes: input.notes?.trim() || null, p_idempotency_key: input.idempotencyKey,
    });
    rpcError(error, 'Não foi possível registrar o recebimento.');
    return requireData(data, 'Recebimento');
  },

  async reversePayment(institutionId: string, paymentId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('finance_reverse_payment_v2', {
      p_institution_id: institutionId, p_payment_id: paymentId, p_reason: reason.trim(),
    });
    rpcError(error, 'Não foi possível estornar o recebimento.');
  },

  async createExpenses(input: {
    institutionId: string; categoryId: string; supplierId?: string | null; description: string;
    amountCents: number; competenceDate: string; firstDueDate: string; recurrenceCount: number;
    notes?: string; documentPath?: string | null; idempotencyKey: string;
  }): Promise<{ expense_ids: string[]; replayed: boolean }> {
    const { data, error } = await supabase.rpc('finance_create_expenses_v2', {
      p_institution_id: input.institutionId, p_category_id: input.categoryId,
      p_supplier_id: input.supplierId ?? null, p_description: input.description,
      p_amount_cents: input.amountCents, p_competence_date: input.competenceDate,
      p_first_due_date: input.firstDueDate, p_recurrence_count: input.recurrenceCount,
      p_notes: input.notes?.trim() || null, p_document_path: input.documentPath ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
    rpcError(error, 'Não foi possível cadastrar a despesa.');
    return requireData(data, 'Despesa');
  },

  async uploadExpenseDocument(institutionId: string, file: File): Promise<string> {
    const extensionsByType: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const extension = extensionsByType[file.type];
    if (!extension || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      throw new Error('Anexe PDF, DOC, DOCX, JPG, PNG ou WEBP de até 10 MB.');
    }
    const path = `${institutionId}/${globalThis.crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('finance-documents').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) throw new Error(`Não foi possível anexar o documento: ${error.message}`);
    return path;
  },

  async removeExpenseDocument(path: string): Promise<void> {
    const { error } = await supabase.storage.from('finance-documents').remove([path]);
    if (error) throw error;
  },

  async downloadExpenseDocument(path: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from('finance-documents').download(path);
    if (error) throw new Error(`Não foi possível baixar o documento: ${error.message}`);
    return data;
  },

  async markExpensePaid(input: {
    institutionId: string; expenseId: string; method: FinancePaymentMethod; paidAt: string;
    idempotencyKey: string; notes?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('finance_mark_expense_paid_v2', {
      p_institution_id: input.institutionId, p_expense_id: input.expenseId,
      p_method: input.method, p_paid_at: input.paidAt, p_idempotency_key: input.idempotencyKey,
      p_notes: input.notes?.trim() || null,
    });
    rpcError(error, 'Não foi possível registrar o pagamento da despesa.');
  },

  async reverseExpense(institutionId: string, expenseId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('finance_reverse_expense_payment_v2', {
      p_institution_id: institutionId, p_expense_id: expenseId, p_reason: reason.trim(),
    });
    rpcError(error, 'Não foi possível estornar o pagamento da despesa.');
  },

  async cancelExpense(institutionId: string, expenseId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('finance_cancel_expense_v2', {
      p_institution_id: institutionId, p_expense_id: expenseId, p_reason: reason.trim(),
    });
    rpcError(error, 'Não foi possível cancelar a despesa.');
  },

  async prepareReminder(input: {
    institutionId: string; invoiceId: string; reminderType: 'UPCOMING' | 'OVERDUE'; idempotencyKey: string;
  }): Promise<{ reminder_id: string; replayed: boolean; status: string }> {
    const { data, error } = await supabase.rpc('finance_prepare_reminder_v2', {
      p_institution_id: input.institutionId, p_invoice_id: input.invoiceId,
      p_reminder_type: input.reminderType, p_idempotency_key: input.idempotencyKey,
    });
    rpcError(error, 'Não foi possível preparar o lembrete administrativo.');
    return requireData(data, 'Lembrete');
  },

  async listReminderDrafts(institutionId: string, page = 1): Promise<PagedResult<FinanceReminderDraft>> {
    const { data, error } = await supabase.rpc('finance_list_reminder_drafts_v2', {
      p_institution_id: institutionId, p_page: page, p_page_size: DEFAULT_PAGE_SIZE,
    });
    rpcError(error, 'Não foi possível carregar os rascunhos de lembrete.');
    return requirePaged<FinanceReminderDraft>(data, 'Rascunhos de lembrete');
  },

  async settings(institutionId: string): Promise<FinanceSettings> {
    const { data, error } = await supabase.rpc('finance_get_settings_v2', { p_institution_id: institutionId });
    rpcError(error, 'Não foi possível carregar as configurações financeiras.');
    return requireData<FinanceSettings>(data, 'Configurações');
  },

  async updateSettings(input: {
    institutionId: string; defaultDueDay: number; openingBalanceCents: number; openingBalanceDate: string;
    reminderDaysBefore: number; reminderDaysAfter: number; inAppRemindersEnabled: boolean;
  }): Promise<FinanceSettings> {
    const { data, error } = await supabase.rpc('finance_update_settings_v2', {
      p_institution_id: input.institutionId, p_default_due_day: input.defaultDueDay,
      p_opening_balance_cents: input.openingBalanceCents, p_opening_balance_date: input.openingBalanceDate,
      p_reminder_days_before: input.reminderDaysBefore, p_reminder_days_after: input.reminderDaysAfter,
      p_in_app_reminders_enabled: input.inAppRemindersEnabled,
    });
    rpcError(error, 'Não foi possível salvar as configurações financeiras.');
    return requireData<FinanceSettings>(data, 'Configurações');
  },

  async guardianPortal(): Promise<GuardianFinanceContract[]> {
    const { data, error } = await supabase.rpc('finance_guardian_portal_v2');
    rpcError(error, 'Não foi possível carregar os dados financeiros vinculados ao responsável.');
    return (data ?? []) as GuardianFinanceContract[];
  },

  async auditEvents(institutionId: string, entityType: string | null, entityId: string | null, page = 1): Promise<PagedResult<FinanceAuditEvent>> {
    const { data, error } = await supabase.rpc('finance_list_audit_events_v2', {
      p_institution_id: institutionId, p_entity_type: entityType, p_entity_id: entityId,
      p_page: page, p_page_size: DEFAULT_PAGE_SIZE,
    });
    rpcError(error, 'Não foi possível consultar o histórico financeiro.');
    return requirePaged<FinanceAuditEvent>(data, 'Histórico');
  },

  async reportBreakdown(institutionId: string, from: string, to: string): Promise<FinanceReportBreakdown> {
    const { data, error } = await supabase.rpc('finance_report_breakdown_v2', {
      p_institution_id: institutionId, p_from: from, p_to: to,
    });
    rpcError(error, 'Não foi possível carregar os relatórios por turma e descontos.');
    return requireData<FinanceReportBreakdown>(data, 'Detalhamento financeiro');
  },
};

export function makeFinanceIdempotencyKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
