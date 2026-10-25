import { ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { getInstitutionalStudentSubjects, getPublishedLearningProgress } from '../../lib/learningCenterSubjectDiscovery';
import {
  useLearningProgress,
  useLearningStudent,
  useLearningUnits,
  usePublishedLearningActivities,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const progress = useLearningProgress(currentInstitutionId ?? undefined, student.data?.id);
  const displaySubjects = useMemo(
    () => getInstitutionalStudentSubjects(subjects.data ?? []),
    [subjects.data],
  );
  const selectedSubject = displaySubjects.find((item) => item.id === subjectId);
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubject?.id);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubject?.id),
    [activities.data, selectedSubject?.id],
  );
  const isEnglish = selectedSubject?.code?.trim().toUpperCase() === 'ING'
    || selectedSubject?.name.toLocaleLowerCase('pt-BR').includes('inglês');
  const publishedProgress = useMemo(
    () => getPublishedLearningProgress(subjectActivities, progress.data ?? []),
    [progress.data, subjectActivities],
  );
  const publishedUnitIds = useMemo(
    () => new Set(subjectActivities.flatMap((activity) => activity.unit_id ? [activity.unit_id] : [])),
    [subjectActivities],
  );
  const visibleUnits = (units.data ?? []).filter((unit) => publishedUnitIds.has(unit.id));
  const visibleUnitIds = new Set(visibleUnits.map((unit) => unit.id));
  const activitiesWithoutUnit = subjectActivities.filter(
    (activity) => !activity.unit_id || !visibleUnitIds.has(activity.unit_id),
  );
  const activitiesByUnit = new Map<string, typeof subjectActivities>();
  for (const activity of subjectActivities) {
    if (!activity.unit_id || !visibleUnitIds.has(activity.unit_id)) continue;
    const group = activitiesByUnit.get(activity.unit_id) ?? [];
    group.push(activity);
    activitiesByUnit.set(activity.unit_id, group);
  }
  const lastActivityLabel = publishedProgress?.lastActivityAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(publishedProgress.lastActivityAt))
    : null;

  if (subjects.isLoading) return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  if (subjects.isError || !selectedSubject) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
        <div role={subjects.isError ? 'alert' : 'status'} className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">{subjects.isError ? 'Não foi possível carregar suas matérias agora.' : 'Esta matéria não está disponível para sua matrícula.'}</div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
      <section aria-label={`Estudo de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Área da matéria</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Continue de onde parou ou escolha um conteúdo publicado pela sua escola.</p>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Seu estudo nesta matéria</p>
          {activities.isLoading
            ? <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Verificando atividades publicadas...</p>
            : activities.isError
              ? <p role="alert" className="mt-2 text-sm text-amber-800 dark:text-amber-200">Não foi possível carregar as atividades agora. Tente novamente mais tarde.</p>
                : subjectActivities.length
                ? <div className="mt-2 space-y-2 text-sm text-emerald-800 dark:text-emerald-200"><p>Você tem {subjectActivities.length} {subjectActivities.length === 1 ? 'atividade publicada' : 'atividades publicadas'} para estudar.</p>{publishedProgress ? <p>Domínio registrado: {publishedProgress.masteryPercent}% em {publishedProgress.skillCount} {publishedProgress.skillCount === 1 ? 'habilidade' : 'habilidades'} de atividades publicadas ({publishedProgress.masteredCount} consolidadas).{lastActivityLabel ? ` Última atividade: ${lastActivityLabel}.` : ''}</p> : null}</div>
                : <p role="status" className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">Novas atividades desta matéria estão sendo preparadas.</p>}
          {isEnglish ? <Link to="/student/study/english" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Abrir Tec Inglês</Link> : null}
          {subjectActivities[0] ? <Link to={`/student/study/activity/${subjectActivities[0].id}`} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Continuar estudando</Link> : null}
        </div>

        {units.isLoading ? <p role="status" className="mt-5 text-sm text-slate-500">Carregando unidades...</p> : null}
        {units.isError ? <p role="alert" className="mt-5 text-sm text-red-700">Não foi possível carregar as unidades desta matéria.</p> : null}
        {visibleUnits.length ? <div className="mt-5 space-y-4"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Unidades com atividades publicadas</h2>{visibleUnits.map((unit) => <section key={unit.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">{unit.title}</h3>{unit.description ? <p className="mt-1 text-sm text-slate-500">{unit.description}</p> : null}<div className="mt-3 space-y-2">{(activitiesByUnit.get(unit.id) ?? []).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div></section>)}</div> : null}
        {activitiesWithoutUnit.length ? <div className="mt-5 space-y-2"><h2 className="text-sm font-bold dark:text-white">Atividades publicadas pela escola</h2>{activitiesWithoutUnit.map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700 dark:bg-slate-900"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : null}
        {!units.isLoading && !units.isError && !activities.isLoading && !activities.isError && !subjectActivities.length ? <p className="mt-5 rounded-xl border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-slate-600 dark:border-blue-900 dark:bg-slate-900/50 dark:text-slate-300">Novas atividades desta matéria estão sendo preparadas.</p> : null}
      </section>
    </div>
  );
}
