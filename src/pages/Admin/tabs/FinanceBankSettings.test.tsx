// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FinanceBankSettings } from './FinanceBankSettings';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabaseClient', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockReset(); });

describe('configuração bancária', () => {
  it('carrega dados da instituição e envia os campos editados', async () => {
    rpc.mockResolvedValueOnce({ data: { bank_code: '033', agency: '1234', account_number: '123456', account_digit: '0', agreement: '12345', wallet: '101' }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    render(<FinanceBankSettings institutionId="escola-a" />);
    const agency = await screen.findByLabelText('Agência');
    fireEvent.change(agency, { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('finance_set_bank_configuration', expect.objectContaining({ p_institution_id: 'escola-a', p_bank_code: '033', p_agency: '5678', p_account_number: '123456' })));
    expect(await screen.findByText('Configuração bancária salva.')).toBeTruthy();
  });

  it('informa falha de autorização sem afirmar que salvou', async () => {
    rpc.mockResolvedValueOnce({ data: { bank_code: '033', agency: '1234', account_number: '123456', account_digit: '0', agreement: '12345', wallet: '101' }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    render(<FinanceBankSettings institutionId="escola-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar configuração' }));
    expect(await screen.findByText(/Somente direção ou administração/)).toBeTruthy();
  });
});
