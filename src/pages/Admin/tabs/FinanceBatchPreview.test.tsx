// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { describe, expect, it } from 'vitest';
import type { InvoiceRow } from '../../../services/financeService';
import { FinanceBatchPreview } from './FinanceBatchPreview';

const invoice = (id: string, status: InvoiceRow['status'], balance: number) => ({ id, student_name: `Aluno ${id}`, reference: '2027-01', due_date: '2027-01-10', status, balance_cents: balance }) as InvoiceRow;
afterEach(cleanup);

describe('FinanceBatchPreview', () => {
  it('seleciona e limpa somente mensalidades elegíveis sem alterar os dados', () => {
    const rows = [invoice('1', 'OPEN', 45000), invoice('2', 'OVERDUE', 38000), invoice('3', 'PAID', 0), invoice('4', 'CANCELLED', 10000)];
    render(<FinanceBatchPreview invoices={rows} />);
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
    render(<FinanceBatchPreview invoices={[invoice('1', 'PAID', 0)]} />);
    expect(screen.getByText('Nenhuma mensalidade elegível nesta página.')).toBeTruthy();
  });
});
