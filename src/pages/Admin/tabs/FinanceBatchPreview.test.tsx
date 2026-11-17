// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      if (name === 'finance_get_bank_configuration') return Promise.resolve({ data: { bank_code: '033', agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }, error: null });
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
    const generateButton = screen.getByRole('button', { name: 'Gerar remessa Santander' }) as HTMLButtonElement;
    await waitFor(() => expect(generateButton.disabled).toBe(false));
    fireEvent.click(generateButton);
    expect(await screen.findByText(/exportado e registrado/)).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith('finance_mark_santander_remittance_exported', expect.objectContaining({ p_institution_id: 'escola-a', p_batch_id: 'batch-1' }));
    click.mockRestore();
  });

  it('troca para o adaptador Nubank e registra a simulação local', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'finance_get_bank_configuration') return Promise.resolve({ data: { bank_code: '260' }, error: null });
      if (name === 'finance_list_nubank_simulation_occurrences') return Promise.resolve({ data: { rows: [], total_count: 0, page: 1, page_size: 20 }, error: null });
      if (name === 'finance_create_nubank_simulation_batch') return Promise.resolve({ data: {
        replayed: false, batch_id: 'nubank-batch-1', file_name: 'nubank-simulation-20270101-000001.json', sequence_number: 1,
        bank_code: '260', format: 'NUBANK_SIMULATION', simulation: true,
        bank_configuration: { document: '12345678000199', company: 'Escola A' },
        items: [{ invoice_id: '1', our_number: '0000000000001', amount_cents: 45000, due_date: '2027-01-10', document_number: 'Parcela 1', payer_name: 'Aluno 1', payer_document: '12345678901' }],
      }, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<FinanceBatchPreview institutionId="escola-a" invoices={[invoice('1', 'OPEN', 45000)]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar página' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar simulação Nubank' }));
    expect(await screen.findByText(/Nenhum arquivo foi enviado ao Nubank/)).toBeTruthy();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('finance_mark_nubank_simulation_exported', expect.objectContaining({ p_batch_id: 'nubank-batch-1' })));
    click.mockRestore();
  });

  it('bloqueia a geração e o retorno enquanto o banco não estiver configurado', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'finance_get_bank_configuration') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: { rows: [], total_count: 0, page: 1, page_size: 20 }, error: null });
    });
    render(<FinanceBatchPreview institutionId="escola-a" invoices={[invoice('1', 'OPEN', 45000)]} />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar remessa Santander' }) as HTMLButtonElement;
    expect(generateButton).toHaveProperty('disabled', true);
    expect(await screen.findByText(/Configure o banco primeiro/)).toBeTruthy();
    const returnInput = screen.getByText('Importar retorno Santander').closest('label')?.querySelector('input') as HTMLInputElement | null;
    expect(returnInput?.disabled).toBe(true);
  });
});
