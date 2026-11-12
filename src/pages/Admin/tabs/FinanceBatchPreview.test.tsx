// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import type { InvoiceRow } from '../../../services/financeService';
import { FinanceBatchPreview } from './FinanceBatchPreview';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabaseClient', () => ({ supabase: { rpc } }));

const invoice = (id: string, status: InvoiceRow['status'], balance: number) => ({ id, student_name: `Aluno ${id}`, reference: '2027-01', due_date: '2027-01-10', status, balance_cents: balance }) as InvoiceRow;
afterEach(cleanup);

describe('FinanceBatchPreview', () => {
  it('seleciona e limpa somente mensalidades elegíveis sem alterar os dados', () => {
    const rows = [invoice('1', 'OPEN', 45000), invoice('2', 'OVERDUE', 38000), invoice('3', 'PAID', 0), invoice('4', 'CANCELLED', 10000)];
    render(<FinanceBatchPreview institutionId="escola-a" invoices={rows} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar página' }));
    expect(screen.getByText(/2 selecionada/).textContent).toContain('830,00');
    fireEvent.click(screen.getByRole('checkbox', { name: /Aluno 1/ }));
    expect(screen.getByText(/1 selecionada/).textContent).toContain('380,00');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.getByText(/0 selecionada/)).toBeTruthy();
    expect(rows[0].balance_cents).toBe(45000);
  });

  it('informa quando não há parcelas elegíveis', () => {
    render(<FinanceBatchPreview institutionId="escola-a" invoices={[invoice('1', 'PAID', 0)]} />);
    expect(screen.getByText('Nenhuma mensalidade elegível nesta página.')).toBeTruthy();
  });

  it('monta e registra a remessa depois da seleção', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'finance_list_santander_return_occurrences') return Promise.resolve({ data: { rows: [], total_count: 0, page: 1, page_size: 20 }, error: null });
      if (name === 'finance_create_santander_remittance_batch') return Promise.resolve({ data: {
        replayed: false, batch_id: 'batch-1', file_name: 'santander-20270101-000001.rem', sequence_number: 1,
        bank_configuration: { agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', agreement: '12345', transmission_code: '12345', wallet: '101', document: '12345678000199', company: 'Escola A' },
        items: [{ invoice_id: '1', ourNumber: '0000000000001', amountCents: 45000, dueDate: '2027-01-10', documentNumber: 'Parcela 1', payerName: 'Aluno 1', payerDocument: '12345678901', payerAddress: 'Rua 1', payerDistrict: 'Centro', payerZip: '40000000', payerCity: 'Salvador', payerState: 'BA' }],
      }, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const rows = [invoice('1', 'OPEN', 45000)];
    render(<FinanceBatchPreview institutionId="escola-a" invoices={rows} />);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar página' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar remessa Santander' }));
    expect(await screen.findByText(/exportado e registrado/)).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith('finance_mark_santander_remittance_exported', expect.objectContaining({ p_institution_id: 'escola-a', p_batch_id: 'batch-1' }));
    click.mockRestore();
  });
});
