import { ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { isStudentGuidedJourneyReleased, mergeStudentSubjectsWithGuidedJourneys } from '../../lib/learningCenterSubjectDiscovery';
import {
  useLearningStudent,
  useGuidedDisciplineJourneysV9,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const guidedJourneys = useGuidedDisciplineJourneysV9(currentInstitutionId ?? undefined, student.data?.id);
  const displaySubjects = useMemo(
    () => mergeStudentSubjectsWithGuidedJourneys(subjects.data ?? [], guidedJourneys.data ?? []),
    [guidedJourneys.data, subjects.data],
  );
  const selectedSubject = displaySubjects.find((item) => item.id === subjectId);
  const isEnglish = selectedSubject?.code?.trim().toUpperCase() === 'ING'
    || selectedSubject?.name.toLocaleLowerCase('pt-BR').includes('inglês');
  const releasedProgress = (guidedJourneys.data ?? []).filter((journey) =>
    journey.subject_id === selectedSubject?.id
      && journey.source === 'CENTRAL_STUDIES_V2'
      && isStudentGuidedJourneyReleased(journey)
      && journey.question_count > 0,
  );
  const completedCount = releasedProgress.filter((journey) => journey.progress >= 100).length;
  const progressPercent = releasedProgress.length
    ? Math.round(releasedProgress.reduce((sum, journey) => sum + journey.progress, 0) / releasedProgress.length)
    : null;

  if (subjects.isLoading) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  }

  if (subjects.isError || !selectedSubject) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar à Central de Estudos</Link>
        <div role={subjects.isError ? 'alert' : 'status'} className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">{subjects.isError ? 'Não foi possível carregar suas matérias agora.' : 'Esta matéria não está disponível para sua matrícula.'}</div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar à Central de Estudos</Link>

      <section aria-label={`Acompanhamento de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Acompanhamento de aprendizagem</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">O Estudo Guiado escolhe automaticamente a próxima habilidade. Esta página mostra apenas seu progresso.</p>
        {isEnglish ? <Link to="/student/study/english" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Abrir Tec Idiomas</Link> : null}
      </section>

      {guidedJourneys.isLoading ? <p role="status" className="text-sm text-slate-500">Carregando seu progresso...</p> : null}
      {guidedJourneys.isError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar seu progresso agora.</p> : null}

      {!guidedJourneys.isLoading && !guidedJourneys.isError ? (
        <section aria-label="Progresso na matéria" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-bold text-slate-900 dark:text-white">Seu progresso</h2>
          {releasedProgress.length ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-semibold text-slate-500">Habilidades disponíveis</p><p className="mt-1 text-2xl font-bold">{releasedProgress.length}</p></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-semibold text-slate-500">Consolidadas</p><p className="mt-1 text-2xl font-bold">{completedCount}</p></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs font-semibold text-slate-500">Progresso médio</p><p className="mt-1 text-2xl font-bold">{progressPercent}%</p></div>
              </div>
              <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
                {releasedProgress.map((journey) => (
                  <li key={journey.journey_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="font-semibold text-slate-900 dark:text-white">{journey.title}</p><p className="text-sm text-slate-500">{journey.unit_title}</p></div>
                    <span className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">{Math.min(100, Math.max(0, journey.progress))}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Ainda não há habilidades tecnicamente validadas e publicadas para acompanhar nesta matéria. Seu estudo global continuará quando houver conteúdo elegível.</p>}
          <Link to="/student/study" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Voltar ao Estudo Guiado</Link>
        </section>
      ) : null}

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <Link to="/student/activities" className="text-sm font-semibold text-[#005bbf] hover:underline">Ir para Lista de Exercícios</Link>
      </div>
    </div>
  );
}
