import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Flame, Play, RotateCcw, Sparkles, Target, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useGuidedDisciplineJourneysV9, useLearningDailyPlan, useLearningErrorNotebook, useLearningGamification, useLearningStudent, useStartGuidedDisciplineJourneyV9 } from '../../hooks/useLearningCenter';
import type { GuidedDisciplineJourneyV9 } from '../../services/learningCenterService';

function normalize(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}

function isEnglishJourney(journey: GuidedDisciplineJourneyV9): boolean {
  return [journey.canonical_subject_code, journey.subject_code, journey.subject_name]
    .some((value) => ['ENGLISH', 'ING', 'INGLES', 'LINGUA_INGLESA'].includes(normalize(value)));
}

function isReviewedAndAvailable(journey: GuidedDisciplineJourneyV9): boolean {
  return journey.pedagogical_review_status === 'PEDAGOGICAL_REVIEWED'
    && journey.mapping_status === 'MAPPED'
    && journey.availability_status === 'AVAILABLE'
    && journey.question_count > 0;
}

function journeyHref(journey: GuidedDisciplineJourneyV9): string {
  return `/student/study/guided?journey=${encodeURIComponent(journey.journey_id)}&skill=${encodeURIComponent(journey.execution_skill_id)}`;
}

export default function EnglishLearningPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const [startingJourneyId, setStartingJourneyId] = useState<string | null>(null);
  const [startError, setStartError] = useState(false);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const journeys = useGuidedDisciplineJourneysV9(currentInstitutionId ?? undefined, student.data?.id);
  const gamification = useLearningGamification(currentInstitutionId ?? undefined, student.data?.id);
  const dailyPlan = useLearningDailyPlan(currentInstitutionId ?? undefined, student.data?.id);
  const errorNotebook = useLearningErrorNotebook(currentInstitutionId ?? undefined, student.data?.id);
  const startJourney = useStartGuidedDisciplineJourneyV9(currentInstitutionId ?? undefined, student.data?.id);
  const dailyPlanItems = useMemo(
    () => [...(dailyPlan.data?.learning_daily_plan_items ?? [])].sort((left, right) => left.position - right.position),
    [dailyPlan.data?.learning_daily_plan_items],
  );
  const completedDailyPlanItems = dailyPlanItems.filter((item) => item.status === 'COMPLETED').length;
  const dailyPlanProgress = dailyPlanItems.length > 0
    ? Math.round((completedDailyPlanItems / dailyPlanItems.length) * 100)
    : 0;
  const englishJourneys = useMemo(
    () => (journeys.data ?? []).filter(isEnglishJourney).sort((left, right) => left.unit_title.localeCompare(right.unit_title, 'pt-BR') || left.title.localeCompare(right.title, 'pt-BR')),
    [journeys.data],
  );
  const englishJourneyBySkill = useMemo(
    () => new Map(englishJourneys.map((journey) => [journey.execution_skill_id, journey])),
    [englishJourneys],
  );
  const englishErrorNotes = useMemo(
    () => (errorNotebook.data ?? []).filter((note) => note.canonical_skill_id && englishJourneyBySkill.has(note.canonical_skill_id)),
    [englishJourneyBySkill, errorNotebook.data],
  );
  const eligibleJourneys = useMemo(() => englishJourneys.filter(isReviewedAndAvailable), [englishJourneys]);

  async function openJourney(journey: GuidedDisciplineJourneyV9) {
    setStartError(false);
    setStartingJourneyId(journey.journey_id);
    try {
      if (!journey.active_session_id) await startJourney.mutateAsync(journey.journey_id);
      navigate(journeyHref(journey));
    } catch {
      setStartError(true);
    } finally {
      setStartingJourneyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <Link to="/student/study" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Central de Estudos
      </Link>

      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-800 p-6 text-white shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">Tec Inglês</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Inglês para usar no dia a dia</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">Avance por trilhas curtas de leitura, vocabulário e comunicação. A plataforma registra o progresso no mesmo percurso guiado usado nas demais matérias.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-blue-50">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2"><BookOpen className="h-4 w-4" aria-hidden="true" /> Trilhas por unidade</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Correção pelo percurso existente</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2"><Volume2 className="h-4 w-4" aria-hidden="true" /> Áudio do navegador, quando compatível</span>
        </div>
      </header>

      {student.isLoading || journeys.isLoading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Carregando suas trilhas de inglês…</p> : null}
      {student.isError || journeys.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">Não foi possível consultar as trilhas agora. Seu progresso permanece protegido; tente novamente mais tarde.</p> : null}
      {!student.isLoading && !student.data ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Não encontramos uma matrícula ativa para carregar as trilhas desta instituição.</p> : null}

      {gamification.data ? (
        <section aria-label="Seu progresso geral de aprendizagem" className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100"><Sparkles className="h-4 w-4" aria-hidden="true" /> Experiência</p>
            <p className="mt-2 text-2xl font-extrabold text-amber-950 dark:text-white">{gamification.data.xp} XP</p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Acumulado em todas as matérias</p>
          </article>
          <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-900 dark:text-rose-100"><Flame className="h-4 w-4" aria-hidden="true" /> Sequência</p>
            <p className="mt-2 text-2xl font-extrabold text-rose-950 dark:text-white">{gamification.data.current_streak} {gamification.data.current_streak === 1 ? 'dia' : 'dias'}</p>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-200">Maior sequência: {gamification.data.longest_streak} {gamification.data.longest_streak === 1 ? 'dia' : 'dias'}</p>
          </article>
          <article className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100"><Target className="h-4 w-4" aria-hidden="true" /> Meta diária</p>
            <p className="mt-2 text-2xl font-extrabold text-sky-950 dark:text-white">{gamification.data.daily_goal_minutes} min</p>
            <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">Meta configurada no seu perfil de estudos</p>
          </article>
        </section>
      ) : null}

      {dailyPlan.data ? (
        <section aria-labelledby="english-daily-plan-title" className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm dark:border-sky-900/60 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Seu estudo de hoje</p>
              <h2 id="english-daily-plan-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Plano diário</h2>
            </div>
            <p className="rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
              {completedDailyPlanItems} de {dailyPlanItems.length} {dailyPlanItems.length === 1 ? 'etapa concluída' : 'etapas concluídas'}
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={`Plano de hoje: ${completedDailyPlanItems} de ${dailyPlanItems.length} etapas concluídas`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dailyPlanProgress}>
            <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${dailyPlanProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {dailyPlan.data.estimated_minutes} min estimados. A duração organiza o plano e não representa tempo cronometrado.
          </p>
          {dailyPlanItems.length > 0 ? (
            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
              {dailyPlanItems.map((item) => {
                const statusLabel = item.status === 'COMPLETED'
                  ? 'Concluída'
                  : item.status === 'IN_PROGRESS'
                    ? 'Em andamento'
                    : item.status === 'SKIPPED'
                      ? 'Adiada'
                      : 'Pendente';
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                      {item.description ? <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{item.description}</p> : null}
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Estimativa: {item.estimated_minutes} min</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                      {statusLabel}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhuma etapa foi planejada para hoje.</p>}
          <Link to="/student/study" className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">Abrir Central de Estudos</Link>
        </section>
      ) : dailyPlan.isError ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Não foi possível consultar o plano diário agora. Suas trilhas de inglês continuam disponíveis.</p>
      ) : null}

      {!student.isLoading && !student.isError && englishJourneys.length > 0 ? (
        <section aria-labelledby="english-error-review-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">Revisão recomendada</p>
              <h2 id="english-error-review-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Questões de inglês para reforçar</h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Retome questões que você errou. A resposta e a explicação só aparecem depois do envio.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-950 dark:bg-slate-900 dark:text-amber-100">{englishErrorNotes.length} {englishErrorNotes.length === 1 ? 'questão' : 'questões'}</span>
          </div>
          {errorNotebook.isLoading ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-600 dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-300">Consultando suas questões para reforçar…</p> : null}
          {errorNotebook.isError ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-slate-900 dark:text-amber-100">Não foi possível consultar as revisões agora. Seu progresso continua salvo.</p> : null}
          {!errorNotebook.isLoading && !errorNotebook.isError && englishErrorNotes.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {englishErrorNotes.slice(0, 6).map((note) => {
                const journey = note.canonical_skill_id ? englishJourneyBySkill.get(note.canonical_skill_id) : undefined;
                if (!journey) return null;
                return (
                  <li key={note.id} className="flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-slate-900">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">{journey.unit_title || 'Trilha de inglês'}</p>
                      <h3 className="mt-1 font-bold text-slate-900 dark:text-white">{journey.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{note.error_count} {note.error_count === 1 ? 'tentativa com erro' : 'tentativas com erro'}</p>
                    </div>
                    <Link to={`/student/study/error/${encodeURIComponent(note.id)}`} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-amber-700 px-3 py-2 text-sm font-bold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-500 dark:text-amber-100 dark:hover:bg-amber-950/50">
                      <RotateCcw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!errorNotebook.isLoading && !errorNotebook.isError && englishErrorNotes.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-700 dark:border-amber-900 dark:bg-slate-900/60 dark:text-slate-300">Nenhuma questão de inglês aguardando reforço no Caderno de Erros.</p> : null}
        </section>
      ) : null}

      {!journeys.isLoading && !journeys.isError && englishJourneys.length > 0 ? (
        <section aria-labelledby="english-units-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Seu mapa de aprendizagem</p>
              <h2 id="english-units-title" className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Trilhas de inglês</h2>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-100">{englishJourneys.length} {englishJourneys.length === 1 ? 'trilha' : 'trilhas'}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {englishJourneys.map((journey) => {
              const ready = isReviewedAndAvailable(journey);
              const isStarting = startingJourneyId === journey.journey_id;
              const hasActiveSession = Boolean(journey.active_session_id);
              return (
                <article key={journey.journey_id} className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{journey.unit_title || 'Trilha de inglês'}</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{journey.title}</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{ready ? (hasActiveSession ? 'Em andamento' : 'Disponível') : 'Em revisão'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" aria-hidden="true" />{journey.question_count} questões no percurso</span>
                    {journey.active_session_status ? <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" aria-hidden="true" />Sessão {journey.active_session_status === 'PAUSED' ? 'pausada' : 'ativa'}</span> : null}
                  </div>
                  {ready ? <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>Domínio atual</span><span>{Math.round(Math.max(0, Math.min(100, journey.progress)))}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={`Domínio atual: ${Math.round(Math.max(0, Math.min(100, journey.progress)))}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, journey.progress)))}>
                      <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${Math.round(Math.max(0, Math.min(100, journey.progress)))}%` }} />
                    </div>
                  </div> : null}
                  {!ready ? <p className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-200">Este conteúdo está em revisão pedagógica ou ainda não foi publicado. Ele não está liberado para estudo nem gera progresso.</p> : null}
                  <div className="mt-auto pt-5">
                    {ready ? <button type="button" disabled={isStarting} onClick={() => void openJourney(journey)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60"><Play className="h-4 w-4" aria-hidden="true" />{isStarting ? 'Abrindo trilha…' : hasActiveSession ? 'Continuar trilha' : 'Começar trilha'}</button> : <button type="button" disabled className="min-h-11 cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">Indisponível durante a revisão</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!journeys.isLoading && !journeys.isError && englishJourneys.length === 0 ? <section className="rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Trilhas ainda não disponíveis</h2><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">Estamos preparando e revisando o conteúdo de inglês para a sua série. Quando houver uma trilha aprovada e publicada para sua matrícula, ela aparecerá aqui automaticamente.</p></section> : null}
      {startError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">Não foi possível iniciar a trilha. Nenhum progresso foi alterado; tente novamente.</p> : null}
      {eligibleJourneys.length === 0 && englishJourneys.length > 0 ? <p role="status" className="sr-only">Nenhuma trilha de inglês está liberada para iniciar enquanto a revisão e a publicação não forem concluídas.</p> : null}
    </main>
  );
}
