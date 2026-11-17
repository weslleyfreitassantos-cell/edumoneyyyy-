import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type BankCode = '033' | '001' | '104' | '237' | '260';
type BankAccount = {
  id: string; display_name: string; bank_code: BankCode; provider_mode: 'CNAB240' | 'API_PENDING' | 'SIMULATION';
  status: 'CONFIGURATION_PENDING' | 'READY_FOR_FILE' | 'SIMULATION_ONLY' | 'INTEGRATION_PENDING';
  agency: string | null; agency_digit: string | null; account_number: string | null; account_digit: string | null;
  transmission_code: string | null; wallet: string | null; is_default: boolean; updated_at?: string;
};
type BankDraft = Omit<BankAccount, 'id' | 'status' | 'provider_mode' | 'updated_at'> & { id: string | null };

const bankOptions: Array<{ code: BankCode; label: string; description: string }> = [
  { code: '033', label: 'Santander', description: 'Remessa CNAB 240. A escola envia o arquivo ao Santander e importa o retorno.' },
  { code: '001', label: 'Banco do Brasil', description: 'API de cobrança em preparação; exige convênio, credenciais e homologação do banco.' },
  { code: '104', label: 'Caixa', description: 'Webservice de cobrança em preparação; exige convênio e credenciais próprias.' },
  { code: '237', label: 'Bradesco', description: 'API de cobrança em preparação; exige contrato, certificado e credenciais.' },
  { code: '260', label: 'Nubank', description: 'Disponível apenas para simulação local até existir acesso oficial à API de cobrança.' },
];

const empty: BankDraft = {
  id: null, display_name: 'Conta principal', bank_code: '033', agency: '', agency_digit: '0',
  account_number: '', account_digit: '', transmission_code: '', wallet: '', is_default: false,
};

const bankLabel = (code: BankCode) => bankOptions.find((option) => option.code === code)?.label ?? code;
const statusLabel: Record<BankAccount['status'], string> = {
  CONFIGURATION_PENDING: 'Configuração pendente', READY_FOR_FILE: 'Pronto para arquivo',
  SIMULATION_ONLY: 'Somente simulação', INTEGRATION_PENDING: 'API em preparação',
};

