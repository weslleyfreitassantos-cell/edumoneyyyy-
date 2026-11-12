import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { financeService, sha256Hex } from '../../../services/financeService';
import type { InvoiceRow, SantanderReturnOccurrenceRow } from '../../../services/financeService';
import { parseSantanderReturnFile } from '../../../services/santanderCnab240';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=us-ascii' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function FinanceBatchPreview({ institutionId, invoices }: { institutionId: string; invoices: InvoiceRow[] }) {
  const [selectedRows, setSelectedRows] = useState<Record<string, InvoiceRow>>({});
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [returnMessage, setReturnMessage] = useState('');
  const [returnRows, setReturnRows] = useState<SantanderReturnOccurrenceRow[]>([]);
  const eligible = useMemo(() => invoices.filter((row) => row.balance_cents > 0 && !['CANCELLED', 'DRAFT', 'PAID'].includes(row.status)), [invoices]);
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);
  const total = useMemo(() => selectedIds.reduce((sum, id) => sum + Number(selectedRows[id]?.balance_cents ?? 0), 0), [selectedIds, selectedRows]);

  useEffect(() => {
    let active = true;
    void financeService.listSantanderReturnOccurrences(institutionId).then((result) => {
      if (active) setReturnRows(result.rows);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [institutionId]);

  function toggleRow(row: InvoiceRow, checked: boolean) {
    setSelectedRows((current) => {
      if (checked) return { ...current, [row.id]: row };
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  }

  async function generateBatch() {
    if (!selectedIds.length || generating) return;
    setGenerating(true);
    setMessage('');
    try {
      const batch = await financeService.createSantanderRemittanceBatch(institutionId, selectedIds);
      const content = financeService.buildSantanderRemittanceFile(batch);
      const fileHash = await sha256Hex(content);
      await financeService.markSantanderRemittanceBatchExported(institutionId, batch.batch_id, fileHash);
      downloadTextFile(batch.file_name ?? `santander-${batch.batch_id}.rem`, content);
      setSelectedRows({});
      setMessage(`Lote ${batch.file_name ?? batch.batch_id} exportado e registrado para envio ao Santander.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o lote Santander.');
    } finally {
      setGenerating(false);
    }
  }

  async function importReturn(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file || importing) return;
    setImporting(true);
    setReturnMessage('');
    try {
      const content = await file.text();
      const occurrences = parseSantanderReturnFile(content);
      const fileHash = await sha256Hex(content);
      const result = await financeService.importSantanderReturn(institutionId, fileHash, occurrences);
      setReturnMessage(`${result.applied_count} baixa(s) aplicada(s), ${result.review_count} ocorrência(s) enviada(s) para revisão${result.duplicate_count ? ` e ${result.duplicate_count} duplicada(s)` : ''}.`);
      const refreshed = await financeService.listSantanderReturnOccurrences(institutionId);
      setReturnRows(refreshed.rows);
    } catch (error) {
      setReturnMessage(error instanceof Error ? error.message : 'Não foi possível importar o retorno Santander.');
    } finally {
      setImporting(false);
    }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="batch-title">
    <h2 id="batch-title" className="font-bold">Remessa Santander</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Selecione as mensalidades e exporte o lote CNAB 240 reservado para esta escola. A seleção permanece ao trocar de página.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <button type="button" className="rounded border px-3 py-2" onClick={() => setSelectedRows((current) => ({ ...current, ...Object.fromEntries(eligible.map((row) => [row.id, row])) }))}>Selecionar página</button>
      <button type="button" className="rounded border px-3 py-2" onClick={() => setSelectedRows({})}>Limpar seleção</button>
      <strong>{selectedIds.length} selecionada(s) · {money(total)}</strong>
    </div>
    <div className="mt-3 space-y-2">
      {eligible.length === 0 ? <p className="text-sm">Nenhuma mensalidade elegível nesta página.</p> : eligible.map((row) => <label key={row.id} className="flex items-start gap-3 rounded border p-3 text-sm dark:border-slate-700">
        <input type="checkbox" checked={Boolean(selectedRows[row.id])} onChange={(event) => toggleRow(row, event.target.checked)} />
        <span className="flex-1"><strong>{row.student_name}</strong> · {row.reference}<br />Vencimento: {row.due_date} · Saldo: {money(Number(row.balance_cents))}</span>
      </label>)}
    </div>
    <button type="button" className="mt-4 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedIds.length || generating} onClick={() => void generateBatch()}>
      {generating ? 'Gerando remessa…' : 'Gerar remessa Santander'}
    </button>
    {message && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{message}</p>}

    <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="return-title">
      <h3 id="return-title" className="font-semibold">Retorno e conciliação</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Importe o arquivo de retorno CNAB 240 recebido do Santander. Somente liquidações que coincidirem com um lote desta escola serão baixadas automaticamente.</p>
      <label className="mt-3 inline-flex cursor-pointer rounded border px-3 py-2 text-sm font-semibold">
        {importing ? 'Importando retorno…' : 'Importar retorno Santander'}
        <input className="sr-only" type="file" accept=".ret,.txt,text/plain" disabled={importing} onChange={(event) => void importReturn(event)} />
      </label>
      {returnMessage && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{returnMessage}</p>}
      {returnRows.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700"><tr><th className="p-2">Parcela</th><th className="p-2">Nosso número</th><th className="p-2">Valor</th><th className="p-2">Situação</th><th className="p-2">Detalhe</th></tr></thead><tbody>{returnRows.map((row) => <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{row.reference ?? 'Não vinculada'}</td><td className="p-2 font-mono">{row.our_number ?? '—'}</td><td className="p-2">{row.amount_cents === null ? '—' : money(row.amount_cents)}</td><td className="p-2 font-semibold">{row.status === 'APPLIED' ? 'Aplicada' : row.status === 'DUPLICATE' ? 'Duplicada' : row.status === 'REJECTED' ? 'Rejeitada' : 'Revisão'}</td><td className="p-2">{row.review_reason ?? row.event_type}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
