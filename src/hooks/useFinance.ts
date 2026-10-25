import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeService, type FinancePaymentMethod } from '../services/financeService';

export type FinanceSection = 'overview' | 'invoices' | 'delinquency' | 'contracts' | 'receipts' | 'expenses' | 'payables' | 'reports' | 'settings';

export interface FinanceListOptions {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  from: string;
  to: string;
  sortBy: string;
  sortDirection: 'ASC' | 'DESC';
}

export const financeKeys = {
  all: ['finance'] as const,
  dashboard: (id: string, from: string, to: string) => ['finance', id, 'dashboard', from, to] as const,
  invoices: (id: string, options: FinanceListOptions) => ['finance', id, 'invoices', options] as const,
  contracts: (id: string, options: FinanceListOptions) => ['finance', id, 'contracts', options] as const,
  payments: (id: string, options: FinanceListOptions) => ['finance', id, 'payments', options] as const,
  expenses: (id: string, options: FinanceListOptions) => ['finance', id, 'expenses', options] as const,
  reminderDrafts: (id: string, page: number) => ['finance', id, 'reminder-drafts', page] as const,
  categories: (id: string) => ['finance', id, 'categories'] as const,
  suppliers: (id: string) => ['finance', id, 'suppliers'] as const,
  settings: (id: string) => ['finance', id, 'settings'] as const,
  reportBreakdown: (id: string, from: string, to: string) => ['finance', id, 'report-breakdown', from, to] as const,
};

export function useFinance(
  institutionId: string,
  section: FinanceSection,
  options: FinanceListOptions,
  period: { from: string; to: string },
) {
  const queryClient = useQueryClient();
  const enabled = Boolean(institutionId);
  const dashboard = useQuery({
    queryKey: financeKeys.dashboard(institutionId, period.from, period.to),
    queryFn: () => financeService.dashboard(institutionId, period.from, period.to),
    enabled,
  });
  const invoices = useQuery({
    queryKey: financeKeys.invoices(institutionId, options),
    queryFn: () => financeService.listInvoices({
      institutionId, page: options.page, pageSize: options.pageSize, search: options.search,
      status: options.status, from: options.from || null, to: options.to || null,
      sortBy: options.sortBy, sortDirection: options.sortDirection,
    }),
    enabled: enabled && ['invoices', 'delinquency', 'reports'].includes(section),
  });
  const contracts = useQuery({
    queryKey: financeKeys.contracts(institutionId, options),
    queryFn: () => financeService.listContracts({
      institutionId, page: options.page, pageSize: options.pageSize,
      search: options.search, status: options.status,
      sortBy: options.sortBy, sortDirection: options.sortDirection,
    }),
    enabled: enabled && ['contracts', 'reports'].includes(section),
  });
  const payments = useQuery({
    queryKey: financeKeys.payments(institutionId, options),
    queryFn: () => financeService.listPayments({
      institutionId, page: options.page, pageSize: options.pageSize,
      search: options.search, status: options.status, from: options.from || null, to: options.to || null,
      sortBy: options.sortBy, sortDirection: options.sortDirection,
    }),
    enabled: enabled && ['receipts', 'reports'].includes(section),
  });
  const expenses = useQuery({
    queryKey: financeKeys.expenses(institutionId, options),
    queryFn: () => financeService.listExpenses({
      institutionId, page: options.page, pageSize: options.pageSize,
      search: options.search, status: options.status, from: options.from || null, to: options.to || null,
      sortBy: options.sortBy, sortDirection: options.sortDirection,
    }),
    enabled: enabled && ['expenses', 'payables', 'reports'].includes(section),
  });
  const reminderDrafts = useQuery({
    queryKey: financeKeys.reminderDrafts(institutionId, options.page),
    queryFn: () => financeService.listReminderDrafts(institutionId, options.page),
    enabled: enabled && section === 'delinquency',
  });
  const categories = useQuery({
    queryKey: financeKeys.categories(institutionId),
    queryFn: () => financeService.categories(),
    enabled: enabled && ['expenses', 'payables'].includes(section),
  });
  const suppliers = useQuery({
    queryKey: financeKeys.suppliers(institutionId),
    queryFn: () => financeService.suppliers(institutionId),
    enabled: enabled && ['expenses', 'payables'].includes(section),
  });
  const settings = useQuery({
    queryKey: financeKeys.settings(institutionId),
    queryFn: () => financeService.settings(institutionId),
    enabled: enabled && section === 'settings',
  });
  const reportBreakdown = useQuery({
    queryKey: financeKeys.reportBreakdown(institutionId, period.from, period.to),
    queryFn: () => financeService.reportBreakdown(institutionId, period.from, period.to),
    enabled: enabled && section === 'reports',
  });
  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ['finance', institutionId] });
  const createContract = useMutation({ mutationFn: financeService.createContract, onSuccess: invalidate });
  const setContractStatus = useMutation({
    mutationFn: (input: { contractId: string; status: string; reason: string }) =>
      financeService.setContractStatus(institutionId, input.contractId, input.status, input.reason),
    onSuccess: invalidate,
  });
  const updateContractTerms = useMutation({
    mutationFn: (input: Omit<Parameters<typeof financeService.updateContractTerms>[0], 'institutionId'>) =>
      financeService.updateContractTerms({ institutionId, ...input }),
    onSuccess: invalidate,
  });
  const registerReceipt = useMutation({ mutationFn: financeService.registerReceipt, onSuccess: invalidate });
  const reversePayment = useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) => financeService.reversePayment(institutionId, input.paymentId, input.reason),
    onSuccess: invalidate,
  });
  const createSupplier = useMutation({
    mutationFn: (input: { name: string; contact?: string }) => financeService.createSupplier(institutionId, input.name, input.contact),
    onSuccess: invalidate,
  });
  const createExpenses = useMutation({ mutationFn: financeService.createExpenses, onSuccess: invalidate });
  const markExpensePaid = useMutation({
    mutationFn: (input: { expenseId: string; method: FinancePaymentMethod; paidAt: string; idempotencyKey: string; notes?: string }) =>
      financeService.markExpensePaid({ institutionId, ...input }),
    onSuccess: invalidate,
  });
  const reverseExpense = useMutation({
    mutationFn: (input: { expenseId: string; reason: string }) => financeService.reverseExpense(institutionId, input.expenseId, input.reason),
    onSuccess: invalidate,
  });
  const cancelExpense = useMutation({
    mutationFn: (input: { expenseId: string; reason: string }) =>
      financeService.cancelExpense(institutionId, input.expenseId, input.reason),
    onSuccess: invalidate,
  });
  const prepareReminder = useMutation({
    mutationFn: (input: { invoiceId: string; reminderType: 'UPCOMING' | 'OVERDUE'; idempotencyKey: string }) =>
      financeService.prepareReminder({ institutionId, ...input }),
    onSuccess: invalidate,
  });
  const updateSettings = useMutation({ mutationFn: financeService.updateSettings, onSuccess: invalidate });

  return {
    dashboard, invoices, contracts, payments, expenses, reminderDrafts, categories, suppliers, settings, reportBreakdown,
    createContract, setContractStatus, updateContractTerms, registerReceipt, reversePayment,
    createSupplier, createExpenses, markExpensePaid, reverseExpense, cancelExpense, prepareReminder, updateSettings,
  };
}
