import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeService } from '../services/financeService';

export const financeKeys = { all: ['finance'] as const, invoices: (id: string) => ['finance', id, 'invoices'] as const, summary: (id: string) => ['finance', id, 'summary'] as const };
export function useFinance(institutionId: string) {
  const queryClient = useQueryClient();
  const invoices = useQuery({ queryKey: financeKeys.invoices(institutionId), queryFn: () => financeService.listInvoices(institutionId), enabled: Boolean(institutionId) });
  const summary = useQuery({ queryKey: financeKeys.summary(institutionId), queryFn: () => financeService.summary(institutionId), enabled: Boolean(institutionId) });
  const payment = useMutation({ mutationFn: (input: { invoiceId: string; amount: number }) => financeService.registerMockPayment(input.invoiceId, institutionId, input.amount), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['finance', institutionId] }); } });
  return { invoices, summary, payment };
}