export function FinanceBankSettings({ institutionId }: { institutionId: string }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState<BankDraft>(empty);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedBank = useMemo(() => bankOptions.find((option) => option.code === form.bank_code) ?? bankOptions[0], [form.bank_code]);

  async function loadAccounts() {
    setLoading(true);
    const { data, error } = await supabase.rpc('finance_list_bank_accounts', { p_institution_id: institutionId });
    if (!error && Array.isArray(data)) {
      const loaded = data as BankAccount[];
      setAccounts(loaded);
      const preferred = loaded.find((account) => account.is_default) ?? loaded[0];
      if (preferred) setForm({ ...empty, ...preferred, id: preferred.id });
      else setForm(empty);
      setLoading(false);
      return;
    }
    if (!error && data && !Array.isArray(data)) {
      const account = { ...empty, ...(data as Partial<BankDraft>), id: 'legacy', is_default: true } as BankDraft;
      setAccounts([{ ...account, status: account.bank_code === '260' ? 'SIMULATION_ONLY' : 'READY_FOR_FILE', provider_mode: account.bank_code === '260' ? 'SIMULATION' : 'CNAB240' } as BankAccount]);
      setForm(account);
      setLoading(false);
      return;
    }
    const legacy = await supabase.rpc('finance_get_bank_configuration', { p_institution_id: institutionId });
    if (!legacy.error && legacy.data) {
      const account = { ...empty, ...(legacy.data as Partial<BankDraft>), id: 'legacy', is_default: true } as BankDraft;
      setAccounts([{ ...account, status: account.bank_code === '260' ? 'SIMULATION_ONLY' : 'READY_FOR_FILE', provider_mode: account.bank_code === '260' ? 'SIMULATION' : 'CNAB240' } as BankAccount]);
      setForm(account);
    } else setMessage('Não foi possível carregar as contas bancárias.');
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void loadAccounts().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [institutionId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    let { error } = await supabase.rpc('finance_save_bank_account', {
      p_institution_id: institutionId, p_account_id: form.id === 'legacy' ? null : form.id,
      p_display_name: form.display_name, p_bank_code: form.bank_code, p_agency: form.agency || null,
      p_agency_digit: form.agency_digit || null, p_account_number: form.account_number || null,
      p_account_digit: form.account_digit || null, p_transmission_code: form.transmission_code || null,
      p_wallet: form.wallet || null, p_set_default: form.is_default,
    });
    if (error && ['PGRST202', '42883'].includes(error.code ?? '')) {
      const legacy = await supabase.rpc('finance_set_bank_configuration_v2', {
        p_institution_id: institutionId, p_bank_code: form.bank_code, p_agency: form.agency,
        p_agency_digit: form.agency_digit, p_account_number: form.account_number,
        p_account_digit: form.account_digit, p_transmission_code: form.transmission_code, p_wallet: form.wallet,
      });
      error = legacy.error;
    }
    const errorMessage = error?.message ?? '';
    if (error) setMessage(errorMessage.includes('FINANCE_BANK_PROVIDER_NOT_READY') ? 'Este banco ainda está em preparação e não pode ser definido como principal.' : errorMessage.includes('FINANCE_BANK_ACCOUNT_INCOMPLETE') ? 'Preencha os dados bancários antes de tornar esta conta principal.' : errorMessage.includes('FINANCE_DEFAULT_BANK_ACCOUNT_REQUIRED') ? 'Cadastre ou defina outra conta principal antes de retirar esta conta.' : 'Não foi possível salvar. Verifique sua permissão e os dados informados.');
    else { setMessage('Conta bancária salva.'); await loadAccounts(); }
  }

  const field = (key: keyof BankDraft, label: string, required = false) => <label className="block text-sm font-medium">{label}<input required={required} className="mt-1 w-full rounded border border-slate-300 bg-transparent p-2" value={String(form[key] ?? '')} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  const isNubankSimulation = form.bank_code === '260';
  const isUnavailable = ['001', '104', '237'].includes(form.bank_code);
  return <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="font-bold">Configuração bancária da instituição</h2>
    <p className="mt-2 text-sm">Uma escola pode cadastrar mais de uma conta. A conta principal é a usada pelo fluxo financeiro atual; as demais ficam prontas para homologação ou futura API.</p>
    {loading ? <p>Carregando...</p> : <>
      {accounts.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{accounts.map((account) => <button type="button" key={account.id} className={`rounded border p-3 text-left ${form.id === account.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300'}`} onClick={() => setForm({ ...empty, ...account, id: account.id })}><span className="block font-semibold">{account.display_name} · {bankLabel(account.bank_code)}</span><span className="mt-1 block text-xs">{statusLabel[account.status]}{account.is_default ? ' · Principal' : ''}</span></button>)}</div>}
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        {field('display_name', 'Nome da conta', true)}
        <label className="text-sm font-medium">Banco<select className="mt-1 w-full rounded border border-slate-300 bg-transparent p-2" value={form.bank_code} onChange={(event) => setForm((current) => ({ ...current, bank_code: event.target.value as BankCode }))}>{bankOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
        <div className="sm:col-span-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">{selectedBank.description}</div>
        {field('agency', form.bank_code === '033' ? 'Agência Santander' : 'Agência')}{field('agency_digit', 'Dígito da agência')}{field('account_number', 'Conta')}{field('account_digit', 'Dígito da conta')}{field('transmission_code', form.bank_code === '033' ? 'Código de transmissão / convênio' : 'Convênio / identificador')}{field('wallet', 'Carteira')}
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} /> Usar esta conta como principal para a geração</label>
        <div className="sm:col-span-2">{isNubankSimulation && <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Nubank: esta conta permanece em simulação local até existir uma API oficial autorizada.</p>}{isUnavailable && <p className="mb-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">Este banco pode ser cadastrado, mas a geração real ficará bloqueada até a integração e homologação da API.</p>}<div className="flex flex-wrap gap-2"><button type="submit" className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">Salvar conta bancária</button><button type="button" className="rounded border px-4 py-2 text-sm font-semibold" onClick={() => setForm({ ...empty, display_name: `Conta ${accounts.length + 1}` })}>Nova conta</button></div>{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>
    </form>
    </>}
  </section>;
}
