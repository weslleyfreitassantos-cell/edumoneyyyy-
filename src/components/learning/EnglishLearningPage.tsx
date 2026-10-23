import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Play, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useGuidedDisciplineJourneysV9, useLearningStudent, useStartGuidedDisciplineJourneyV9 } from '../../hooks/useLearningCenter';
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
  const startJourney = useStartGuidedDisciplineJourneyV9(currentInstitutionId ?? undefined, student.data?.id);
  const englishJourneys = useMemo(
    () => (journeys.data ?? []).filter(isEnglishJourney).sort((left, right) => left.unit_title.localeCompare(right.unit_title, 'pt-BR') || left.title.localeCompare(right.title, 'pt-BR')),
    [journeys.data],
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
