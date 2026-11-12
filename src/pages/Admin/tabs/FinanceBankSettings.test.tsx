// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FinanceBankSettings } from './FinanceBankSettings';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabaseClient', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockReset(); });

describe('configuração bancária', () => {
  it('carrega dados da instituição e envia os campos editados', async () => {
    rpc.mockResolvedValueOnce({ data: { bank_code: '033', agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: 'santander', display_name: 'Conta principal', bank_code: '033', provider_mode: 'CNAB240', status: 'READY_FOR_FILE', is_default: true, agency: '5678', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }], error: null });
    render(<FinanceBankSettings institutionId="escola-a" />);
    const agency = await screen.findByLabelText('Agência Santander');
    fireEvent.change(agency, { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar conta bancária' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('finance_save_bank_account', expect.objectContaining({ p_institution_id: 'escola-a', p_bank_code: '033', p_agency: '5678', p_account_number: '123456', p_transmission_code: '12345' })));
    expect(await screen.findByText('Conta bancária salva.')).toBeTruthy();
  });

  it('informa falha de autorização sem afirmar que salvou', async () => {
    rpc.mockResolvedValueOnce({ data: { bank_code: '033', agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    render(<FinanceBankSettings institutionId="escola-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar conta bancária' }));
    expect(await screen.findByText(/Verifique sua permissão/)).toBeTruthy();
  });

  it('permite cadastrar uma segunda conta e identifica bancos ainda pendentes', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'santander', display_name: 'Conta Santander', bank_code: '033', provider_mode: 'CNAB240', status: 'READY_FOR_FILE', is_default: true, agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }], error: null });
    rpc.mockResolvedValueOnce({ data: { id: 'bradesco', status: 'INTEGRATION_PENDING' }, error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: 'santander', display_name: 'Conta Santander', bank_code: '033', provider_mode: 'CNAB240', status: 'READY_FOR_FILE', is_default: true, agency: '1234', agency_digit: '0', account_number: '123456', account_digit: '0', transmission_code: '12345', wallet: '101' }], error: null });
    render(<FinanceBankSettings institutionId="escola-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova conta' }));
    fireEvent.change(screen.getByLabelText('Banco'), { target: { value: '237' } });
    expect(screen.getByText(/integração e homologação da API/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar conta bancária' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('finance_save_bank_account', expect.objectContaining({ p_bank_code: '237', p_set_default: false })));
  });
});
