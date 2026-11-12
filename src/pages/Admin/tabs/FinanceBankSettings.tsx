import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type BankConfig = { bank_code: string; agency: string; account_number: string; account_digit: string; agreement: string; wallet: string };
const empty: BankConfig = { bank_code: '033', agency: '', account_number: '', account_digit: '', agreement: '', wallet: '' };

export function FinanceBankSettings({ institutionId }: { institutionId: string }) {
  const [form, setForm] = useState<BankConfig>(empty);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setForm(empty);
    setMessage('');
    void supabase.rpc('finance_get_bank_configuration', { p_institution_id: institutionId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage('Não foi possível carregar a configuração bancária.');
      else if (data) setForm(data as BankConfig);
      setLoading(false);
    });
    return () => { active = false; };
  }, [institutionId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const { error } = await supabase.rpc('finance_set_bank_configuration', {
      p_institution_id: institutionId, p_bank_code: form.bank_code, p_agency: form.agency,
      p_account_number: form.account_number, p_account_digit: form.account_digit,
      p_agreement: form.agreement, p_wallet: form.wallet,
    });
    setMessage(error ? 'Não foi possível salvar. Verifique sua permissão e os dados informados.' : 'Configuração bancária salva.');
  }

  const field = (key: keyof BankConfig, label: string) => <label className="block text-sm font-medium">{label}<input required className="mt-1 w-full rounded border border-slate-300 bg-transparent p-2" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="font-bold">Configuração bancária da instituição</h2>
    <p className="mt-2 text-sm">O cadastro não ativa boletos ou remessas. A integração Santander ainda depende de homologação.</p>
    {loading ? <p>Carregando...</p> : <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Banco<select className="mt-1 w-full rounded border border-slate-300 bg-transparent p-2" value={form.bank_code} onChange={(event) => setForm((current) => ({ ...current, bank_code: event.target.value }))}><option value="033">Santander</option><option value="001">Banco do Brasil</option><option value="104">Caixa</option><option value="237">Bradesco</option></select></label>
      {field('agency', 'Agência')}{field('account_number', 'Conta')}{field('account_digit', 'Dígito da conta')}{field('agreement', 'Convênio')}{field('wallet', 'Carteira')}
      <div className="sm:col-span-2"><button type="submit" className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">Salvar configuração</button>{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>
    </form>}
  </section>;
}
