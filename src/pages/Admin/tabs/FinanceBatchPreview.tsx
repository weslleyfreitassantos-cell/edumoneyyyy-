import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { financeService, sha256Hex } from '../../../services/financeService';
import type { InvoiceRow, SantanderReturnOccurrenceRow } from '../../../services/financeService';
import type { NubankSimulationReturnMode } from '../../../services/nubankSimulation';
import { parseNubankSimulationReturnFile } from '../../../services/nubankSimulation';
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
  const [bankCode, setBankCode] = useState<'033' | '260'>('033');
  const [bankConfigured, setBankConfigured] = useState(false);
  const [lastNubankBatch, setLastNubankBatch] = useState<Awaited<ReturnType<typeof financeService.createNubankSimulationBatch>> | null>(null);
  const [nubankReturnMode, setNubankReturnMode] = useState<NubankSimulationReturnMode>('SETTLED');
  const eligible = useMemo(() => invoices.filter((row) => row.balance_cents > 0 && !['CANCELLED', 'DRAFT', 'PAID'].includes(row.status)), [invoices]);
  const selectedIds = useMemo(() => Object.keys(selectedRows), [selectedRows]);
  const total = useMemo(() => selectedIds.reduce((sum, id) => sum + Number(selectedRows[id]?.balance_cents ?? 0), 0), [selectedIds, selectedRows]);
  const isNubankSimulation = bankCode === '260';

  useEffect(() => {
    let active = true;
    setBankConfigured(false);
    void financeService.getBankConfiguration(institutionId).then((configuration) => {
      if (!active) return null;
      setBankConfigured(Boolean(configuration));
      const configuredBank = configuration?.bank_code === '260' ? '260' : '033';
      setBankCode(configuredBank);
      if (!configuration) {
        setReturnRows([]);
        return null;
      }
      return configuredBank === '260'
        ? financeService.listNubankSimulationOccurrences(institutionId)
        : financeService.listSantanderReturnOccurrences(institutionId);
    }).then((result) => {
      if (active && result) setReturnRows(result.rows);
    }).catch(() => {
      if (active) {
        setBankConfigured(false);
        setReturnRows([]);
      }
    });
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
    if (!bankConfigured || !selectedIds.length || generating) return;
    setGenerating(true);
    setMessage('');
    try {
      const batch = isNubankSimulation
        ? await financeService.createNubankSimulationBatch(institutionId, selectedIds)
        : await financeService.createSantanderRemittanceBatch(institutionId, selectedIds);
      const content = isNubankSimulation
        ? financeService.buildNubankSimulationFile(batch)
        : financeService.buildSantanderRemittanceFile(batch);
      const fileHash = await sha256Hex(content);
      if (isNubankSimulation) {
        await financeService.markNubankSimulationBatchExported(institutionId, batch.batch_id, fileHash);
        setLastNubankBatch(batch);
      } else {
        await financeService.markSantanderRemittanceBatchExported(institutionId, batch.batch_id, fileHash);
      }
      downloadTextFile(batch.file_name ?? (isNubankSimulation ? `nubank-simulation-${batch.batch_id}.json` : `santander-${batch.batch_id}.rem`), content);
      setSelectedRows({});
      setMessage(isNubankSimulation
        ? `Simulação ${batch.file_name ?? batch.batch_id} exportada e registrada. Nenhum arquivo foi enviado ao Nubank.`
        : `Lote ${batch.file_name ?? batch.batch_id} exportado e registrado para envio ao Santander.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Não foi possível gerar ${isNubankSimulation ? 'a simulação Nubank' : 'o lote Santander'}.`);
    } finally {
      setGenerating(false);
    }
  }

  async function generateNubankReturn() {
    if (!lastNubankBatch || importing) return;
    setImporting(true);
    setReturnMessage('');
    try {
      const content = financeService.buildNubankSimulationReturnFile(lastNubankBatch, nubankReturnMode);
      const fileHash = await sha256Hex(content);
      const occurrences = parseNubankSimulationReturnFile(content);
      downloadTextFile(`nubank-simulation-return-${lastNubankBatch.batch_id}.json`, content);
      const result = await financeService.importNubankSimulationReturn(institutionId, fileHash, occurrences);
      setReturnMessage(`${result.applied_count} baixa(s) aplicada(s), ${result.review_count} ocorrência(s) enviada(s) para revisão${result.duplicate_count ? ` e ${result.duplicate_count} duplicada(s)` : ''}.`);
      const refreshed = await financeService.listNubankSimulationOccurrences(institutionId);
      setReturnRows(refreshed.rows);
    } catch (error) {
      setReturnMessage(error instanceof Error ? error.message : 'Não foi possível gerar o retorno simulado Nubank.');
    } finally {
      setImporting(false);
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
      const occurrences = isNubankSimulation ? parseNubankSimulationReturnFile(content) : parseSantanderReturnFile(content);
      const fileHash = await sha256Hex(content);
      const result = isNubankSimulation
        ? await financeService.importNubankSimulationReturn(institutionId, fileHash, occurrences)
        : await financeService.importSantanderReturn(institutionId, fileHash, occurrences);
      setReturnMessage(`${result.applied_count} baixa(s) aplicada(s), ${result.review_count} ocorrência(s) enviada(s) para revisão${result.duplicate_count ? ` e ${result.duplicate_count} duplicada(s)` : ''}.`);
      const refreshed = isNubankSimulation
        ? await financeService.listNubankSimulationOccurrences(institutionId)
        : await financeService.listSantanderReturnOccurrences(institutionId);
      setReturnRows(refreshed.rows);
    } catch (error) {
      setReturnMessage(error instanceof Error ? error.message : `Não foi possível importar o retorno ${isNubankSimulation ? 'simulado Nubank' : 'Santander'}.`);
    } finally {
      setImporting(false);
    }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="batch-title">
    <h2 id="batch-title" className="font-bold">{isNubankSimulation ? 'Nubank (simulação)' : 'Remessa Santander'}</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Selecione as mensalidades e {isNubankSimulation ? 'gere um arquivo JSON local para testar o fluxo do Nubank.' : 'exporte o lote CNAB 240 reservado para esta escola.'} A seleção permanece ao trocar de página.</p>
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
    {!bankConfigured && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status"><strong>Configure o banco primeiro:</strong> salve os dados do Santander em <b>Financeiro → Configurações</b> para liberar a geração da remessa e a importação do retorno.</p>}
    <button type="button" className="mt-4 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!bankConfigured || !selectedIds.length || generating} onClick={() => void generateBatch()}>
      {generating ? 'Gerando lote…' : isNubankSimulation ? 'Gerar simulação Nubank' : 'Gerar remessa Santander'}
    </button>
    {message && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{message}</p>}

    {isNubankSimulation && lastNubankBatch && <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <strong>Teste local do retorno</strong>
      <p className="mt-1">Escolha um cenário para validar baixa, rejeição ou pagamento parcial sem chamar o Nubank.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select aria-label="Cenário do retorno Nubank" className="rounded border border-amber-400 bg-white p-2" value={nubankReturnMode} onChange={(event) => setNubankReturnMode(event.target.value as NubankSimulationReturnMode)}>
          <option value="SETTLED">Todas liquidadas</option>
          <option value="REJECT_FIRST">Primeira rejeitada</option>
          <option value="PARTIAL_FIRST">Primeira parcialmente paga</option>
        </select>
        <button type="button" className="rounded bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={importing} onClick={() => void generateNubankReturn()}>
          {importing ? 'Processando retorno…' : 'Gerar e importar retorno de teste'}
        </button>
      </div>
    </div>}

    <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="return-title">
      <h3 id="return-title" className="font-semibold">Retorno e conciliação</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{isNubankSimulation ? 'Importe um JSON de retorno simulado. Somente liquidações que coincidirem com um lote desta escola serão baixadas automaticamente.' : 'Importe o arquivo de retorno CNAB 240 recebido do Santander. Somente liquidações que coincidirem com um lote desta escola serão baixadas automaticamente.'}</p>
      <label className={`mt-3 inline-flex rounded border px-3 py-2 text-sm font-semibold ${!bankConfigured || importing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        {importing ? 'Importando retorno…' : isNubankSimulation ? 'Importar retorno simulado Nubank' : 'Importar retorno Santander'}
        <input className="sr-only" type="file" accept={isNubankSimulation ? '.json,application/json' : '.ret,.txt,text/plain'} disabled={!bankConfigured || importing} onChange={(event) => void importReturn(event)} />
      </label>
      {returnMessage && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{returnMessage}</p>}
      {returnRows.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700"><tr><th className="p-2">Parcela</th><th className="p-2">Nosso número</th><th className="p-2">Valor</th><th className="p-2">Situação</th><th className="p-2">Detalhe</th></tr></thead><tbody>{returnRows.map((row) => <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{row.reference ?? 'Não vinculada'}</td><td className="p-2 font-mono">{row.our_number ?? '—'}</td><td className="p-2">{row.amount_cents === null ? '—' : money(row.amount_cents)}</td><td className="p-2 font-semibold">{row.status === 'APPLIED' ? 'Aplicada' : row.status === 'DUPLICATE' ? 'Duplicada' : row.status === 'REJECTED' ? 'Rejeitada' : 'Revisão'}</td><td className="p-2">{row.review_reason ?? row.event_type}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
