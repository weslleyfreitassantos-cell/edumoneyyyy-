import { useEffect, useMemo, useState } from 'react';
import type { InvoiceRow } from '../../../services/financeService';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinanceBatchPreview({ invoices }: { invoices: InvoiceRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected([]); }, [invoices]);
  const eligible = useMemo(() => invoices.filter((row) => row.balance_cents > 0 && !['CANCELLED', 'DRAFT', 'PAID'].includes(row.status)), [invoices]);
  const chosen = eligible.filter((row) => selected.includes(row.id));
  const total = chosen.reduce((sum, row) => sum + Number(row.balance_cents), 0);

  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="batch-title">
    <h2 id="batch-title" className="font-bold">Preparar lote de cobrança</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Seleção para revisão apenas nesta página. Não gera boletos, remessa nem altera mensalidades.</p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm"><button type="button" className="rounded border px-3 py-2" onClick={() => setSelected(eligible.map((row) => row.id))}>Selecionar página</button><button type="button" className="rounded border px-3 py-2" onClick={() => setSelected([])}>Limpar seleção</button><strong className="self-center">{chosen.length} selecionada(s) · {money(total)}</strong></div>
    <div className="mt-3 space-y-2">{eligible.length === 0 ? <p className="text-sm">Nenhuma mensalidade elegível nesta página.</p> : eligible.map((row) => <label key={row.id} className="flex items-start gap-3 rounded border p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /><span className="flex-1"><strong>{row.student_name}</strong> · {row.reference}<br />Vencimento: {row.due_date} · Saldo: {money(Number(row.balance_cents))}</span></label>)}</div>
    <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Registro bancário, CNAB e conciliação dependem do convênio e da homologação do Santander.</p>
  </section>;
}
