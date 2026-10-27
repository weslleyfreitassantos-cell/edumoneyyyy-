import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReceiptText, Wallet } from 'lucide-react';
import { financeService, type GuardianFinanceContract } from '../../services/financeService';

const money = (cents: number) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
const status: Record<string, string> = { OPEN: 'Em aberto', OVERDUE: 'Em atraso', PAID: 'Pago', PARTIALLY_PAID: 'Parcial', CANCELLED: 'Cancelado' };
const method: Record<string, string> = { MANUAL: 'Registro manual', PIX: 'PIX informado', BOLETO: 'Boleto informado', CREDIT_CARD: 'Cartão informado', CASH: 'Dinheiro', BANK_TRANSFER: 'Transferência', CARD_TERMINAL: 'Cartão na escola', OTHER: 'Outro' };

type Receipt = GuardianFinanceContract['invoices'][number]['receipts'][number];

export default function GuardianFinancePanel() {
  const [printTarget, setPrintTarget] = useState<{ contract: GuardianFinanceContract; invoice: GuardianFinanceContract['invoices'][number]; receipt: Receipt } | null>(null);
  const query = useQuery({
    queryKey: ['finance', 'guardian-portal'],
    queryFn: () => financeService.guardianPortal(),
    staleTime: 60_000,
  });

  function printReceipt(target: NonNullable<typeof printTarget>) {
    setPrintTarget(target);
    window.setTimeout(() => window.print(), 100);
  }

  return <section className="space-y-4 rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm" aria-labelledby="guardian-finance-title">
    <style>{`@media print { body * { visibility: hidden !important; } #guardian-finance-receipt, #guardian-finance-receipt * { visibility: visible !important; } #guardian-finance-receipt { position: fixed; inset: 0; padding: 32px; background: white; color: black; } }`}</style>
    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]"><Wallet className="h-5 w-5" aria-hidden="true" /></div><div><h2 id="guardian-finance-title" className="text-lg font-bold text-[#181c20]">Financeiro dos dependentes</h2><p className="text-sm text-[#727785]">Mostramos somente contratos em que você consta como responsável financeiro.</p></div></div>
    {query.isLoading && <p role="status" className="text-sm text-slate-500">Carregando informações financeiras…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Não foi possível carregar as informações financeiras agora.</p>}
    {query.data?.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">Nenhum contrato financeiro está vinculado a este perfil como responsável financeiro.</p>}
    <div className="space-y-4">{query.data?.map((contract) => <article key={contract.contract_id} className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{contract.student_name}</h3><p className="text-xs text-slate-500">{contract.institution_name} · Contrato {status[contract.status] ?? contract.status}</p></div><p className="text-sm font-semibold">{money(contract.monthly_amount_cents)} / mês</p></div>
      <div className="mt-3 divide-y divide-slate-100">{contract.invoices.map((invoice) => <div key={invoice.id} className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><span className="font-semibold">{invoice.reference}</span><span className="ml-2 text-slate-500">Vencimento {date(invoice.due_date)}</span></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{status[invoice.status] ?? invoice.status}</span></div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Total: {money(invoice.amount_due_cents)}</span><span>Recebido: {money(invoice.amount_paid_cents)}</span><span>Saldo: {money(invoice.balance_cents)}</span></div>
        {invoice.receipts.length > 0 && <ul className="mt-2 space-y-2">{invoice.receipts.map((receipt) => <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-xs"><span>{date(receipt.paid_at)} · {method[receipt.method] ?? receipt.method} · {money(receipt.amount_cents)} · {receipt.status === 'REVERSED' ? 'Estornado' : 'Registrado'}</span><button type="button" className="inline-flex min-h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 font-semibold text-slate-700" onClick={() => printReceipt({ contract, invoice, receipt })}><ReceiptText className="h-3.5 w-3.5" />Imprimir registro</button></li>)}</ul>}
      </div>)}</div>
    </article>)}</div>
    {printTarget && <div id="guardian-finance-receipt" className="hidden print:block"><div className="mx-auto max-w-xl border border-slate-400 p-8"><p className="text-xs uppercase tracking-widest">Registro administrativo</p><h1 className="mt-2 text-2xl font-bold">Recebimento escolar</h1><p className="mt-5">Registro fornecido por {printTarget.contract.institution_name}. Não substitui comprovante bancário ou documento fiscal.</p><dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>Estudante</dt><dd className="font-semibold">{printTarget.contract.student_name}</dd></div><div className="flex justify-between gap-4"><dt>Parcela</dt><dd>{printTarget.invoice.reference}</dd></div><div className="flex justify-between gap-4"><dt>Data</dt><dd>{date(printTarget.receipt.paid_at)}</dd></div><div className="flex justify-between gap-4"><dt>Forma informada</dt><dd>{method[printTarget.receipt.method] ?? printTarget.receipt.method}</dd></div><div className="flex justify-between gap-4 border-t border-slate-400 pt-3 text-lg font-bold"><dt>Valor</dt><dd>{money(printTarget.receipt.amount_cents)}</dd></div><div className="flex justify-between gap-4"><dt>Situação</dt><dd>{printTarget.receipt.status === 'REVERSED' ? 'Estornado' : 'Registrado'}</dd></div><div><dt>Identificador</dt><dd className="break-all font-mono text-xs">{printTarget.receipt.id}</dd></div></dl></div></div>}
  </section>;
}
