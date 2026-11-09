import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';

import {
  getGuidedStudyValidationSummary,
  type GuidedStudyValidationSummary,
} from '../../services/guidedStudyContentValidationService';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

const statusLabel: Record<string, string> = {
  DRAFT: 'Rascunho',
  VALIDATION_PENDING: 'Validação pendente',
  VALIDATION_FAILED: 'Falha na validação',
  READY: 'Pronto',
  PUBLISHED: 'Publicado',
  DISABLED: 'Desativado',
};

const sourceLabel: Record<string, string> = {
  BNCC_SKILL: 'Habilidade BNCC',
  CENTRAL_STUDIES_V2: 'Estudo guiado',
  ADAPTIVE_CONTENT_PACK: 'Pacote adaptativo',
};

const stageLabel: Record<string, string> = {
  ENSINO_FUNDAMENTAL: 'Ensino Fundamental',
  ENSINO_MEDIO: 'Ensino Médio',
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR');
}

export default function GuidedStudyContentValidationPage() {
  const [summary, setSummary] = useState<GuidedStudyValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await getGuidedStudyValidationSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os resultados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading && !summary) return <PageState>Carregando resultados técnicos…</PageState>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PedagogicalCenterHeader title="Validação de conteúdo" subtitle="Estudo Guiado e catálogo BNCC" />
      {error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Os resultados verificam estrutura, vínculo curricular, integridade das questões e compatibilidade. Não representam aprovação pedagógica humana nem garantia de perfeição pedagógica.</p></div>
        <button type="button" onClick={() => void refresh()} title="Atualizar resultados" aria-label="Atualizar resultados" className="rounded-md border border-sky-300 p-2 hover:bg-white disabled:opacity-50" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {summary ? <>
        <section aria-label="Resumo da validação" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['Publicados', summary.counts.published, 'text-emerald-700'],
            ['Prontos', summary.counts.ready, 'text-sky-700'],
            ['Falha técnica', summary.counts.failed, 'text-red-700'],
            ['Desativados', summary.counts.disabled, 'text-slate-600'],
          ] as const).map(([label, count, color]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p></div>)}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700"><h2 className="font-bold">Cobertura curricular mapeada</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A contagem considera somente habilidades do catálogo BNCC com vínculo de série cadastrado.</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Etapa</th><th className="px-4 py-3">Série</th><th className="px-4 py-3">Mapeadas</th><th className="px-4 py-3">Validação técnica</th><th className="px-4 py-3">Publicadas</th><th className="px-4 py-3">Elegíveis</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{summary.coverage.map((row) => <tr key={`${row.stage}-${row.grade_level}`}><td className="px-4 py-3">{stageLabel[row.stage] ?? row.stage}</td><td className="px-4 py-3">{row.stage === 'ENSINO_MEDIO' ? `${row.grade_level}ª série` : `${row.grade_level}º ano`}</td><td className="px-4 py-3">{row.mapped_skill_count}</td><td className="px-4 py-3">{row.technical_ready_count}</td><td className="px-4 py-3">{row.published_skill_count}</td><td className="px-4 py-3 font-semibold">{row.eligible_skill_count}</td></tr>)}{summary.coverage.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum vínculo curricular de série cadastrado.</td></tr> : null}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700"><h2 className="font-bold">Conteúdos verificados</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Validador {summary.validator_version}</p></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {summary.content.map((item) => <article key={`${item.source_type}:${item.source_id}`} className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{sourceLabel[item.source_type] ?? item.source_type}</h3><span className="text-xs text-slate-500">{item.content_version}</span></div><p className="mt-1 break-all text-xs text-slate-500">{item.source_id}</p><p className="mt-1 text-xs text-slate-500">Verificado em {formatTimestamp(item.validated_at)}</p>{item.errors.length ? <ul className="mt-2 list-inside list-disc text-sm text-red-700">{item.errors.map((entry) => <li key={entry}>{entry}</li>)}</ul> : null}</div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${item.validation_status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-800' : item.validation_status === 'VALIDATION_FAILED' ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{item.validation_status === 'PUBLISHED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{statusLabel[item.validation_status] ?? item.validation_status}</span>
            </article>)}
            {summary.content.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Ainda não há resultados de validação registrados.</p> : null}
          </div>
        </section>
      </> : null}
    </div>
  );
}
