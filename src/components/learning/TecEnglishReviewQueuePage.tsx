import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  tecEnglishService,
  type EnglishReviewPreview,
  type EnglishReviewHistoryEntry,
  type EnglishReviewQueueItem,
  type EnglishReviewReceipt,
  type EnglishReleaseTarget,
  type EnglishBetaReleaseTarget,
} from '../../services/tecEnglishService';

const reviewCriteria = [
  ['translation', 'Frases e traduções corretas e naturais'],
  ['audio', 'Áudio, pronúncia e alternativa acessível quando o navegador não oferece microfone'],
  ['instructions', 'Instruções claras para estudantes iniciantes'],
  ['alternatives', 'Alternativas plausíveis, sem ambiguidade ou pegadinhas'],
  ['progression', 'Dificuldade progressiva entre as lições'],
  ['brazilian', 'Vocabulário e exemplos adequados a estudantes brasileiros iniciantes'],
  ['accessibility', 'Acessibilidade por teclado, leitor de tela e celular'],
  ['references', 'Referências e exemplos apropriados para o público escolar'],
] as const;

type Criterion = (typeof reviewCriteria)[number][0];

function stringify(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(' · ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value == null || value === '' ? '—' : String(value);
}

export default function TecEnglishReviewQueuePage() {
  const [queue, setQueue] = useState<EnglishReviewQueueItem[]>([]);
  const [history, setHistory] = useState<EnglishReviewHistoryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [preview, setPreview] = useState<EnglishReviewPreview | null>(null);
  const [checked, setChecked] = useState<Criterion[]>([]);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<EnglishReviewReceipt | null>(null);
  const [releaseSelection, setReleaseSelection] = useState<{ courseCode: string; contentVersion: number; title: string } | null>(null);
  const [releaseTargets, setReleaseTargets] = useState<EnglishReleaseTarget[]>([]);
  const [releaseSearch, setReleaseSearch] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseBusyInstitution, setReleaseBusyInstitution] = useState('');
  const [releaseMessage, setReleaseMessage] = useState('');
  const [releaseError, setReleaseError] = useState('');
  const [betaTargets, setBetaTargets] = useState<EnglishBetaReleaseTarget[]>([]);
  const [betaSearch, setBetaSearch] = useState('');
  const [betaReason, setBetaReason] = useState('');
  const [betaBusyInstitution, setBetaBusyInstitution] = useState('');
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaMessage, setBetaMessage] = useState('');
  const [betaError, setBetaError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = queue.find((item) => `${item.course_code}:${item.content_version}` === selectedKey) ?? queue[0];

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [items, decisions] = await Promise.all([
        tecEnglishService.getReviewQueue(),
        tecEnglishService.getReviewHistory(),
      ]);
      setQueue(items);
      setHistory(decisions);
      setSelectedKey((current) => items.some((item) => `${item.course_code}:${item.content_version}` === current)
        ? current
        : items[0] ? `${items[0].course_code}:${items[0].content_version}` : '');
    } catch {
      setError('Não foi possível carregar a fila. Confirme seu acesso de Super Administrador e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setChecked([]);
    setReceipt(null);
    setBetaTargets([]);
    setBetaSearch('');
    setBetaReason('');
    setBetaMessage('');
    setBetaError('');
    if (!selected) return () => { cancelled = true; };
    void tecEnglishService.getReviewPreview(selected.course_code, selected.content_version)
      .then((value) => { if (!cancelled) setPreview(value); })
      .catch(() => { if (!cancelled) setError('Não foi possível abrir a prévia desta versão. Atualize a fila e tente novamente.'); });
    return () => { cancelled = true; };
  }, [selected?.course_code, selected?.content_version, selected?.snapshot_fingerprint]);

  async function decide(decision: 'APPROVED' | 'CHANGES_REQUESTED') {
    if (!selected || !preview || notes.trim().length < 10) return;
    setSaving(true);
    setError('');
    try {
      const saved = await tecEnglishService.reviewCourse({
        courseCode: selected.course_code,
        contentVersion: selected.content_version,
        decision,
        notes: notes.trim(),
        expectedFingerprint: preview.snapshot_fingerprint,
        checklist: Object.fromEntries(reviewCriteria.map(([key]) => [key, checked.includes(key)])),
      });
      setReceipt(saved);
      setChecked([]);
      await loadQueue();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.includes('TEC_ENGLISH_REVIEW_CONTENT_CHANGED')
        ? 'O conteúdo mudou enquanto estava em revisão. Atualize a fila e revise novamente a versão atual.'
        : message.includes('TEC_ENGLISH_CONTENT_VERSION_IMMUTABLE')
          ? 'Esta versão já foi aprovada com outro conteúdo. Publique uma nova versão para revisão.'
          : 'Não foi possível registrar a decisão. Nenhuma aprovação foi presumida.');
    } finally {
      setSaving(false);
    }
  }

  async function openReleaseControl(item: EnglishReviewHistoryEntry) {
    setReleaseSelection({ courseCode: item.course_code, contentVersion: item.content_version, title: item.course_title ?? item.course_code });
    setReleaseLoading(true);
    setReleaseError('');
    setReleaseMessage('');
    try {
      setReleaseTargets(await tecEnglishService.getReleaseTargets(item.course_code, item.content_version));
    } catch {
      setReleaseTargets([]);
      setReleaseError('A versão não está mais aprovada e publicada. Liberações antigas não dão acesso a versões novas.');
    } finally {
      setReleaseLoading(false);
    }
  }

  async function searchReleaseTargets() {
    if (!releaseSelection) return;
    setReleaseLoading(true);
    setReleaseError('');
    try {
      setReleaseTargets(await tecEnglishService.getReleaseTargets(releaseSelection.courseCode, releaseSelection.contentVersion, releaseSearch));
    } catch {
      setReleaseError('Não foi possível buscar instituições elegíveis.');
    } finally {
      setReleaseLoading(false);
    }
  }

  async function toggleInstitutionRelease(target: EnglishReleaseTarget) {
    if (!releaseSelection) return;
    setReleaseBusyInstitution(target.institution_id);
    setReleaseError('');
    setReleaseMessage('');
    try {
      const saved = await tecEnglishService.setInstitutionRelease({
        courseCode: releaseSelection.courseCode,
        contentVersion: releaseSelection.contentVersion,
        institutionId: target.institution_id,
        enabled: !target.enabled,
      });
      setReleaseMessage(`${saved.enabled ? 'Curso habilitado em' : 'Curso desabilitado em'} ${target.institution_name}.`);
      await searchReleaseTargets();
    } catch {
      setReleaseError('Não foi possível alterar esta liberação. A instituição precisa estar ativa e a versão, aprovada.');
    } finally {
      setReleaseBusyInstitution('');
    }
  }

  async function searchBetaTargets() {
    if (!selected || !preview) return;
    if (betaSearch.trim().length < 2) {
      setBetaError('Digite ao menos dois caracteres para localizar a instituição autorizada.');
      return;
    }
    setBetaLoading(true);
    setBetaError('');
    setBetaMessage('');
    try {
      setBetaTargets(await tecEnglishService.getBetaReleaseTargets(selected.course_code, selected.content_version, betaSearch.trim()));
    } catch {
      setBetaError('Não foi possível localizar instituições para esta versão Beta.');
    } finally {
      setBetaLoading(false);
    }
  }

  async function toggleBetaRelease(target: EnglishBetaReleaseTarget) {
    if (!selected || !preview || betaReason.trim().length < 10) return;
    const enabling = !target.enabled;
    const confirmation = enabling
      ? `Habilitar ${selected.title} v${selected.content_version} em ${target.institution_name}? O conteúdo continuará em STAGING, sem aprovação pedagógica. Confirme apenas se esta instituição foi autorizada para teste Beta.`
      : `Revogar o acesso Beta de ${selected.title} em ${target.institution_name}?`;
    if (!window.confirm(confirmation)) return;

    setBetaBusyInstitution(target.institution_id);
    setBetaError('');
    setBetaMessage('');
    try {
      const saved = await tecEnglishService.setBetaRelease({
        courseCode: selected.course_code,
        contentVersion: selected.content_version,
        institutionId: target.institution_id,
        enabled: enabling,
        expectedFingerprint: preview.snapshot_fingerprint,
        reason: betaReason.trim(),
      });
      setBetaMessage(`${saved.enabled ? 'Acesso Beta habilitado em' : 'Acesso Beta revogado em'} ${target.institution_name}. O status pedagógico continua separado.`);
      await searchBetaTargets();
    } catch {
      setBetaError('Não foi possível alterar a liberação Beta. O conteúdo ou a versão pode ter mudado; atualize a fila antes de tentar novamente.');
    } finally {
      setBetaBusyInstitution('');
    }
  }

  const allCriteriaChecked = checked.length === reviewCriteria.length;

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
    <header className="rounded-2xl bg-gradient-to-br from-sky-800 to-blue-700 p-6 text-white shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Revisão humana · acesso Super Administrador</p>
      <h1 className="mt-2 text-3xl font-extrabold">Revisão pedagógica do Tec Idiomas</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">A aprovação pedagógica publica somente o fingerprint revisado. O acesso Beta, quando autorizado, fica separado, registrado por instituição e não substitui essa aprovação.</p>
    </header>

    {receipt ? <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
      Decisão registrada: versão {receipt.content_version} · {receipt.decision === 'APPROVED' ? 'aprovada e publicada' : 'devolvida para ajustes'} · {receipt.reviewer_name} · {new Date(receipt.reviewed_at).toLocaleString('pt-BR')}.
    </p> : null}
    {error ? <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">{error}</p> : null}
    {loading ? <p role="status" className="rounded-xl border bg-white p-4 text-sm text-slate-600">Carregando fila de revisão…</p> : null}
    {!loading && !queue.length && !error ? <section className="rounded-2xl border bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Fila vazia</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Não há versões pendentes para revisão. Conteúdo em STAGING continua invisível para os estudantes.</p><button type="button" onClick={() => void loadQueue()} className="mt-4 rounded-lg border px-4 py-2 text-sm font-bold">Atualizar fila</button></section> : null}

    {queue.length && selected ? <div className="grid items-start gap-5 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,1.7fr)]">
      <section aria-label="Versões aguardando revisão" className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold dark:text-white">Fila ({queue.length})</h2><button type="button" onClick={() => void loadQueue()} className="text-sm font-bold text-blue-700">Atualizar</button></div>
        <ul className="mt-3 space-y-2">{queue.map((item) => {
          const key = `${item.course_code}:${item.content_version}`;
          const active = key === `${selected.course_code}:${selected.content_version}`;
          return <li key={key}><button type="button" aria-pressed={active} onClick={() => { setSelectedKey(key); setNotes(''); }} className={`w-full rounded-xl border p-3 text-left ${active ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'dark:border-slate-700'}`}>
            <span className="block font-bold dark:text-white">{item.title}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">Versão {item.content_version} · {item.lesson_count} lições · {item.exercise_count} desafios</span><span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">{item.review_status === 'CHANGES_REQUESTED' ? 'Ajustes solicitados' : item.publication_status === 'PUBLISHED' ? 'Conteúdo alterado após aprovação' : 'Revisão pendente'}</span>
          </button></li>;
        })}</ul>
      </section>

      <div className="space-y-5">
        <section aria-label="Prévia da versão selecionada" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {!preview ? <p role="status" className="text-sm text-slate-600">Carregando a prévia da versão…</p> : <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{preview.course.course_code} · versão {preview.course.content_version}</p><h2 className="mt-1 text-2xl font-extrabold dark:text-white">{preview.course.title}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{preview.course.description}</p><p className="mt-2 text-xs text-slate-500">Autoria declarada: {preview.course.author}</p></div><span className="rounded-full border px-3 py-1 text-xs font-bold">{selected.publication_status} · {selected.review_status}</span></div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">Áudio e fala: {preview.audio_mode}</p>
            <p className="mt-2 break-all font-mono text-[10px] text-slate-500">Fingerprint: {preview.snapshot_fingerprint}</p>
            <div className="mt-5 space-y-4">{preview.units.map((unit) => <section key={unit.id} className="rounded-xl border p-4 dark:border-slate-700"><h3 className="text-lg font-bold dark:text-white">Unidade {unit.position}: {unit.title}</h3><p className="text-sm text-slate-600 dark:text-slate-300">{unit.description}</p>{unit.lessons.map((lesson) => <article key={lesson.id} className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><h4 className="font-bold dark:text-white">Lição {unit.position}.{lesson.position}: {lesson.title}</h4><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{lesson.introduction}</p><ol className="mt-3 space-y-3">{lesson.exercises.map((exercise) => <li key={exercise.id} className="rounded-lg border bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase text-blue-700">{exercise.position}. {exercise.type}</p><p className="mt-1 font-semibold dark:text-white">{exercise.instruction}</p><p className="mt-1 dark:text-slate-200">{exercise.prompt}</p><dl className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300"><div><dt className="inline font-bold">Alternativas / banco: </dt><dd className="inline">{stringify(exercise.options.length ? exercise.options : exercise.word_bank.length ? exercise.word_bank : exercise.left_items)}</dd></div><div><dt className="inline font-bold">Áudio: </dt><dd className="inline">{stringify(exercise.audio_text)}</dd></div><div><dt className="inline font-bold">Resposta esperada: </dt><dd className="inline">{stringify(exercise.answer_key)}</dd></div><div><dt className="inline font-bold">Explicação: </dt><dd className="inline">{exercise.explanation}</dd></div></dl></li>)}</ol></article>)}</section>)}</div>
          </>}
        </section>

        {preview ? <section aria-label="Decisão pedagógica" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold dark:text-white">Checklist da revisão humana</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Marque cada item somente depois de revisar a versão inteira. A aprovação publica exatamente o fingerprint exibido acima.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviewCriteria.map(([key, label]) => <label key={key} className="flex items-start gap-3 rounded-lg border p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={checked.includes(key)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} className="mt-0.5" /><span className="dark:text-slate-200">{label}</span></label>)}</div>
          <label className="mt-4 block text-sm font-bold dark:text-white">Observações registradas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} minLength={10} maxLength={2000} rows={4} placeholder="Registre a justificativa da decisão, inclusive itens que precisam de ajuste." className="mt-2 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={saving || !allCriteriaChecked || notes.trim().length < 10} onClick={() => void decide('APPROVED')} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Registrando…' : 'Aprovar revisão humana e publicar esta versão'}</button><button type="button" disabled={saving || notes.trim().length < 10} onClick={() => void decide('CHANGES_REQUESTED')} className="rounded-lg border border-amber-500 px-4 py-3 text-sm font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200">Solicitar alterações e manter em STAGING</button></div>
          {!allCriteriaChecked ? <p className="mt-2 text-xs text-slate-500">A aprovação exige confirmar todos os critérios.</p> : null}
        </section> : null}

        {preview && ['TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1'].includes(selected.course_code) ? <section aria-label="Liberação administrativa Beta" className="rounded-2xl border border-violet-300 bg-violet-50 p-5 shadow-sm dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-xs font-extrabold uppercase tracking-wide text-violet-800 dark:text-violet-200">Acesso Beta técnico · decisão separada</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">Liberar para uma instituição autorizada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">Esta ação não aprova a pedagogia nem publica o curso: o conteúdo permanece em STAGING. Use somente para uma instituição de homologação autorizada; o acesso é revogável, limitado à versão e ao fingerprint exibido.</p>
          <p className="mt-2 break-all font-mono text-[10px] text-slate-600 dark:text-slate-300">{selected.course_code} · v{selected.content_version} · {preview.snapshot_fingerprint}</p>
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void searchBetaTargets(); }}>
            <label className="sr-only" htmlFor="tec-idiomas-beta-institution-search">Buscar instituição autorizada</label>
            <input id="tec-idiomas-beta-institution-search" value={betaSearch} onChange={(event) => setBetaSearch(event.target.value)} minLength={2} placeholder="Nome da instituição autorizada" className="min-h-11 min-w-[240px] flex-1 rounded-lg border border-violet-200 bg-white px-3 text-sm dark:border-violet-800 dark:bg-slate-950" />
            <button type="submit" disabled={betaLoading || betaSearch.trim().length < 2} className="min-h-11 rounded-lg border border-violet-600 px-4 text-sm font-bold text-violet-900 disabled:opacity-50 dark:text-violet-100">{betaLoading ? 'Buscando…' : 'Buscar instituição'}</button>
          </form>
          <label className="mt-3 block text-sm font-bold text-slate-800 dark:text-slate-100">Justificativa auditável<textarea value={betaReason} onChange={(event) => setBetaReason(event.target.value)} minLength={10} maxLength={1000} rows={2} placeholder="Informe o objetivo e a autorização da liberação Beta." className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-normal dark:border-violet-800 dark:bg-slate-950" /></label>
          {betaMessage ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">{betaMessage}</p> : null}
          {betaError ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-800 dark:text-rose-200">{betaError}</p> : null}
          {betaLoading ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">Carregando instituições…</p> : null}
          {!betaLoading && betaTargets.length ? <ul className="mt-3 divide-y divide-violet-200 dark:divide-violet-900">{betaTargets.map((target) => <li key={target.institution_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-slate-900 dark:text-white">{target.institution_name}</p><p className="text-xs text-slate-600 dark:text-slate-300">{target.effective ? 'Beta ativo para este fingerprint' : target.enabled ? 'Registro antigo: acesso suspenso porque o conteúdo mudou' : 'Sem acesso Beta'}</p>{target.enabled && target.updated_by_name ? <p className="mt-1 text-xs text-slate-500">Última alteração por {target.updated_by_name}{target.updated_at ? ` · ${new Date(target.updated_at).toLocaleString('pt-BR')}` : ''}</p> : null}</div><button type="button" disabled={Boolean(betaBusyInstitution) || betaReason.trim().length < 10} onClick={() => void toggleBetaRelease(target)} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${target.enabled ? 'bg-slate-700' : 'bg-violet-700'}`}>{betaBusyInstitution === target.institution_id ? 'Salvando…' : target.enabled ? 'Revogar Beta' : 'Habilitar Beta nesta instituição'}</button></li>)}</ul> : null}
          {!betaLoading && betaSearch.trim().length >= 2 && !betaTargets.length && !betaError ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Nenhuma instituição ativa encontrada para a busca.</p> : null}
        </section> : null}
      </div>
    </div> : null}

    {history.length ? <section aria-label="Histórico de decisões pedagógicas" className="overflow-x-auto rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-extrabold dark:text-white">Histórico auditável</h2>
      <table className="mt-3 w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Curso / versão</th><th className="p-2">Decisão</th><th className="p-2">Pessoa revisora</th><th className="p-2">Data</th><th className="p-2">Observação</th><th className="p-2">Liberação gradual</th></tr></thead><tbody>{history.map((item) => {
        const versionStillInReview = queue.some((queued) => queued.course_code === item.course_code);
        return <tr key={`${item.course_code}:${item.content_version}:${item.reviewed_at}:${item.reviewer_profile_id}`} className="border-b last:border-0 dark:border-slate-700"><td className="p-2 font-semibold dark:text-white">{item.course_title ?? item.course_code} · v{item.content_version}</td><td className="p-2">{item.decision === 'APPROVED' ? 'Aprovada e publicada' : 'Ajustes solicitados'}</td><td className="p-2">{item.reviewer_name}<span className="block text-xs text-slate-500">{item.reviewer_email}</span></td><td className="p-2">{new Date(item.reviewed_at).toLocaleString('pt-BR')}</td><td className="max-w-sm p-2">{item.notes}</td><td className="p-2">{item.decision === 'APPROVED' && !versionStillInReview ? <button type="button" onClick={() => void openReleaseControl(item)} className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-bold text-blue-700">Gerenciar instituições</button> : 'Indisponível até aprovação atual'}</td></tr>;
      })}</tbody></table>
    </section> : null}

    {releaseSelection ? <section aria-label="Liberação gradual por instituição" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Publicação gradual</p><h2 className="mt-1 text-xl font-extrabold dark:text-white">{releaseSelection.title} · versão {releaseSelection.contentVersion}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Habilite primeiro uma instituição de homologação. Nenhuma outra recebe o curso sem uma liberação registrada.</p></div><button type="button" onClick={() => setReleaseSelection(null)} className="rounded-lg border px-3 py-2 text-sm font-bold">Fechar</button></div>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void searchReleaseTargets(); }}><label className="sr-only" htmlFor="tec-english-institution-search">Buscar instituição</label><input id="tec-english-institution-search" value={releaseSearch} onChange={(event) => setReleaseSearch(event.target.value)} placeholder="Buscar instituição pelo nome" className="min-h-11 min-w-[240px] flex-1 rounded-lg border px-3 text-sm dark:border-slate-700 dark:bg-slate-950" /><button type="submit" disabled={releaseLoading} className="min-h-11 rounded-lg border px-4 text-sm font-bold disabled:opacity-50">Buscar</button></form>
      {releaseMessage ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{releaseMessage}</p> : null}
      {releaseError ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{releaseError}</p> : null}
      {releaseLoading ? <p role="status" className="mt-3 text-sm text-slate-600">Carregando instituições…</p> : null}
      {!releaseLoading && releaseTargets.length ? <ul className="mt-3 divide-y dark:divide-slate-700">{releaseTargets.map((target) => <li key={target.institution_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold dark:text-white">{target.institution_name}</p><p className="text-xs text-slate-500">{target.enabled ? 'Habilitado para esta versão' : 'Sem acesso ao curso'}</p></div><button type="button" disabled={Boolean(releaseBusyInstitution)} onClick={() => void toggleInstitutionRelease(target)} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${target.enabled ? 'bg-slate-600' : 'bg-emerald-700'}`}>{releaseBusyInstitution === target.institution_id ? 'Salvando…' : target.enabled ? 'Desabilitar' : 'Habilitar nesta instituição'}</button></li>)}</ul> : null}
      {!releaseLoading && !releaseTargets.length && !releaseError ? <p className="mt-3 text-sm text-slate-600">Nenhuma instituição ativa corresponde à busca.</p> : null}
    </section> : null}

    <Link to="/teacher/pedagogical-center/reviews" className="inline-flex rounded-lg border px-4 py-2 text-sm font-bold text-blue-700">Voltar à fila pedagógica</Link>
  </main>;
}
