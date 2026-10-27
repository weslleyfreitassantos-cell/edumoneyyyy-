import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BadgeAlert, BookOpenCheck,
  ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleDollarSign,
  ClipboardList, FileDown, FileText, HandCoins, ReceiptText, Search,
  Settings2, ShieldCheck, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useFinance, type FinanceSection } from '../../../hooks/useFinance';
import {
  financeService, makeFinanceIdempotencyKey,
  type ContractRow, type ExpenseRow, type FinancePaymentMethod, type InvoiceRow, type PaymentRow,
} from '../../../services/financeService';

const pageSize = 20;
const money = (cents: number) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthStart = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
const monthEnd = (date = new Date()) => localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
const parseCents = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
const parseBasisPoints = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);
const prettyDate = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';
const paidAtTimestamp = (value: string) => {
  const requested = new Date(`${value}T12:00:00`).getTime();
  return new Date(Math.min(requested, Date.now())).toISOString();
};
const receiptAmountFor = (invoice: InvoiceRow) => {
  const punctualityEligible = invoice.due_date >= localDate() && invoice.punctuality_discount_amount > 0;
  return Math.max(0, invoice.balance_cents - (punctualityEligible ? invoice.punctuality_discount_amount : 0));
};
const methodLabel: Record<FinancePaymentMethod, string> = {
  MANUAL: 'Registro manual', PIX: 'PIX informado', BOLETO: 'Boleto informado', CREDIT_CARD: 'Cartão informado',
  CASH: 'Dinheiro', BANK_TRANSFER: 'Transferência', CARD_TERMINAL: 'Cartão na escola', OTHER: 'Outro',
};
const statusLabel: Record<string, string> = {
  OPEN: 'Em aberto', OVERDUE: 'Em atraso', PAID: 'Pago', CANCELLED: 'Cancelado',
  PARTIALLY_PAID: 'Parcial', DRAFT: 'Rascunho', NEGOTIATED: 'Negociado',
  ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', COMPLETED: 'Concluído', REVERSED: 'Estornado',
};

const navigation: Array<{ id: FinanceSection; label: string; icon: typeof Wallet }> = [
  { id: 'overview', label: 'Visão geral', icon: ChartNoAxesCombined },
  { id: 'invoices', label: 'Mensalidades', icon: ReceiptText },
  { id: 'delinquency', label: 'Inadimplência', icon: BadgeAlert },
  { id: 'contracts', label: 'Contratos', icon: BookOpenCheck },
  { id: 'receipts', label: 'Recebimentos', icon: HandCoins },
  { id: 'expenses', label: 'Despesas', icon: ArrowUpRight },
  { id: 'payables', label: 'Contas a pagar', icon: ClipboardList },
  { id: 'reports', label: 'Relatórios', icon: FileText },
  { id: 'settings', label: 'Configurações', icon: Settings2 },
];

type SortDirection = 'ASC' | 'DESC';
type SortChoice = { value: string; label: string };
const sortChoices: Record<'invoices' | 'contracts' | 'receipts' | 'expenses', SortChoice[]> = {
  invoices: [
    { value: 'due_date:ASC', label: 'Vencimento mais próximo' },
    { value: 'due_date:DESC', label: 'Vencimento mais distante' },
    { value: 'student_name:ASC', label: 'Estudante A–Z' },
    { value: 'balance:DESC', label: 'Maior saldo em aberto' },
    { value: 'balance:ASC', label: 'Menor saldo em aberto' },
  ],
  contracts: [
    { value: 'created_at:DESC', label: 'Mais recentes' },
    { value: 'created_at:ASC', label: 'Mais antigos' },
    { value: 'student_name:ASC', label: 'Estudante A–Z' },
    { value: 'monthly_amount:DESC', label: 'Maior mensalidade' },
    { value: 'monthly_amount:ASC', label: 'Menor mensalidade' },
  ],
  receipts: [
    { value: 'paid_at:DESC', label: 'Mais recentes' },
    { value: 'paid_at:ASC', label: 'Mais antigos' },
    { value: 'student_name:ASC', label: 'Estudante A–Z' },
    { value: 'amount:DESC', label: 'Maior valor' },
    { value: 'amount:ASC', label: 'Menor valor' },
  ],
  expenses: [
    { value: 'due_date:ASC', label: 'Vencimento mais próximo' },
    { value: 'due_date:DESC', label: 'Vencimento mais distante' },
    { value: 'description:ASC', label: 'Descrição A–Z' },
    { value: 'amount:DESC', label: 'Maior valor' },
    { value: 'amount:ASC', label: 'Menor valor' },
  ],
};
const defaultSort = (section: FinanceSection): { sortBy: string; sortDirection: SortDirection } => {
  if (section === 'contracts') return { sortBy: 'created_at', sortDirection: 'DESC' };
  if (section === 'receipts') return { sortBy: 'paid_at', sortDirection: 'DESC' };
  if (section === 'expenses' || section === 'payables') return { sortBy: 'due_date', sortDirection: 'ASC' };
  return { sortBy: 'due_date', sortDirection: 'ASC' };
};

const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const buttonClass = 'min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClass = 'min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

type ContractDraft = {
  studentId: string; enrollmentId: string; yearId: string; responsibleId: string;
  monthlyAmount: string; enrollmentFee: string; installments: string; firstDueDate: string; dueDay: string;
  scholarship: string; discount: string; punctualityDiscount: string; fineRate: string; interestRate: string;
  graceDays: string; notes: string;
};

type ExpenseDraft = {
  categoryId: string; supplierId: string; description: string; amount: string; competenceDate: string;
  dueDate: string; recurrenceCount: string; notes: string;
};

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div>;
}

