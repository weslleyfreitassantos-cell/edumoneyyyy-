import { BookOpenCheck, ClipboardList, Loader2, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { getPublishedLearningProgress } from '../../lib/learningCenterSubjectDiscovery';
import { useLearningProgress, useLearningStudent, usePublishedLearningActivities } from '../../hooks/useLearningCenter';
import type { LearningActivity } from '../../services/learningCenterService';

function subjectName(activity: LearningActivity): string {
  const subject = Array.isArray(activity.subjects) ? activity.subjects[0] : activity.subjects;
  return subject?.name ?? 'Matéria não informada';
}

function formatDate(value?: string): string {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

export default function StudentPublishedActivitiesPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const progress = useLearningProgress(currentInstitutionId ?? undefined, student.data?.id);
  const publishedProgress = useMemo(
    () => getPublishedLearningProgress(activities.data ?? [], progress.data ?? []),
    [activities.data, progress.data],
  );
  const visibleActivities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return (activities.data ?? []).filter((activity) => {
      const matchesSubject = !subjectFilter || activity.subject_id === subjectFilter;
      const searchableText = [activity.title, activity.description ?? '', subjectName(activity)]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return matchesSubject && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [activities.data, search, subjectFilter]);
  const subjects = useMemo(() => {
    const uniqueSubjects = new Map<string, string>();
    for (const activity of activities.data ?? []) uniqueSubjects.set(activity.subject_id, subjectName(activity));
    return [...uniqueSubjects].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));
  }, [activities.data]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/student/study" className="text-sm font-semibold text-[#005bbf] hover:underline">Estudo guiado</Link>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Aprendizagem</p>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lista de Exercícios</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Exercícios publicados pela equipe docente, separados do estudo guiado.</p>
        </div>
        {!activities.isLoading && !activities.isError ? <p className="text-sm font-semibold text-slate-500" aria-live="polite">{activities.data?.length ?? 0} {(activities.data?.length ?? 0) === 1 ? 'atividade' : 'atividades'}</p> : null}
      </header>

      {publishedProgress ? (
        <section aria-label="Seu progresso na Lista de Exercícios" className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
          <p className="font-bold">Seu progresso nas atividades</p>
          <p className="mt-1">Domínio registrado: {publishedProgress.masteryPercent}% em {publishedProgress.skillCount} {publishedProgress.skillCount === 1 ? 'habilidade' : 'habilidades'} ({publishedProgress.masteredCount} {publishedProgress.masteredCount === 1 ? 'consolidada' : 'consolidadas'}).{publishedProgress.lastActivityAt ? ` Última atividade: ${formatDate(publishedProgress.lastActivityAt)}.` : ''}</p>
        </section>
      ) : null}

      <section aria-label="Filtros de atividades" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <label className="relative block">
          <span className="sr-only">Pesquisar atividades</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            aria-label="Pesquisar atividades"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar atividade ou matéria"
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
        <label className="sr-only" htmlFor="student-activity-subject">Filtrar por matéria</label>
        <select
          id="student-activity-subject"
          aria-label="Filtrar por matéria"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Todas as matérias</option>
          {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </section>

      {activities.isLoading ? (
        <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin text-[#005bbf]" aria-hidden="true" />Carregando atividades...</span></div>
      ) : activities.isError ? (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p>Não foi possível carregar a Lista de Exercícios.</p>
          <button type="button" onClick={() => void activities.refetch()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold text-red-800 hover:bg-red-100"><RotateCcw className="h-4 w-4" aria-hidden="true" />Tentar novamente</button>
        </section>
      ) : visibleActivities.length ? (
        <section aria-label="Atividades publicadas pelos professores" className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {visibleActivities.map((activity) => (
            <article key={activity.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200"><BookOpenCheck className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#005bbf]">{subjectName(activity)}</p>
                  <h2 className="mt-1 font-bold text-slate-900 dark:text-white">{activity.title}</h2>
                  {activity.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{activity.description}</p> : null}
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{activity.learning_questions?.length ?? 0} questões · Publicada em {formatDate(activity.created_at)}</p>
                </div>
              </div>
              <Link to={`/student/study/activity/${activity.id}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Responder</Link>
            </article>
          ))}
        </section>
      ) : activities.data?.length ? (
        <p role="status" className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhuma atividade corresponde à sua busca.</p>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-bold text-slate-900 dark:text-white">Nenhuma atividade publicada</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Os exercícios publicados pelos professores aparecerão aqui.</p>
        </section>
      )}
    </div>
  );
}
