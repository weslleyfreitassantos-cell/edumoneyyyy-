import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  centralStudiesContentReviewService,
  type CentralStudiesReviewCriterion,
  type CentralStudiesReviewDecision,
  type CentralStudiesReviewChecklist,
  type CentralStudiesReleaseStatus,
  type CentralStudiesInstitutionTarget,
  type CentralStudiesReviewPreview,
  type CentralStudiesReviewQueueItem,
} from '../../services/centralStudiesContentReviewService';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

const criteria: Array<[CentralStudiesReviewCriterion, string]> = [
  ['officialAlignment', 'A aula corresponde à habilidade BNCC indicada'],
  ['pedagogicalAccuracy', 'Explicações e exemplos estão corretos'],
  ['ageAndGradeSuitability', 'Linguagem e dificuldade são adequadas ao 6º ano'],
  ['clarityAndAccessibility', 'Instruções são claras e acessíveis'],
  ['answerQuality', 'Alternativas, respostas e explicações são consistentes'],
  ['culturalAndContextualSuitability', 'Contextos e referências são adequados'],
  ['reviewerCompetence', 'Confirmo que tenho competência pedagógica para esta revisão'],
  ['curriculumMapping', 'Confirmei o vínculo com a habilidade e o currículo oficial'],
];

const subjectNames: Record<string, string> = {
  MATHEMATICS: 'Matemática',
  PORTUGUESE: 'Língua Portuguesa',
  SCIENCE: 'Ciências',
};

function queueKey(item: CentralStudiesReviewQueueItem) {
  return `${item.journey_code}:${item.content_version}`;
}

function statusLabel(status: CentralStudiesReviewQueueItem['review_status']) {
  if (status === 'PEDAGOGICAL_REVIEWED') return 'Aprovada para integração';
  if (status === 'CHANGES_REQUESTED') return 'Ajustes solicitados';
  return 'Aguardando revisão';
}