function Pagination({ page, pageSize: size, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
    <span>{total.toLocaleString('pt-BR')} registro(s) · Página {page} de {pages}</span>
    <div className="flex gap-2"><button type="button" className={secondaryButtonClass} aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></button><button type="button" className={secondaryButtonClass} aria-label="Próxima página" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></button></div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'PAID' || status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
    : status === 'OVERDUE' || status === 'REVERSED' || status === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
      : status === 'PARTIALLY_PAID' || status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{statusLabel[status] ?? status}</span>;
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span>{children}</label>;
}

export default function FinanceTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const [section, setSection] = useState<FinanceSection>('overview');
  const [list, setList] = useState({ page: 1, search: '', status: '', from: '', to: '', ...defaultSort('overview') });
  const [period, setPeriod] = useState({ from: monthStart(), to: monthEnd() });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contractCandidateSearch, setContractCandidateSearch] = useState('');
  const [debouncedContractCandidateSearch, setDebouncedContractCandidateSearch] = useState('');
  const [contractCandidatePage, setContractCandidatePage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [contractMessage, setContractMessage] = useState<string | null>(null);
  const [expenseMessage, setExpenseMessage] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRow | null>(null);
  const [expensePayment, setExpensePayment] = useState<ExpenseRow | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<PaymentRow | null>(null);
  const [contractToEdit, setContractToEdit] = useState<ContractRow | null>(null);
  const [auditContract, setAuditContract] = useState<ContractRow | null>(null);
  const [contractEditDraft, setContractEditDraft] = useState({
    monthlyAmount: '', scholarship: '', discount: '', punctualityDiscount: '', fineRate: '', interestRate: '', graceDays: '0', notes: '', reason: '',
  });
  const [receiptDraft, setReceiptDraft] = useState({ amount: '', method: 'MANUAL' as FinancePaymentMethod, date: localDate(), notes: '' });
  const [expensePaymentDraft, setExpensePaymentDraft] = useState({ method: 'MANUAL' as FinancePaymentMethod, date: localDate(), notes: '' });
  const [contract, setContract] = useState<ContractDraft>({
    studentId: '', enrollmentId: '', yearId: '', responsibleId: '', monthlyAmount: '', enrollmentFee: '',
    installments: '12', firstDueDate: localDate(), dueDay: '10', scholarship: '', discount: '',
    punctualityDiscount: '', fineRate: '', interestRate: '', graceDays: '0', notes: '',
  });
  const [expense, setExpense] = useState<ExpenseDraft>({
    categoryId: '', supplierId: '', description: '', amount: '', competenceDate: monthStart(),
    dueDate: localDate(), recurrenceCount: '1', notes: '',
  });
  const [expenseDocument, setExpenseDocument] = useState<File | null>(null);
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '' });
  const [reportType, setReportType] = useState<'invoices' | 'receipts' | 'expenses' | 'contracts' | 'classes' | 'discounts'>('receipts');
  const [settingsDraft, setSettingsDraft] = useState({
    defaultDueDay: '10', openingBalance: '0', openingBalanceDate: localDate(),
    reminderDaysBefore: '3', reminderDaysAfter: '1', inAppRemindersEnabled: false,
  });
  const financeOptions = useMemo(() => ({ page: list.page, pageSize, search: debouncedSearch,
    status: section === 'delinquency' ? 'OVERDUE' : section === 'payables' ? (list.status || 'OPEN_OR_OVERDUE') : list.status,
    from: list.from, to: list.to, sortBy: list.sortBy, sortDirection: list.sortDirection }), [debouncedSearch, list.from, list.page, list.sortBy, list.sortDirection, list.status, list.to, section]);
  const finance = useFinance(institutionId, section, financeOptions, period);
  const contractCandidates = useQuery({
    queryKey: ['finance', institutionId, 'contract-candidates', contractCandidatePage, debouncedContractCandidateSearch],
    queryFn: () => financeService.listContractCandidates(institutionId, contractCandidatePage, debouncedContractCandidateSearch),
    enabled: Boolean(institutionId && section === 'contracts'),
    placeholderData: (previous) => previous,
  });
  const contractAudit = useQuery({
    queryKey: ['finance', institutionId, 'audit', auditContract?.id],
    queryFn: () => financeService.auditEvents(institutionId, 'CONTRACT', auditContract!.id),
    enabled: Boolean(institutionId && auditContract),
  });
  const currentCandidates = contractCandidates.data?.rows ?? [];
  const selectedCandidate = currentCandidates.find((student) => student.id === contract.studentId);
  const eligibleGuardians = selectedCandidate?.responsibles ?? [];
  const eligibleEnrollments = (selectedCandidate?.enrollments ?? []).filter((row) => row.academic_year_id === contract.yearId);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(list.search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [list.search]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedContractCandidateSearch(contractCandidateSearch.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [contractCandidateSearch]);
  useEffect(() => {
    if (!finance.settings.data) return;
    setSettingsDraft({
      defaultDueDay: String(finance.settings.data.default_due_day),
      openingBalance: (finance.settings.data.opening_balance_cents / 100).toFixed(2),
      openingBalanceDate: finance.settings.data.opening_balance_date,
      reminderDaysBefore: String(finance.settings.data.reminder_days_before),
      reminderDaysAfter: String(finance.settings.data.reminder_days_after),
      inAppRemindersEnabled: finance.settings.data.in_app_reminders_enabled,
    });
  }, [finance.settings.data]);
  useEffect(() => {
    if (!contract.studentId) return;
    const linked = eligibleGuardians.find((guardian) => guardian.profile_id === contract.responsibleId);
    if (!linked) setContract((current) => ({ ...current, responsibleId: '' }));
  }, [contract.responsibleId, contract.studentId, eligibleGuardians]);
  useEffect(() => {
    if (!contract.enrollmentId) return;
    if (!eligibleEnrollments.some((row) => row.id === contract.enrollmentId)) {
      setContract((current) => ({ ...current, enrollmentId: '' }));
    }
  }, [contract.enrollmentId, eligibleEnrollments]);

  const dashboard = finance.dashboard.data;
  const invoices = finance.invoices.data?.rows ?? [];
  const contracts = finance.contracts.data?.rows ?? [];
  const payments = finance.payments.data?.rows ?? [];
  const expenses = finance.expenses.data?.rows ?? [];
  const currentList = section === 'invoices' || section === 'delinquency' ? finance.invoices
    : section === 'contracts' ? finance.contracts
      : section === 'receipts' ? finance.payments
        : section === 'expenses' || section === 'payables' ? finance.expenses : null;
  const listError = currentList?.error as Error | null | undefined;
  const isListLoading = Boolean(currentList?.isLoading);

  async function onCreateContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContractMessage(null);
    if (!contract.studentId || !contract.yearId || !contract.responsibleId || !contract.firstDueDate) {
      setContractMessage('Selecione estudante, ano letivo, responsável financeiro e primeiro vencimento.');
      return;
    }
    const monthlyAmountCents = parseCents(contract.monthlyAmount);
    const enrollmentFeeCents = parseCents(contract.enrollmentFee);
    const scholarshipCents = parseCents(contract.scholarship);
    const discountCents = parseCents(contract.discount);
    const punctualityDiscountCents = parseCents(contract.punctualityDiscount);
    if (monthlyAmountCents <= 0 || !Number.isInteger(Number(contract.installments)) || Number(contract.installments) < 1) {
      setContractMessage('Informe um valor mensal e uma quantidade de parcelas válidos.');
      return;
    }
    try {
      const result = await finance.createContract.mutateAsync({
        institutionId, studentId: contract.studentId, enrollmentId: contract.enrollmentId || null,
        academicYearId: contract.yearId, responsibleProfileId: contract.responsibleId,
        monthlyAmountCents, enrollmentFeeCents, installmentCount: Number(contract.installments),
        firstDueDate: contract.firstDueDate, dueDay: Number(contract.dueDay), scholarshipCents,
        discountCents, punctualityDiscountCents, fineRateBps: parseBasisPoints(contract.fineRate || '0'),
        monthlyInterestRateBps: parseBasisPoints(contract.interestRate || '0'),
        graceDays: Number(contract.graceDays || 0), notes: contract.notes,
        idempotencyKey: makeFinanceIdempotencyKey('contract'),
      });
      setContractMessage(result.replayed ? 'Contrato existente recuperado; nenhuma parcela foi duplicada.' : `${result.invoice_ids.length} mensalidades geradas e vinculadas ao contrato.`);
      setContract((current) => ({ ...current, studentId: '', enrollmentId: '', responsibleId: '', monthlyAmount: '', enrollmentFee: '', scholarship: '', discount: '', punctualityDiscount: '', fineRate: '', interestRate: '', notes: '' }));
    } catch (error) {
      setContractMessage(error instanceof Error ? error.message : 'Não foi possível criar o contrato.');
    }
  }

  function openContractEditor(row: ContractRow) {
    setContractEditDraft({
      monthlyAmount: (row.monthly_amount_cents / 100).toFixed(2),
      scholarship: (row.scholarship_per_installment_cents / 100).toFixed(2),
      discount: (row.discount_per_installment_cents / 100).toFixed(2),
      punctualityDiscount: (row.punctuality_discount_cents / 100).toFixed(2),
      fineRate: (row.fine_rate_bps / 100).toFixed(2),
      interestRate: (row.monthly_interest_rate_bps / 100).toFixed(2),
      graceDays: String(row.grace_days), notes: row.notes ?? '', reason: '',
    });
    setContractToEdit(row);
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentInvoice) return;
    try {
      await finance.registerReceipt.mutateAsync({
        institutionId, invoiceId: paymentInvoice.id, amountCents: parseCents(receiptDraft.amount),
        method: receiptDraft.method, paidAt: paidAtTimestamp(receiptDraft.date), notes: receiptDraft.notes,
        idempotencyKey: makeFinanceIdempotencyKey('receipt'),
      });
      setMessage('Recebimento manual registrado. O saldo da parcela foi atualizado.');
      setPaymentInvoice(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar o recebimento.');
    }
  }

  async function onUpdateContractTerms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractToEdit) return;
    try {
      const result = await finance.updateContractTerms.mutateAsync({
        contractId: contractToEdit.id,
        monthlyAmountCents: parseCents(contractEditDraft.monthlyAmount),
        scholarshipCents: parseCents(contractEditDraft.scholarship),
        discountCents: parseCents(contractEditDraft.discount),
        punctualityDiscountCents: parseCents(contractEditDraft.punctualityDiscount),
        fineRateBps: parseBasisPoints(contractEditDraft.fineRate || '0'),
        monthlyInterestRateBps: parseBasisPoints(contractEditDraft.interestRate || '0'),
        graceDays: Number(contractEditDraft.graceDays), notes: contractEditDraft.notes,
        reason: contractEditDraft.reason,
      });
      setMessage(`Condições atualizadas; ${result.unpaid_invoices_updated} parcela(s) sem pagamento foram recalculadas. As parcelas pagas ou parcialmente pagas foram preservadas.`);
      setContractToEdit(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível alterar o contrato.');
    }
  }

  async function prepareOverdueReminder(invoice: InvoiceRow) {
    try {
      const result = await finance.prepareReminder.mutateAsync({
        invoiceId: invoice.id, reminderType: 'OVERDUE', idempotencyKey: makeFinanceIdempotencyKey('reminder'),
      });
      setMessage(result.replayed ? 'Já existe um rascunho de lembrete para esta parcela hoje.' : 'Rascunho administrativo preparado. Nenhuma mensagem foi enviada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível preparar o lembrete.');
    }
  }

  async function onCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseMessage(null);
    let uploadedDocumentPath: string | null = null;
    try {
      if (!expense.categoryId || !expense.description.trim() || parseCents(expense.amount) <= 0) {
        throw new Error('Informe categoria, descrição e valor da despesa.');
      }
      if (expenseDocument) uploadedDocumentPath = await financeService.uploadExpenseDocument(institutionId, expenseDocument);
      const result = await finance.createExpenses.mutateAsync({
        institutionId, categoryId: expense.categoryId, supplierId: expense.supplierId || null,
        description: expense.description, amountCents: parseCents(expense.amount),
        competenceDate: `${expense.competenceDate.slice(0, 7)}-01`, firstDueDate: expense.dueDate,
        recurrenceCount: Number(expense.recurrenceCount), notes: expense.notes, documentPath: uploadedDocumentPath,
        idempotencyKey: makeFinanceIdempotencyKey('expense'),
      });
      setExpenseMessage(`${result.expense_ids.length} lançamento(s) de despesa salvo(s).`);
      setExpense((current) => ({ ...current, description: '', amount: '', notes: '', recurrenceCount: '1' }));
      setExpenseDocument(null);
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Não foi possível salvar a despesa.';
      if (uploadedDocumentPath) {
        try { await financeService.removeExpenseDocument(uploadedDocumentPath); }
        catch { message += ' O anexo foi enviado, mas não pôde ser removido após a falha; informe a administração técnica.'; }
      }
      setExpenseMessage(message);
    }
  }

  async function downloadExpenseDocument(row: ExpenseRow) {
    if (!row.document_path) return;
    try {
      const blob = await financeService.downloadExpenseDocument(row.document_path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.document_path.split('/').pop() ?? 'documento-financeiro';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível baixar o anexo.');
    }
  }

  async function submitExpensePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!expensePayment) return;
    try {
      await finance.markExpensePaid.mutateAsync({
        expenseId: expensePayment.id, method: expensePaymentDraft.method,
        paidAt: paidAtTimestamp(expensePaymentDraft.date), notes: expensePaymentDraft.notes,
        idempotencyKey: makeFinanceIdempotencyKey('expense-payment'),
      });
      setMessage('Pagamento da despesa registrado.');
      setExpensePayment(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar o pagamento da despesa.');
    }
  }

  async function exportReport() {
    try {
      const rows: Array<Record<string, string | number | null>> = [];
      let page = 1;
      let total = 0;
      if (reportType === 'classes') {
        const result = await financeService.reportBreakdown(institutionId, period.from, period.to);
        total = result.revenue_by_class.length;
        rows.push(...result.revenue_by_class.map((row) => ({ turma: row.class_name, parcelas: row.invoice_count, recebido_centavos: row.received_cents })));
      } else if (reportType === 'discounts') {
        const result = await financeService.reportBreakdown(institutionId, period.from, period.to);
        total = 1;
        rows.push({ descontos_centavos: result.discounts.discount_cents, bolsas_centavos: result.discounts.scholarship_cents, pontualidade_centavos: result.discounts.punctuality_discount_cents });
      } else do {
        if (reportType === 'invoices') {
          const result = await financeService.listInvoices({ institutionId, page, pageSize: 100, search: debouncedSearch, status: list.status, from: period.from, to: period.to });
          total = result.total_count;
          rows.push(...result.rows.map((row) => ({
            estudante: row.student_name, responsavel_financeiro: row.responsible_name,
            parcela: row.reference, vencimento: row.due_date, valor_original_centavos: row.base_amount,
            descontos_centavos: row.discount_amount + row.scholarship_amount,
            total_atual_centavos: row.amount_due_now, recebido_centavos: row.amount_paid,
            saldo_centavos: row.balance_cents, situacao: statusLabel[row.status] ?? row.status,
          })));
        } else if (reportType === 'receipts') {
          const result = await financeService.listPayments({ institutionId, page, pageSize: 100, search: debouncedSearch, status: list.status, from: period.from, to: period.to });
          total = result.total_count;
          rows.push(...result.rows.map((row) => ({
            data: row.paid_at, estudante: row.student_name, responsavel_financeiro: row.responsible_name,
            parcela: row.reference, forma: methodLabel[row.method], valor_centavos: row.amount,
            status: statusLabel[row.status] ?? row.status,
          })));
        } else if (reportType === 'expenses') {
          const result = await financeService.listExpenses({ institutionId, page, pageSize: 100, search: debouncedSearch, status: list.status, from: period.from, to: period.to });
          total = result.total_count;
          rows.push(...result.rows.map((row) => ({
            competencia: row.competence_date, vencimento: row.due_date, categoria: row.category_name,
            fornecedor: row.supplier_name, descricao: row.description, valor_centavos: row.amount_cents,
            status: statusLabel[row.status] ?? row.status,
          })));
        } else {
          const result = await financeService.listContracts({ institutionId, page, pageSize: 100, search: debouncedSearch, status: list.status });
          total = result.total_count;
          rows.push(...result.rows.map((row) => ({
            estudante: row.student_name, responsavel_financeiro: row.responsible_name,
            ano_letivo: row.academic_year_name, parcelas: row.installment_count,
            mensalidade_centavos: row.monthly_amount_cents, inicio: row.first_due_date,
            status: statusLabel[row.status] ?? row.status,
          })));
        }
        page += 1;
      } while (rows.length < total && rows.length < 10000);
      if (rows.length === 0) throw new Error('Nenhum registro corresponde aos filtros do relatório.');
      const columns = Object.keys(rows[0]);
      const csv = [columns.join(';'), ...rows.map((row) => columns.map((column) => {
        const value = String(row[column] ?? '').replaceAll('"', '""');
        return `"${value}"`;
      }).join(';'))].join('\r\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `financeiro-${reportType}-${period.from}-${period.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(rows.length < total ? `Exportados ${rows.length} de ${total} registros. Refine o período para exportar o restante.` : `${rows.length} registro(s) exportado(s) em CSV.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível exportar o relatório.');
    }
  }

  async function preparePrintReceipt(payment: PaymentRow) {
    setReceiptToPrint(payment);
    window.setTimeout(() => window.print(), 120);
  }

  const invoiceRows = section === 'delinquency' ? invoices.filter((invoice) => invoice.status === 'OVERDUE') : invoices;
  const cashBalanceIsConfigured = dashboard?.opening_balance_configured;
  const onListPageChange = (page: number) => setList((current) => ({ ...current, page }));

  return <div className="space-y-5">
    <style>{`@media print { body * { visibility: hidden !important; } #finance-administrative-receipt, #finance-administrative-receipt * { visibility: visible !important; } #finance-administrative-receipt { position: fixed; inset: 0; margin: 0; padding: 32px; background: white; color: black; } }`}</style>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-3"><Wallet className="h-7 w-7 text-blue-700" /><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financeiro escolar</h1></div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Receitas, contratos, despesas e fluxo de caixa da instituição.</p></div>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"><ShieldCheck className="h-4 w-4" /> Valores em centavos · acesso restrito</div>
    </header>

    <nav aria-label="Navegação financeira" className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      {navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={section === id ? 'page' : undefined}
        onClick={() => { setSection(id); setList((current) => ({ ...current, page: 1, status: id === 'delinquency' ? 'OVERDUE' : '', ...defaultSort(id) })); setMessage(null); }}
        className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${section === id ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
    </nav>

    {message && <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"><span>{message}</span><button type="button" aria-label="Dispensar aviso" onClick={() => setMessage(null)}><X className="h-4 w-4" /></button></div>}

    {section === 'overview' && <>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <FormField label="De"><input aria-label="Início do período do resumo" className={fieldClass} type="date" value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></FormField>
        <FormField label="Até"><input aria-label="Fim do período do resumo" className={fieldClass} type="date" value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></FormField>
        <p className="pb-2 text-xs text-slate-500">Recebido significa pagamentos registrados e não estornados no período.</p>
      </div>
      {finance.dashboard.isLoading ? <Empty>Carregando o resumo financeiro…</Empty> : finance.dashboard.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível calcular o resumo financeiro.</div> : dashboard && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Recebido no período', value: money(dashboard.received_cents), icon: ArrowDownLeft, note: 'Pagamentos efetivamente registrados' },
            { title: 'A receber no período', value: money(dashboard.receivable_period_cents), icon: ReceiptText, note: 'Parcelas abertas com vencimento no período' },
            { title: 'Mensalidades vencidas', value: money(dashboard.overdue_cents), icon: BadgeAlert, note: 'Saldo em aberto vencido' },
            { title: 'Inadimplência', value: `${(dashboard.delinquency_ratio * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, icon: CircleDollarSign, note: 'Vencido dividido pelo total em aberto' },
            { title: 'Despesas pagas', value: money(dashboard.expenses_paid_cents), icon: ArrowUpRight, note: 'Despesas pagas no período' },
            { title: 'Contas a pagar', value: money(dashboard.expenses_due_cents), icon: ClipboardList, note: 'Despesas com vencimento no período' },
            { title: 'Saldo operacional', value: money(dashboard.closing_balance_cents), icon: Wallet, note: cashBalanceIsConfigured ? 'Saldo inicial informado + movimentos confirmados' : 'Configure o saldo inicial para ampliar este cálculo' },
            { title: 'Saldo projetado', value: money(dashboard.projected_balance_cents), icon: ChartNoAxesCombined, note: `Previsão líquida: ${money(dashboard.forecast_in_cents - dashboard.forecast_out_cents)}` },
          ].map(({ title, value, icon: Icon, note }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p><Icon className="h-5 w-5 text-blue-700" /></div>
            <strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{value}</strong><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
          </article>)}
        </div>
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Receitas e despesas · últimos seis meses</h2>
            <div className="mt-5 space-y-3">{dashboard.monthly_series.map((row) => {
              const max = Math.max(1, ...dashboard.monthly_series.flatMap((month) => [month.received_cents, month.expenses_cents]));
              const label = new Date(`${row.month.slice(0, 7)}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
              return <div key={row.month} className="grid grid-cols-[3.5rem_1fr_7rem] items-center gap-2 text-xs"><span className="capitalize text-slate-500">{label}</span><div className="space-y-1"><div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(1, row.received_cents / max * 100)}%` }} title={`Recebido ${money(row.received_cents)}`} /><div className="h-2 rounded bg-rose-400" style={{ width: `${Math.max(1, row.expenses_cents / max * 100)}%` }} title={`Despesas ${money(row.expenses_cents)}`} /></div><span className="text-right text-slate-600 dark:text-slate-300">{money(row.net_cents)}</span></div>;
            })}</div><div className="mt-4 flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-emerald-500" />Entradas</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-rose-400" />Saídas</span></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Fluxo do período</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Saldo no início</dt><dd className="font-semibold">{money(dashboard.opening_balance_cents)}</dd></div><div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-300"><dt>Entradas confirmadas</dt><dd>+ {money(dashboard.received_cents)}</dd></div><div className="flex justify-between gap-3 text-rose-700 dark:text-rose-300"><dt>Despesas pagas</dt><dd>− {money(dashboard.expenses_paid_cents)}</dd></div><div className="border-t border-slate-200 pt-3 dark:border-slate-700 flex justify-between gap-3 font-bold"><dt>Fechamento do período</dt><dd>{money(dashboard.closing_balance_cents)}</dd></div><div className="flex justify-between gap-3 text-blue-800 dark:text-blue-200"><dt>Recebimentos previstos</dt><dd>{money(dashboard.forecast_in_cents)}</dd></div><div className="flex justify-between gap-3 text-blue-800 dark:text-blue-200"><dt>Despesas previstas</dt><dd>{money(dashboard.forecast_out_cents)}</dd></div><div className="border-t border-slate-200 pt-3 dark:border-slate-700 flex justify-between gap-3 font-bold"><dt>Projeção ao final do período</dt><dd>{money(dashboard.projected_balance_cents)}</dd></div></dl>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Projeção gerencial, não é saldo bancário conciliado. Valores previstos ainda não foram recebidos ou pagos.</p>
          </div>
        </section>
      </>}
    </>}

    {section === 'contracts' && <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Criar contrato financeiro</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">O responsável é vinculado expressamente ao estudante. As parcelas são criadas de forma atômica e a chave da operação impede duplicatas por reenvio.</p>
        <form onSubmit={onCreateContract} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Buscar estudante"><input aria-label="Buscar estudante para contrato" className={fieldClass} value={contractCandidateSearch} onChange={(event) => { setContractCandidateSearch(event.target.value); setContractCandidatePage(1); setContract((current) => ({ ...current, studentId: '', responsibleId: '', enrollmentId: '' })); }} placeholder="Nome ou matrícula" /></FormField>
          <FormField label="Estudante"><select required className={fieldClass} value={contract.studentId} onChange={(event) => setContract((current) => ({ ...current, studentId: event.target.value, responsibleId: '', enrollmentId: '' }))}><option value="">Selecione estudante</option>{currentCandidates.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.registration_number}</option>)}</select></FormField>
          <FormField label="Responsável financeiro"><select required className={fieldClass} value={contract.responsibleId} onChange={(event) => setContract((current) => ({ ...current, responsibleId: event.target.value }))}><option value="">Selecione responsável vinculado</option>{eligibleGuardians.map((guardian) => <option key={guardian.profile_id} value={guardian.profile_id}>{guardian.full_name}</option>)}</select></FormField>
          <FormField label="Ano letivo"><select required className={fieldClass} value={contract.yearId} onChange={(event) => setContract((current) => ({ ...current, yearId: event.target.value, enrollmentId: '' }))}><option value="">Selecione ano letivo</option>{(contractCandidates.data?.academic_years ?? []).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></FormField>
          <FormField label="Matrícula (opcional)"><select className={fieldClass} value={contract.enrollmentId} onChange={(event) => setContract((current) => ({ ...current, enrollmentId: event.target.value }))}><option value="">Sem vínculo específico</option>{eligibleEnrollments.map((row) => <option key={row.id} value={row.id}>{row.class_name} · {row.academic_year_name}</option>)}</select></FormField>
          {contractCandidates.data && <div className="sm:col-span-2 xl:col-span-4"><Pagination page={contractCandidatePage} pageSize={pageSize} total={contractCandidates.data.total_count} onChange={setContractCandidatePage} /></div>}
          <FormField label="Mensalidade (R$)"><input required className={fieldClass} inputMode="decimal" placeholder="0,00" value={contract.monthlyAmount} onChange={(event) => setContract((current) => ({ ...current, monthlyAmount: event.target.value }))} /></FormField>
          <FormField label="Taxa de matrícula (R$)"><input className={fieldClass} inputMode="decimal" placeholder="0,00" value={contract.enrollmentFee} onChange={(event) => setContract((current) => ({ ...current, enrollmentFee: event.target.value }))} /></FormField>
          <FormField label="Número de parcelas"><input required className={fieldClass} type="number" min="1" max="60" value={contract.installments} onChange={(event) => setContract((current) => ({ ...current, installments: event.target.value }))} /></FormField>
          <FormField label="Primeiro vencimento"><input required className={fieldClass} type="date" value={contract.firstDueDate} onChange={(event) => setContract((current) => ({ ...current, firstDueDate: event.target.value }))} /></FormField>
          <FormField label="Dia de vencimento dos meses seguintes"><input required className={fieldClass} type="number" min="1" max="31" value={contract.dueDay} onChange={(event) => setContract((current) => ({ ...current, dueDay: event.target.value }))} /></FormField>
          <FormField label="Bolsa por parcela (R$)"><input className={fieldClass} inputMode="decimal" placeholder="0,00" value={contract.scholarship} onChange={(event) => setContract((current) => ({ ...current, scholarship: event.target.value }))} /></FormField>
          <FormField label="Desconto por parcela (R$)"><input className={fieldClass} inputMode="decimal" placeholder="0,00" value={contract.discount} onChange={(event) => setContract((current) => ({ ...current, discount: event.target.value }))} /></FormField>
          <FormField label="Desconto por pontualidade (R$)"><input className={fieldClass} inputMode="decimal" placeholder="0,00" value={contract.punctualityDiscount} onChange={(event) => setContract((current) => ({ ...current, punctualityDiscount: event.target.value }))} /></FormField>
          <FormField label="Multa contratual (%)"><input className={fieldClass} type="number" inputMode="decimal" min="0" max="100" step="0.01" placeholder="0" value={contract.fineRate} onChange={(event) => setContract((current) => ({ ...current, fineRate: event.target.value }))} /></FormField>
          <FormField label="Juros mensais contratuais (%)"><input className={fieldClass} type="number" inputMode="decimal" min="0" max="100" step="0.01" placeholder="0" value={contract.interestRate} onChange={(event) => setContract((current) => ({ ...current, interestRate: event.target.value }))} /></FormField>
          <FormField label="Dias de carência"><input className={fieldClass} type="number" min="0" max="365" value={contract.graceDays} onChange={(event) => setContract((current) => ({ ...current, graceDays: event.target.value }))} /></FormField>
          <FormField label="Observações do contrato"><input className={fieldClass} maxLength={500} value={contract.notes} onChange={(event) => setContract((current) => ({ ...current, notes: event.target.value }))} /></FormField>
          <div className="sm:col-span-2 xl:col-span-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Multa e juros ficam zerados quando não configurados. Informe somente condições previstas no contrato assinado e aplicáveis à sua instituição.</div>
          <div className="sm:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3"><button type="submit" className={buttonClass} disabled={finance.createContract.isPending || !contract.studentId || !contract.responsibleId}>{finance.createContract.isPending ? 'Salvando…' : 'Criar contrato e gerar parcelas'}</button>{contractMessage && <span role="status" className="text-sm text-slate-600 dark:text-slate-300">{contractMessage}</span>}</div>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <ListToolbar search={list.search} status={list.status} from={list.from} to={list.to} sortBy={list.sortBy} sortDirection={list.sortDirection} sortOptions={sortChoices.contracts} setList={setList} searchLabel="Buscar contrato" statusOptions={['ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED']} />
        {isListLoading ? <Empty>Carregando contratos…</Empty> : contracts.length === 0 ? <Empty>Nenhum contrato encontrado.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Estudante</th><th className="p-3">Responsável financeiro</th><th className="p-3">Ano</th><th className="p-3">Mensalidade</th><th className="p-3">Parcelas</th><th className="p-3">Início</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>{contracts.map((row) => <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3 font-semibold">{row.student_name}</td><td className="p-3">{row.responsible_name}</td><td className="p-3">{row.academic_year_name}</td><td className="p-3">{money(row.monthly_amount_cents)}</td><td className="p-3">{row.invoice_count}</td><td className="p-3">{prettyDate(row.first_due_date)}</td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" className={secondaryButtonClass} onClick={() => openContractEditor(row)}>Editar condições</button><button type="button" className={secondaryButtonClass} onClick={() => setAuditContract(row)}>Histórico</button>{row.status !== 'CANCELLED' && <select aria-label={`Alterar situação do contrato de ${row.student_name}`} className="min-h-9 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-800" value="" onChange={async (event) => { const next = event.target.value; if (!next) return; const reason = window.prompt('Motivo para alterar a situação do contrato:') ?? ''; if (reason.trim().length < 5) { setMessage('Informe um motivo com pelo menos cinco caracteres.'); return; } try { await finance.setContractStatus.mutateAsync({ contractId: row.id, status: next, reason }); setMessage('Situação do contrato atualizada e registrada no histórico.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o contrato.'); } }}><option value="">Alterar status…</option><option value={row.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'}>{row.status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}</option><option value="CANCELLED">Encerrar contrato</option></select>}</div></td></tr>)}</tbody></table></div>}
        <Pagination page={list.page} pageSize={pageSize} total={finance.contracts.data?.total_count ?? 0} onChange={onListPageChange} />
      </section>
    </>}

    {(section === 'invoices' || section === 'delinquency') && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {section === 'delinquency' && <div className="border-b border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Acompanhe parcelas em atraso e seus saldos. Nenhuma mensagem é enviada automaticamente.</div>}
      <ListToolbar search={list.search} status={section === 'delinquency' ? 'OVERDUE' : list.status} from={list.from} to={list.to} sortBy={list.sortBy} sortDirection={list.sortDirection} sortOptions={sortChoices.invoices} setList={setList} searchLabel="Buscar estudante, responsável ou parcela" statusOptions={['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']} hideStatus={section === 'delinquency'} dateFilters />
      {isListLoading ? <Empty>Carregando mensalidades…</Empty> : listError ? <div role="alert" className="p-6 text-sm text-red-700">Não foi possível carregar as mensalidades.</div> : invoiceRows.length === 0 ? <Empty>{section === 'delinquency' ? 'Nenhuma mensalidade vencida para os filtros escolhidos.' : 'Nenhuma mensalidade encontrada.'}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Estudante</th><th className="p-3">Responsável financeiro</th><th className="p-3">Parcela</th><th className="p-3">Vencimento</th><th className="p-3">Valor atual</th><th className="p-3">Recebido</th><th className="p-3">Saldo aberto</th><th className="p-3">Status</th><th className="p-3">Ação</th></tr></thead><tbody>{invoiceRows.map((row) => <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3 font-semibold">{row.student_name}</td><td className="p-3">{row.responsible_name ?? '—'}</td><td className="p-3">{row.reference}</td><td className="p-3">{prettyDate(row.due_date)}</td><td className="p-3">{money(row.amount_due_now)}</td><td className="p-3">{money(row.amount_paid)}</td><td className="p-3 font-semibold">{money(row.balance_cents)}</td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3"><div className="flex flex-wrap gap-2">{row.balance_cents > 0 && !['CANCELLED', 'DRAFT'].includes(row.status) && <button type="button" className={buttonClass} onClick={() => { setReceiptDraft({ amount: (receiptAmountFor(row) / 100).toFixed(2), method: 'MANUAL', date: localDate(), notes: '' }); setPaymentInvoice(row); }}>Registrar recebimento</button>}{section === 'delinquency' && row.balance_cents > 0 && <button type="button" className={secondaryButtonClass} disabled={finance.prepareReminder.isPending} onClick={() => void prepareOverdueReminder(row)}>Preparar lembrete</button>}</div></td></tr>)}</tbody></table></div>}
      <Pagination page={list.page} pageSize={pageSize} total={finance.invoices.data?.total_count ?? 0} onChange={onListPageChange} />
      {section === 'delinquency' && <div className="border-t border-slate-200 p-4 dark:border-slate-700"><h3 className="font-semibold text-slate-900 dark:text-white">Rascunhos administrativos preparados</h3><p className="mt-1 text-xs text-slate-500">Rascunhos ficam registrados para conferência; não são enviados automaticamente.</p>{finance.reminderDrafts.isLoading ? <p className="mt-3 text-sm text-slate-500">Carregando histórico…</p> : (finance.reminderDrafts.data?.rows.length ?? 0) === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhum lembrete preparado.</p> : <ul className="mt-3 space-y-2">{finance.reminderDrafts.data?.rows.map((draft) => <li key={draft.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{draft.student_name} · {draft.reference}</strong><span className="text-xs text-slate-500">{prettyDate(draft.prepared_at)} · {draft.status === 'DRAFT' ? 'Não enviado' : 'Cancelado'}</span></div><p className="mt-2 text-slate-600 dark:text-slate-300">{draft.message}</p></li>)}</ul>}<Pagination page={list.page} pageSize={pageSize} total={finance.reminderDrafts.data?.total_count ?? 0} onChange={onListPageChange} /></div>}
    </section>}

    {section === 'receipts' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <ListToolbar search={list.search} status={list.status} from={list.from} to={list.to} sortBy={list.sortBy} sortDirection={list.sortDirection} sortOptions={sortChoices.receipts} setList={setList} searchLabel="Buscar recebimento, estudante ou parcela" statusOptions={['PAID', 'REVERSED']} dateFilters />
      {isListLoading ? <Empty>Carregando recebimentos…</Empty> : payments.length === 0 ? <Empty>Nenhum recebimento encontrado.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Data</th><th className="p-3">Estudante</th><th className="p-3">Responsável</th><th className="p-3">Parcela</th><th className="p-3">Forma informada</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Comprovante</th><th className="p-3">Estorno</th></tr></thead><tbody>{payments.map((row) => <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3">{row.paid_at ? new Date(row.paid_at).toLocaleDateString('pt-BR') : '—'}</td><td className="p-3 font-semibold">{row.student_name}</td><td className="p-3">{row.responsible_name ?? '—'}</td><td className="p-3">{row.reference}</td><td className="p-3">{methodLabel[row.method]}</td><td className="p-3">{money(row.amount)}</td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3"><button type="button" className={secondaryButtonClass} onClick={() => void preparePrintReceipt(row)}>Imprimir registro</button></td><td className="p-3">{row.status === 'PAID' && <button type="button" className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={async () => { const reason = window.prompt('Informe o motivo do estorno rastreável:') ?? ''; if (reason.trim().length < 5) { setMessage('Informe um motivo com pelo menos cinco caracteres.'); return; } try { await finance.reversePayment.mutateAsync({ paymentId: row.id, reason }); setMessage('Recebimento estornado e mantido no histórico.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível estornar.'); } }}>Estornar</button>}</td></tr>)}</tbody></table></div>}
      <Pagination page={list.page} pageSize={pageSize} total={finance.payments.data?.total_count ?? 0} onChange={onListPageChange} />
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-700">O comprovante é um registro administrativo escolar; não substitui comprovante bancário ou documento fiscal.</p>
    </section>}

    {(section === 'expenses' || section === 'payables') && <>
      {section === 'expenses' && <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cadastrar despesa ou série recorrente</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A recorrência cria lançamentos mensais rastreáveis. Não calcula folha nem escrituração fiscal.</p>
        <form onSubmit={onCreateExpense} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Categoria"><select required className={fieldClass} value={expense.categoryId} onChange={(event) => setExpense((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Selecione categoria</option>{(finance.categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField>
          <FormField label="Fornecedor"><select className={fieldClass} value={expense.supplierId} onChange={(event) => setExpense((current) => ({ ...current, supplierId: event.target.value }))}><option value="">Sem fornecedor vinculado</option>{(finance.suppliers.data ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></FormField>
          <FormField label="Descrição"><input required className={fieldClass} maxLength={240} value={expense.description} onChange={(event) => setExpense((current) => ({ ...current, description: event.target.value }))} /></FormField>
          <FormField label="Valor (R$)"><input required className={fieldClass} inputMode="decimal" placeholder="0,00" value={expense.amount} onChange={(event) => setExpense((current) => ({ ...current, amount: event.target.value }))} /></FormField>
          <FormField label="Competência"><input required className={fieldClass} type="month" value={expense.competenceDate.slice(0, 7)} onChange={(event) => setExpense((current) => ({ ...current, competenceDate: `${event.target.value}-01` }))} /></FormField>
          <FormField label="Primeiro vencimento"><input required className={fieldClass} type="date" value={expense.dueDate} onChange={(event) => setExpense((current) => ({ ...current, dueDate: event.target.value }))} /></FormField>
          <FormField label="Repetir por quantos meses"><input required className={fieldClass} type="number" min="1" max="24" value={expense.recurrenceCount} onChange={(event) => setExpense((current) => ({ ...current, recurrenceCount: event.target.value }))} /></FormField>
          <FormField label="Observações"><input className={fieldClass} maxLength={500} value={expense.notes} onChange={(event) => setExpense((current) => ({ ...current, notes: event.target.value }))} /></FormField>
          <FormField label="Documento (opcional)"><input aria-label="Anexar documento da despesa" className={fieldClass} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => setExpenseDocument(event.target.files?.[0] ?? null)} /><span className="block text-xs text-slate-500">PDF, DOC, DOCX, JPG, PNG ou WEBP · até 10 MB{expenseDocument ? ` · ${expenseDocument.name}` : ''}</span></FormField>
          <div className="sm:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-2"><button className={buttonClass} type="submit" disabled={finance.createExpenses.isPending}>{finance.createExpenses.isPending ? 'Salvando…' : 'Salvar despesa'}</button>{expenseMessage && <span role="status" className="text-sm text-slate-600 dark:text-slate-300">{expenseMessage}</span>}</div>
        </form>
        <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-semibold">Cadastrar fornecedor</h3><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className={fieldClass} aria-label="Nome do fornecedor" placeholder="Nome do fornecedor" value={newSupplier.name} onChange={(event) => setNewSupplier((current) => ({ ...current, name: event.target.value }))} /><input className={fieldClass} aria-label="Contato do fornecedor" placeholder="Contato (opcional)" value={newSupplier.contact} onChange={(event) => setNewSupplier((current) => ({ ...current, contact: event.target.value }))} /><button type="button" className={secondaryButtonClass} disabled={!newSupplier.name.trim() || finance.createSupplier.isPending} onClick={async () => { try { await finance.createSupplier.mutateAsync(newSupplier); setNewSupplier({ name: '', contact: '' }); setExpenseMessage('Fornecedor salvo.'); } catch (error) { setExpenseMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar fornecedor.'); } }}>Adicionar fornecedor</button></div></div>
      </section>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {section === 'payables' && <div className="border-b border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Contas em aberto e vencidas. O registro do pagamento é manual e não inicia uma transferência bancária.</div>}
        <ListToolbar search={list.search} status={section === 'payables' ? (list.status || 'OPEN_OR_OVERDUE') : list.status} from={list.from} to={list.to} sortBy={list.sortBy} sortDirection={list.sortDirection} sortOptions={sortChoices.expenses} setList={setList} searchLabel="Buscar despesa ou fornecedor" statusOptions={['OPEN', 'OVERDUE', 'PAID', 'CANCELLED', 'REVERSED']} hideStatus={section === 'payables'} dateFilters />
        {isListLoading ? <Empty>Carregando despesas…</Empty> : expenses.length === 0 ? <Empty>{section === 'payables' ? 'Nenhuma conta a pagar encontrada.' : 'Nenhuma despesa encontrada.'}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Vencimento</th><th className="p-3">Competência</th><th className="p-3">Descrição</th><th className="p-3">Categoria</th><th className="p-3">Fornecedor</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>{expenses.map((row) => <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3">{prettyDate(row.due_date)}</td><td className="p-3">{prettyDate(row.competence_date)}</td><td className="p-3 font-semibold">{row.description}{row.recurrence_group_id && <span className="ml-2 text-xs text-slate-500">Mensal {row.recurrence_index}</span>}</td><td className="p-3">{row.category_name}</td><td className="p-3">{row.supplier_name ?? '—'}</td><td className="p-3">{money(row.amount_cents)}</td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3"><div className="flex flex-wrap gap-2">{row.document_path && <button type="button" className={secondaryButtonClass} onClick={() => void downloadExpenseDocument(row)}>Baixar anexo</button>}{['OPEN', 'OVERDUE'].includes(row.status) && <><button type="button" className={buttonClass} onClick={() => { setExpensePaymentDraft({ method: 'MANUAL', date: localDate(), notes: '' }); setExpensePayment(row); }}>Registrar pagamento</button><button type="button" className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={async () => { const reason = window.prompt('Informe o motivo do cancelamento rastreável:') ?? ''; if (reason.trim().length < 5) { setMessage('Informe um motivo com pelo menos cinco caracteres.'); return; } try { await finance.cancelExpense.mutateAsync({ expenseId: row.id, reason }); setMessage('Despesa cancelada e mantida no histórico.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar.'); } }}>Cancelar despesa</button></>}{row.status === 'PAID' && <button type="button" className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={async () => { const reason = window.prompt('Informe o motivo do estorno rastreável:') ?? ''; if (reason.trim().length < 5) { setMessage('Informe um motivo com pelo menos cinco caracteres.'); return; } try { await finance.reverseExpense.mutateAsync({ expenseId: row.id, reason }); setMessage('Pagamento estornado e lançamento preservado no histórico.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível estornar.'); } }}>Estornar</button>}</div></td></tr>)}</tbody></table></div>}
        <Pagination page={list.page} pageSize={pageSize} total={finance.expenses.data?.total_count ?? 0} onChange={onListPageChange} />
      </section>
    </>}

    {section === 'reports' && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Relatórios financeiros</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Os registros são filtrados e agregados no servidor; a exportação repete as mesmas permissões e filtros.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FormField label="Relatório"><select className={fieldClass} value={reportType} onChange={(event) => { setReportType(event.target.value as typeof reportType); setList((current) => ({ ...current, page: 1 })); }}><option value="receipts">Recebimentos por período</option><option value="invoices">Mensalidades e inadimplência</option><option value="expenses">Despesas por categoria</option><option value="contracts">Contratos ativos</option><option value="classes">Receita por turma</option><option value="discounts">Bolsas e descontos</option></select></FormField><FormField label="De"><input className={fieldClass} type="date" value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></FormField><FormField label="Até"><input className={fieldClass} type="date" value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></FormField><FormField label="Situação"><select className={fieldClass} disabled={reportType === 'classes' || reportType === 'discounts'} value={list.status} onChange={(event) => setList((current) => ({ ...current, page: 1, status: event.target.value }))}><option value="">Todas</option>{(reportType === 'receipts' ? ['PAID', 'REVERSED'] : reportType === 'contracts' ? ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED'] : ['OPEN', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></FormField></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => void exportReport()}><FileDown className="mr-2 inline h-4 w-4" />Exportar CSV</button><button type="button" className={secondaryButtonClass} onClick={() => window.print()}>Imprimir relatório</button></div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Exportação com limite de 10.000 linhas por arquivo. Para períodos maiores, divida as datas do relatório.</p>
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-semibold">Prévia agregada</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-slate-500">Recebimentos no período</dt><dd className="mt-1 font-bold">{money(dashboard?.received_cents ?? 0)}</dd></div><div><dt className="text-slate-500">Saldo vencido</dt><dd className="mt-1 font-bold">{money(dashboard?.overdue_cents ?? 0)}</dd></div><div><dt className="text-slate-500">Despesas pagas</dt><dd className="mt-1 font-bold">{money(dashboard?.expenses_paid_cents ?? 0)}</dd></div><div><dt className="text-slate-500">Contratos ativos</dt><dd className="mt-1 font-bold">{finance.contracts.data?.total_count ?? 0}</dd></div></dl>
        {finance.reportBreakdown.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando detalhamento por turma e descontos…</p> : finance.reportBreakdown.data && <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h4 className="font-semibold">Receita recebida por turma</h4><div className="mt-2 space-y-2">{finance.reportBreakdown.data.revenue_by_class.map((row) => <div key={row.class_id ?? 'unassigned'} className="flex justify-between gap-3 rounded bg-slate-50 p-2 text-sm dark:bg-slate-800"><span>{row.class_name} · {row.invoice_count} parcela(s)</span><strong>{money(row.received_cents)}</strong></div>)}</div></div><div><h4 className="font-semibold">Descontos no período</h4><dl className="mt-2 space-y-2 text-sm"><div className="flex justify-between"><dt>Bolsas</dt><dd>{money(finance.reportBreakdown.data.discounts.scholarship_cents)}</dd></div><div className="flex justify-between"><dt>Descontos</dt><dd>{money(finance.reportBreakdown.data.discounts.discount_cents)}</dd></div><div className="flex justify-between"><dt>Pontualidade</dt><dd>{money(finance.reportBreakdown.data.discounts.punctuality_discount_cents)}</dd></div></dl></div></div>}
      </div>
    </section>}

    {section === 'settings' && <section className="max-w-4xl rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configurações financeiras</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">O saldo inicial é informado pela instituição. O painel calcula movimento gerencial; não concilia saldo bancário.</p>
      {finance.settings.isLoading ? <Empty>Carregando configurações…</Empty> : <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); try { await finance.updateSettings.mutateAsync({ institutionId, defaultDueDay: Number(settingsDraft.defaultDueDay), openingBalanceCents: parseCents(settingsDraft.openingBalance), openingBalanceDate: settingsDraft.openingBalanceDate, reminderDaysBefore: Number(settingsDraft.reminderDaysBefore), reminderDaysAfter: Number(settingsDraft.reminderDaysAfter), inAppRemindersEnabled: settingsDraft.inAppRemindersEnabled }); setMessage('Configurações financeiras atualizadas e registradas no histórico.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); } }}>
        <FormField label="Dia padrão de vencimento"><input className={fieldClass} type="number" min="1" max="31" value={settingsDraft.defaultDueDay} onChange={(event) => setSettingsDraft((current) => ({ ...current, defaultDueDay: event.target.value }))} /></FormField>
        <FormField label="Saldo inicial informado (R$)"><input className={fieldClass} inputMode="decimal" value={settingsDraft.openingBalance} onChange={(event) => setSettingsDraft((current) => ({ ...current, openingBalance: event.target.value }))} /></FormField>
        <FormField label="Data do saldo inicial"><input className={fieldClass} type="date" value={settingsDraft.openingBalanceDate} onChange={(event) => setSettingsDraft((current) => ({ ...current, openingBalanceDate: event.target.value }))} /></FormField>
        <FormField label="Preparar lembrete antes do vencimento (dias)"><input className={fieldClass} type="number" min="0" max="60" value={settingsDraft.reminderDaysBefore} onChange={(event) => setSettingsDraft((current) => ({ ...current, reminderDaysBefore: event.target.value }))} /></FormField>
        <FormField label="Preparar lembrete após vencimento (dias)"><input className={fieldClass} type="number" min="0" max="90" value={settingsDraft.reminderDaysAfter} onChange={(event) => setSettingsDraft((current) => ({ ...current, reminderDaysAfter: event.target.value }))} /></FormField>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={settingsDraft.inAppRemindersEnabled} onChange={(event) => setSettingsDraft((current) => ({ ...current, inAppRemindersEnabled: event.target.checked }))} />Preparação de lembretes internos habilitada</label>
        <div className="sm:col-span-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">E-mail, WhatsApp e outros canais externos permanecem desligados. Esta tela não envia cobranças nem mensagens reais.</div>
        <div className="sm:col-span-2"><button className={buttonClass} type="submit" disabled={finance.updateSettings.isPending}>{finance.updateSettings.isPending ? 'Salvando…' : 'Salvar configurações'}</button></div>
      </form>}
    </section>}

    {contractToEdit && <Modal title={`Editar contrato · ${contractToEdit.student_name}`} onClose={() => setContractToEdit(null)}>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">A alteração recalcula apenas parcelas em aberto sem recebimentos. Parcelas pagas ou parcialmente pagas permanecem com seus valores históricos.</p>
      <form className="space-y-3" onSubmit={(event) => void onUpdateContractTerms(event)}>
        <FormField label="Mensalidade (R$)"><input required className={fieldClass} inputMode="decimal" value={contractEditDraft.monthlyAmount} onChange={(event) => setContractEditDraft((current) => ({ ...current, monthlyAmount: event.target.value }))} /></FormField>
        <FormField label="Bolsa por parcela (R$)"><input className={fieldClass} inputMode="decimal" value={contractEditDraft.scholarship} onChange={(event) => setContractEditDraft((current) => ({ ...current, scholarship: event.target.value }))} /></FormField>
        <FormField label="Desconto por parcela (R$)"><input className={fieldClass} inputMode="decimal" value={contractEditDraft.discount} onChange={(event) => setContractEditDraft((current) => ({ ...current, discount: event.target.value }))} /></FormField>
        <FormField label="Desconto por pontualidade (R$)"><input className={fieldClass} inputMode="decimal" value={contractEditDraft.punctualityDiscount} onChange={(event) => setContractEditDraft((current) => ({ ...current, punctualityDiscount: event.target.value }))} /></FormField>
        <FormField label="Multa contratual (%)"><input className={fieldClass} type="number" min="0" max="100" step="0.01" value={contractEditDraft.fineRate} onChange={(event) => setContractEditDraft((current) => ({ ...current, fineRate: event.target.value }))} /></FormField>
        <FormField label="Juros mensais (%)"><input className={fieldClass} type="number" min="0" max="100" step="0.01" value={contractEditDraft.interestRate} onChange={(event) => setContractEditDraft((current) => ({ ...current, interestRate: event.target.value }))} /></FormField>
        <FormField label="Dias de carência"><input className={fieldClass} type="number" min="0" max="365" value={contractEditDraft.graceDays} onChange={(event) => setContractEditDraft((current) => ({ ...current, graceDays: event.target.value }))} /></FormField>
        <FormField label="Observações"><input className={fieldClass} maxLength={500} value={contractEditDraft.notes} onChange={(event) => setContractEditDraft((current) => ({ ...current, notes: event.target.value }))} /></FormField>
        <FormField label="Motivo da alteração (registrado no histórico)"><input required minLength={5} className={fieldClass} value={contractEditDraft.reason} onChange={(event) => setContractEditDraft((current) => ({ ...current, reason: event.target.value }))} /></FormField>
        <div className="flex justify-end gap-2"><button type="button" className={secondaryButtonClass} onClick={() => setContractToEdit(null)}>Cancelar</button><button type="submit" className={buttonClass} disabled={finance.updateContractTerms.isPending}>{finance.updateContractTerms.isPending ? 'Salvando…' : 'Salvar condições'}</button></div>
      </form>
    </Modal>}

    {auditContract && <Modal title={`Histórico · ${auditContract.student_name}`} onClose={() => setAuditContract(null)}>
      {contractAudit.isLoading ? <Empty>Carregando histórico…</Empty> : (contractAudit.data?.rows ?? []).length === 0 ? <Empty>Nenhuma alteração registrada.</Empty> : <ol className="space-y-3">{(contractAudit.data?.rows ?? []).map((event) => <li key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-wrap justify-between gap-2"><strong>{event.action.replaceAll('_', ' ')}</strong><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('pt-BR')}</time></div><p className="mt-1 text-xs text-slate-500">Operador: {event.actor_id ?? 'Sistema'}</p><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(event.details, null, 2)}</pre></li>)}</ol>}
    </Modal>}

    {paymentInvoice && <Modal title="Registrar recebimento manual" onClose={() => setPaymentInvoice(null)}>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{paymentInvoice.student_name} · {paymentInvoice.reference} · saldo atual {money(paymentInvoice.balance_cents)}. O registro não processa pagamento bancário.</p>
      {paymentInvoice.due_date >= localDate() && paymentInvoice.punctuality_discount_amount > 0 && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">O valor sugerido considera o desconto de pontualidade até {prettyDate(paymentInvoice.due_date)}.</p>}
      <form className="space-y-3" onSubmit={(event) => void submitReceipt(event)}><FormField label="Valor recebido (R$)"><input required className={fieldClass} inputMode="decimal" value={receiptDraft.amount} onChange={(event) => setReceiptDraft((current) => ({ ...current, amount: event.target.value }))} /></FormField><FormField label="Forma informada"><PaymentMethodSelect className={fieldClass} value={receiptDraft.method} onChange={(method) => setReceiptDraft((current) => ({ ...current, method }))} /></FormField><FormField label="Data do recebimento"><input required className={fieldClass} type="date" max={localDate()} value={receiptDraft.date} onChange={(event) => setReceiptDraft((current) => ({ ...current, date: event.target.value }))} /></FormField><FormField label="Observação"><input className={fieldClass} maxLength={500} value={receiptDraft.notes} onChange={(event) => setReceiptDraft((current) => ({ ...current, notes: event.target.value }))} /></FormField><div className="flex justify-end gap-2 pt-2"><button type="button" className={secondaryButtonClass} onClick={() => setPaymentInvoice(null)}>Cancelar</button><button type="submit" className={buttonClass} disabled={finance.registerReceipt.isPending}>{finance.registerReceipt.isPending ? 'Registrando…' : 'Registrar recebimento'}</button></div></form>
    </Modal>}

    {expensePayment && <Modal title="Registrar pagamento de despesa" onClose={() => setExpensePayment(null)}>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{expensePayment.description} · {money(expensePayment.amount_cents)}. O registro é administrativo e não inicia transferência bancária.</p>
      <form className="space-y-3" onSubmit={(event) => void submitExpensePayment(event)}><FormField label="Forma informada"><PaymentMethodSelect className={fieldClass} value={expensePaymentDraft.method} onChange={(method) => setExpensePaymentDraft((current) => ({ ...current, method }))} /></FormField><FormField label="Data do pagamento"><input className={fieldClass} type="date" max={localDate()} value={expensePaymentDraft.date} onChange={(event) => setExpensePaymentDraft((current) => ({ ...current, date: event.target.value }))} /></FormField><FormField label="Observação"><input className={fieldClass} value={expensePaymentDraft.notes} onChange={(event) => setExpensePaymentDraft((current) => ({ ...current, notes: event.target.value }))} /></FormField><div className="flex justify-end gap-2 pt-2"><button type="button" className={secondaryButtonClass} onClick={() => setExpensePayment(null)}>Cancelar</button><button type="submit" className={buttonClass} disabled={finance.markExpensePaid.isPending}>{finance.markExpensePaid.isPending ? 'Registrando…' : 'Confirmar pagamento'}</button></div></form>
    </Modal>}

    {receiptToPrint && <div id="finance-administrative-receipt" className="hidden print:block"><div className="mx-auto max-w-xl border border-slate-400 p-8"><div className="flex items-center gap-3"><ReceiptText className="h-8 w-8" /><div><p className="text-xs uppercase tracking-widest">Registro administrativo</p><h1 className="text-2xl font-bold">Recebimento escolar</h1></div></div><p className="mt-8">A instituição registra o recebimento identificado abaixo. Este documento não é comprovante bancário ou fiscal.</p><dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between"><dt>Estudante</dt><dd className="font-semibold">{receiptToPrint.student_name}</dd></div><div className="flex justify-between"><dt>Responsável financeiro</dt><dd>{receiptToPrint.responsible_name ?? '—'}</dd></div><div className="flex justify-between"><dt>Parcela</dt><dd>{receiptToPrint.reference}</dd></div><div className="flex justify-between"><dt>Data</dt><dd>{receiptToPrint.paid_at ? new Date(receiptToPrint.paid_at).toLocaleDateString('pt-BR') : '—'}</dd></div><div className="flex justify-between"><dt>Forma informada</dt><dd>{methodLabel[receiptToPrint.method]}</dd></div><div className="flex justify-between border-t border-slate-400 pt-3 text-lg font-bold"><dt>Valor</dt><dd>{money(receiptToPrint.amount)}</dd></div><div className="flex justify-between"><dt>Situação</dt><dd>{statusLabel[receiptToPrint.status]}</dd></div><div><dt>Identificador do registro</dt><dd className="break-all font-mono text-xs">{receiptToPrint.id}</dd></div></dl><p className="mt-10 text-xs text-slate-500">Documento emitido pelo módulo Financeiro do Tec Escola.</p></div></div>}
  </div>;
}

function ListToolbar({
  search, status, from, to, sortBy, sortDirection, sortOptions, setList, searchLabel, statusOptions, hideStatus = false, dateFilters = false,
}: { search: string; status: string; from: string; to: string; sortBy: string; sortDirection: SortDirection; sortOptions: SortChoice[]; setList: Dispatch<SetStateAction<{ page: number; search: string; status: string; from: string; to: string; sortBy: string; sortDirection: SortDirection }>>; searchLabel: string; statusOptions: string[]; hideStatus?: boolean; dateFilters?: boolean }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
    <FormField label="Pesquisar"><span className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label={searchLabel} className={`${fieldClass} pl-9`} value={search} onChange={(event) => setList((current) => ({ ...current, page: 1, search: event.target.value }))} placeholder={searchLabel} /></span></FormField>
    <FormField label="Ordenar por"><select aria-label="Ordenar por" className={fieldClass} value={`${sortBy}:${sortDirection}`} onChange={(event) => { const [nextSortBy, nextDirection] = event.target.value.split(':'); setList((current) => ({ ...current, page: 1, sortBy: nextSortBy, sortDirection: nextDirection as SortDirection })); }}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField>
    {!hideStatus && <FormField label="Situação"><select className={fieldClass} value={status} onChange={(event) => setList((current) => ({ ...current, page: 1, status: event.target.value }))}><option value="">Todas as situações</option>{statusOptions.map((option) => <option key={option} value={option}>{statusLabel[option] ?? option}</option>)}</select></FormField>}
    {dateFilters && <><FormField label="De"><input className={fieldClass} type="date" value={from} aria-label="Filtro de data inicial" onChange={(event) => setList((current) => ({ ...current, page: 1, from: event.target.value }))} /></FormField><FormField label="Até"><input className={fieldClass} type="date" value={to} aria-label="Filtro de data final" onChange={(event) => setList((current) => ({ ...current, page: 1, to: event.target.value }))} /></FormField></>}
  </div>;
}

function PaymentMethodSelect({ className, value, onChange }: { className: string; value: FinancePaymentMethod; onChange: (value: FinancePaymentMethod) => void }) {
  return <select className={className} value={value} onChange={(event) => onChange(event.target.value as FinancePaymentMethod)}>{Object.entries(methodLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button type="button" aria-label="Fechar" className={secondaryButtonClass} onClick={onClose}><X className="h-4 w-4" /></button></header>{children}</section></div>;
}
