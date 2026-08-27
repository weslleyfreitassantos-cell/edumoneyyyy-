import { supabase } from '../lib/supabaseClient';

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIALLY_PAID' | 'NEGOTIATED';

export interface InvoiceRow {
  id: string;
  reference: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: InvoiceStatus;
  student?: { profiles?: { full_name: string } | null } | null;
  responsible?: { full_name: string } | null;
}

export interface FinanceSummary { received: number; receivable: number; overdue: number; delinquency: number; }

const today = () => new Date().toISOString().slice(0, 10);

export const financeService = {
  async listInvoices(institutionId: string): Promise<InvoiceRow[]> {
    const { data, error } = await supabase.from('invoices').select('id, reference, due_date, amount_due, amount_paid, status, student:student_id(profiles:profile_id(full_name)), responsible:financial_responsible_profile_id(full_name)').eq('institution_id', institutionId).order('due_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as InvoiceRow[];
  },
  async summary(institutionId: string): Promise<FinanceSummary> {
    const invoices = await this.listInvoices(institutionId);
    const received = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
    const overdue = invoices.filter((invoice) => invoice.status === 'OVERDUE' || (invoice.status === 'OPEN' && invoice.due_date < today())).reduce((sum, invoice) => sum + Math.max(Number(invoice.amount_due) - Number(invoice.amount_paid || 0), 0), 0);
    const receivable = invoices.filter((invoice) => ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'].includes(invoice.status)).reduce((sum, invoice) => sum + Math.max(Number(invoice.amount_due) - Number(invoice.amount_paid || 0), 0), 0);
    return { received, receivable, overdue, delinquency: receivable ? overdue / receivable : 0 };
  },
  async registerMockPayment(invoiceId: string, institutionId: string, amount: number): Promise<void> {
    const { error } = await supabase.from('payments').insert({ invoice_id: invoiceId, institution_id: institutionId, provider: 'MOCK', method: 'MANUAL', amount, status: 'PAID', paid_at: new Date().toISOString(), notes: 'Pagamento simulado — ambiente de homologação' });
    if (error) throw error;
  },
};

export interface PaymentProvider { createCharge(input: { invoiceId: string; amountCents: number }): Promise<{ id: string; status: 'PENDING' }>; simulateApproval(id: string): Promise<void>; simulateFailure(id: string): Promise<void>; }

export class MockPaymentProvider implements PaymentProvider {
  async createCharge(input: { invoiceId: string; amountCents: number }) { return { id: `mock_${input.invoiceId}`, status: 'PENDING' as const }; }
  async simulateApproval(_id: string): Promise<void> { return Promise.resolve(); }
  async simulateFailure(_id: string): Promise<void> { return Promise.resolve(); }
}