export default function CentralStudiesContentReviewPage() {
  const [queue, setQueue] = useState<CentralStudiesReviewQueueItem[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [preview, setPreview] = useState<CentralStudiesReviewPreview | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('6');
  const [checklist, setChecklist] = useState<CentralStudiesReviewChecklist>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [releaseStatus, setReleaseStatus] = useState<CentralStudiesReleaseStatus | null>(null);
  const [institutionTargets, setInstitutionTargets] = useState<CentralStudiesInstitutionTarget[]>([]);
  const [targetKey, setTargetKey] = useState('');
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseSaving, setReleaseSaving] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const filteredQueue = useMemo(() => queue.filter((item) =>
    (subjectFilter === 'ALL' || item.subject_area === subjectFilter)
      && (gradeFilter === 'ALL' || item.grade_level === Number(gradeFilter))), [gradeFilter, queue, subjectFilter]);
  const selected = filteredQueue.find((item) => queueKey(item) === selectedKey) ?? filteredQueue[0];
  const allCriteriaChecked = criteria.every(([key]) => checklist[key] === true);
  const reviewClosed = selected?.review_status === 'PEDAGOGICAL_REVIEWED';

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await centralStudiesContentReviewService.getQueue();
      setQueue(items);
      setSelectedKey((current) => items.some((item) => queueKey(item) === current) ? current : items[0] ? queueKey(items[0]) : '');
    } catch {
      setError('Não foi possível carregar a fila. Confirme seu acesso de Super Administrador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setChecklist({});
    setNotes('');
    setMessage('');
    setReleaseStatus(null);
    setInstitutionTargets([]);
    setTargetKey('');
    setReleaseError('');
    if (!selected) return () => { cancelled = true; };
    setPreviewLoading(true);
    void centralStudiesContentReviewService.getPreview(selected.journey_code, selected.content_version)
      .then((item) => { if (!cancelled) setPreview(item); })
      .catch(() => { if (!cancelled) setError('Não foi possível abrir esta versão para revisão. Atualize a fila e tente novamente.'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    setReleaseLoading(true);
    void Promise.all([
      centralStudiesContentReviewService.getReleaseStatus(selected.journey_code, selected.content_version),
      centralStudiesContentReviewService.getInstitutionTargets(selected.journey_code, selected.content_version),
    ]).then(([status, targets]) => {
      if (cancelled) return;
      setReleaseStatus(status);
      setInstitutionTargets(targets);
    }).catch(() => {
      if (!cancelled) setReleaseError('Os controles de integração e publicação ainda não estão disponíveis no servidor.');
    }).finally(() => { if (!cancelled) setReleaseLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.journey_code, selected?.content_version, selected?.snapshot_fingerprint]);

  async function refreshRelease() {
    if (!selected) return;
    setReleaseLoading(true);
    setReleaseError('');
    try {
      const [status, targets] = await Promise.all([
        centralStudiesContentReviewService.getReleaseStatus(selected.journey_code, selected.content_version),
        centralStudiesContentReviewService.getInstitutionTargets(selected.journey_code, selected.content_version),
      ]);
      setReleaseStatus(status);
      setInstitutionTargets(targets);
    } catch {
      setReleaseError('Não foi possível atualizar a situação de liberação.');
    } finally {
      setReleaseLoading(false);
    }
  }

  async function runReleaseAction(action: 'integrate' | 'publish' | 'unpublish' | 'toggle-target') {
    if (!selected || !preview) return;
    const reason = releaseReason.trim();
    if (action !== 'integrate' && reason.length < 10) {
      setReleaseError('Registre um motivo com pelo menos 10 caracteres para esta alteração.');
      return;
    }
    setReleaseSaving(true);
    setReleaseError('');
    setMessage('');
    try {
      const version = { journeyCode: selected.journey_code, contentVersion: selected.content_version, expectedFingerprint: preview.snapshot_fingerprint };
      if (action === 'integrate') {
        await centralStudiesContentReviewService.integrate(version);
        setMessage('A versão foi integrada ao runtime existente. Ela continua indisponível aos estudantes até publicação e liberação por instituição.');
      } else if (action === 'publish') {
        await centralStudiesContentReviewService.publish({ ...version, reason });
        setMessage('A versão foi publicada. Nenhuma instituição foi habilitada automaticamente.');
      } else if (action === 'unpublish') {
        await centralStudiesContentReviewService.unpublish({ ...version, reason });
        setMessage('A versão foi retirada de publicação; acessos institucionais deixaram de disponibilizá-la.');
      } else {
        const target = institutionTargets.find((item) => `${item.institution_id}:${item.subject_id}` === targetKey);
        if (!target) throw new Error('Selecione uma instituição e uma matéria.');
        await centralStudiesContentReviewService.setInstitutionEnabled({
          ...version, institutionId: target.institution_id, subjectId: target.subject_id,
          enabled: !target.enabled, reason,
        });
        setMessage(!target.enabled
          ? releaseStatus?.publication_status === 'PUBLISHED'
            ? 'A aula foi liberada para os estudantes elegíveis desta instituição.'
            : 'O acesso foi preparado. A aula seguirá indisponível aos estudantes até a publicação.'
          : 'O acesso da instituição foi desativado.');
      }
      setReleaseReason('');
      await refreshRelease();
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : '';
      setReleaseError(messageText.includes('CONTENT_CHANGED')
        ? 'A versão mudou. Recarregue a prévia antes de continuar.'
        : 'A operação não foi concluída. Confirme os requisitos e tente novamente.');
    } finally {
      setReleaseSaving(false);
    }
  }

  async function decide(decision: CentralStudiesReviewDecision) {
    if (!selected || !preview || notes.trim().length < 10) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const receipt = await centralStudiesContentReviewService.review({
        journeyCode: selected.journey_code,
        contentVersion: selected.content_version,
        decision,
        notes: notes.trim(),
        expectedFingerprint: preview.snapshot_fingerprint,
        checklist,
      });
      setMessage(decision === 'APPROVED_FOR_INTEGRATION'
        ? `Revisão humana registrada por ${receipt.reviewer_name}. Esta versão segue em STAGING até ser integrada ao runtime.`
        : `Ajustes registrados por ${receipt.reviewer_name}; a versão permanece em STAGING.`);
      await loadQueue();
      setPreview(await centralStudiesContentReviewService.getPreview(selected.journey_code, selected.content_version));
      await refreshRelease();
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : '';
      setError(errorMessage.includes('CONTENT_CHANGED')
        ? 'O conteúdo mudou desde que você abriu a prévia. Recarregue a fila antes de revisar.'
        : 'Não foi possível registrar a decisão. Atualize a fila e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <PedagogicalCenterHeader subtitle="Revise aulas candidatas da Central de Estudos por disciplina e série." />
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
      A aprovação registra o parecer humano para esta versão. As aulas continuam em preparação até a integração ao runtime; esta tela não as publica para estudantes.
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.5fr)]">
      <section aria-label="Fila de aulas candidatas" className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="text-sm font-semibold">Disciplina
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="ALL">Todas</option><option value="MATHEMATICS">Matemática</option><option value="PORTUGUESE">Língua Portuguesa</option><option value="SCIENCE">Ciências</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Série
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="ALL">Todas</option><option value="6">6º ano</option>
            </select>
          </label>
        </div>
        {loading ? <PageState>Carregando aulas candidatas…</PageState> : error && !queue.length ? <PageState error>{error}</PageState> : !filteredQueue.length ? <PageState>Nenhuma aula corresponde aos filtros.</PageState> : <div className="mt-4 space-y-2">
          {filteredQueue.map((item) => <button type="button" key={queueKey(item)} onClick={() => setSelectedKey(queueKey(item))} aria-pressed={queueKey(item) === (selected ? queueKey(selected) : '')} className={`w-full rounded-lg border p-3 text-left transition hover:border-[#005bbf] ${queueKey(item) === (selected ? queueKey(selected) : '') ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'dark:border-slate-700'}`}>
            <span className="block text-xs font-bold uppercase text-[#005bbf]">{subjectNames[item.subject_area]} · {item.grade_level}º ano</span>
            <span className="mt-1 block font-semibold dark:text-white">{item.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{item.official_skill_code} · {statusLabel(item.review_status)}</span>
          </button>)}
        </div>}
      </section>

      <div className="space-y-5">
        {error && queue.length ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
        {!selected ? null : previewLoading || !preview ? <PageState>Carregando prévia da aula…</PageState> : <>
          <section aria-label="Prévia da aula" className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-[#005bbf]">{subjectNames[preview.payload.subject]} · {preview.payload.officialSkillCode}</p><h2 className="mt-1 text-xl font-extrabold dark:text-white">{preview.payload.journeyTitle}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{preview.payload.unitTitle} · {preview.payload.lesson.estimatedMinutes} minutos</p></div>
              <span className="rounded-full border px-3 py-1 text-xs font-bold">{statusLabel(preview.review_status)} · {preview.publication_status}</span>
            </div>
            <p className="break-all rounded-lg bg-slate-50 p-3 font-mono text-[10px] text-slate-500 dark:bg-slate-950">Fingerprint da versão: {preview.snapshot_fingerprint}</p>
            <article className="space-y-3 rounded-lg border p-4 dark:border-slate-700">
              <h3 className="text-lg font-bold dark:text-white">{preview.payload.lesson.title}</h3>
              <p className="dark:text-slate-200">{preview.payload.lesson.introduction}</p>
              <p className="dark:text-slate-200">{preview.payload.lesson.explanation}</p>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950"><h4 className="font-semibold">Exemplo guiado</h4><p className="mt-1">{preview.payload.lesson.workedExample.prompt}</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{preview.payload.lesson.workedExample.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-2 font-semibold">Resposta: {preview.payload.lesson.workedExample.answer}</p></div>
              <div><h4 className="font-semibold">Prática acompanhada</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{preview.payload.lesson.guidedPractice.map((item) => <li key={item.prompt}>{item.prompt}<span className="block text-slate-500">Apoio: {item.scaffold}</span></li>)}</ul></div>
              <div><h4 className="font-semibold">Aplicação</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{preview.payload.lesson.application.map((item) => <li key={item.prompt}><strong>{item.context}:</strong> {item.prompt}</li>)}</ul></div>
              <div><h4 className="font-semibold">Revisão</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{preview.payload.lesson.review.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </article>
            <section aria-label="Questões e gabarito"><h3 className="text-lg font-bold dark:text-white">Questões ({preview.payload.questions.length})</h3><div className="mt-3 space-y-3">{preview.payload.questions.map((question, index) => <article key={question.id} className="rounded-lg border p-4 dark:border-slate-700"><p className="text-xs font-bold uppercase text-[#005bbf]">{index + 1}. {question.purpose} · {question.difficulty}</p><p className="mt-2 font-semibold">{question.statement}</p><ol className="mt-2 list-[upper-alpha] space-y-1 pl-5 text-sm">{question.options.map((option) => <li key={option}>{option}</li>)}</ol><p className="mt-2 text-sm"><strong>Resposta:</strong> {question.correctAnswer}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300"><strong>Explicação:</strong> {question.explanation}</p><p className="mt-1 text-xs text-slate-500"><strong>Concepção a revisar:</strong> {question.misconception}</p></article>)}</div></section>
          </section>

          {!reviewClosed ? <section aria-label="Decisão da revisão humana" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-extrabold dark:text-white">Checklist da revisão humana</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{criteria.map(([key, label]) => <label key={key} className="flex items-start gap-2 rounded-lg border p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={checklist[key] === true} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5" /><span>{label}</span></label>)}</div>
            <label className="mt-4 block text-sm font-semibold">Observações da revisão<textarea value={notes} onChange={(event) => setNotes(event.target.value)} minLength={10} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Registre o parecer ou os ajustes necessários." /></label>
            <label className="mt-4 block text-sm font-semibold">Base da competência pedagógica<textarea value={checklist.reviewerCompetenceBasis ?? ''} onChange={(event) => setChecklist((current) => ({ ...current, reviewerCompetenceBasis: event.target.value }))} minLength={10} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Descreva sua formação, experiência ou atribuição pedagógica relevante." /></label>
            <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={saving || !allCriteriaChecked || notes.trim().length < 10 || (checklist.reviewerCompetenceBasis ?? '').trim().length < 10} onClick={() => void decide('APPROVED_FOR_INTEGRATION')} className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Registrando…' : 'Aprovar para integração'}</button><button type="button" disabled={saving || notes.trim().length < 10} onClick={() => void decide('CHANGES_REQUESTED')} className="rounded-lg border border-amber-500 px-4 py-3 text-sm font-bold text-amber-900 disabled:opacity-50 dark:text-amber-200">Solicitar ajustes</button></div>
            {!allCriteriaChecked || String(checklist.reviewerCompetenceBasis ?? '').trim().length < 10 ? <p className="mt-2 text-xs text-slate-500">A aprovação exige conferir os critérios, declarar competência pedagógica e registrar sua base.</p> : null}
          </section> : <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-bold">Revisão aprovada para integração</p><p className="mt-1">{preview.reviewer_name} · {preview.reviewed_at ? new Date(preview.reviewed_at).toLocaleString('pt-BR') : 'data não informada'}</p><p className="mt-1">{preview.review_notes}</p><p className="mt-2">A versão continua em STAGING e não está disponível aos estudantes.</p></section>}

          {reviewClosed ? <section aria-label="Publicação controlada" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold dark:text-white">Integração e publicação</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aprovação, integração, publicação e liberação por instituição são etapas separadas.</p></div><button type="button" onClick={() => void refreshRelease()} disabled={releaseLoading || releaseSaving} className="rounded-lg border px-3 py-2 text-sm font-bold dark:border-slate-700">{releaseLoading ? 'Atualizando…' : 'Atualizar situação'}</button></div>
            {releaseError ? <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{releaseError}</p> : null}
            {releaseStatus ? <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Revisão humana: <strong>{releaseStatus.review_status === 'PEDAGOGICAL_REVIEWED' ? 'aprovada' : releaseStatus.review_status}</strong></p><p>Integração: <strong>{releaseStatus.integrated ? 'concluída' : 'pendente'}</strong></p><p>Mapeamento: <strong>{releaseStatus.mapping_status}</strong></p><p>Publicação: <strong>{releaseStatus.publication_status}</strong></p><p>Instituições liberadas: <strong>{releaseStatus.enabled_institution_count}</strong></p><p>Versão: <strong>{releaseStatus.content_version}</strong></p></div> : !releaseLoading ? <p role="status" className="text-sm text-slate-600">A situação de liberação será exibida quando o servidor disponibilizar os controles da versão.</p> : null}
            <label className="block text-sm font-semibold">Motivo da operação<textarea value={releaseReason} onChange={(event) => setReleaseReason(event.target.value)} minLength={10} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Registre por que está integrando, publicando ou alterando o acesso." /></label>
            {releaseStatus && !releaseStatus.integrated ? <button type="button" disabled={releaseSaving || releaseStatus.review_status !== 'PEDAGOGICAL_REVIEWED'} onClick={() => void runReleaseAction('integrate')} className="rounded-lg bg-[#005bbf] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{releaseSaving ? 'Processando…' : 'Integrar ao motor V4/V9'}</button> : null}
            {releaseStatus?.integrated && releaseStatus.publication_status !== 'PUBLISHED' && releaseStatus.enabled_institution_count > 0 ? <button type="button" disabled={releaseSaving || releaseReason.trim().length < 10} onClick={() => void runReleaseAction('publish')} className="ml-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Publicar para instituições habilitadas</button> : null}
            {releaseStatus?.publication_status === 'PUBLISHED' ? <button type="button" disabled={releaseSaving || releaseReason.trim().length < 10} onClick={() => void runReleaseAction('unpublish')} className="ml-2 rounded-lg border border-red-400 px-4 py-3 text-sm font-bold text-red-800 disabled:opacity-50 dark:text-red-200">Despublicar versão</button> : null}
            {releaseStatus?.integrated ? <div className="space-y-2 rounded-lg border p-3 dark:border-slate-700"><h3 className="font-bold dark:text-white">Liberação por instituição</h3>{releaseStatus.publication_status !== 'PUBLISHED' ? <p className="text-sm text-slate-600 dark:text-slate-300">Preparar o acesso não mostra a aula ao estudante. A publicação só será possível após habilitar pelo menos uma instituição e, quando publicada, somente as instituições habilitadas terão acesso.</p> : <p className="text-sm text-slate-600 dark:text-slate-300">Habilitar agora torna a aula visível aos estudantes elegíveis desta instituição.</p>}<label className="block text-sm font-semibold">Instituição e matéria<select value={targetKey} onChange={(event) => setTargetKey(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione…</option>{institutionTargets.map((target) => <option key={`${target.institution_id}:${target.subject_id}`} value={`${target.institution_id}:${target.subject_id}`}>{target.institution_name} · {target.subject_name}{target.enabled ? ' · habilitada' : ''}</option>)}</select></label><button type="button" disabled={releaseSaving || !targetKey || releaseReason.trim().length < 10} onClick={() => void runReleaseAction('toggle-target')} className="rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-bold text-[#005bbf] disabled:opacity-50">{institutionTargets.find((item) => `${item.institution_id}:${item.subject_id}` === targetKey)?.enabled ? 'Desativar para esta instituição' : releaseStatus.publication_status === 'PUBLISHED' ? 'Liberar para esta instituição' : 'Preparar acesso para esta instituição'}</button></div> : null}
            {releaseStatus?.release_events.length ? <details><summary className="cursor-pointer text-sm font-bold">Histórico de alterações ({releaseStatus.release_events.length})</summary><ol className="mt-3 space-y-2">{releaseStatus.release_events.map((event, index) => <li key={`${event.action}:${event.occurred_at}:${index}`} className="rounded-lg border p-3 text-xs dark:border-slate-700"><strong>{event.action}</strong> · {event.actor_name} · {new Date(event.occurred_at).toLocaleString('pt-BR')}<p className="mt-1">{event.reason}</p></li>)}</ol></details> : null}
          </section> : null}
        </>}
      </div>
    </div>
  </div>;
}
