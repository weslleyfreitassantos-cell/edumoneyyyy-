import { ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { isStudentGuidedJourneyPreview, isStudentGuidedJourneyReleased, mergeStudentSubjectsWithGuidedJourneys } from '../../lib/learningCenterSubjectDiscovery';
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
  const subjectJourneys = (guidedJourneys.data ?? []).filter((journey) => journey.subject_id === selectedSubject?.id);
  const releasedJourneys = subjectJourneys.filter((journey) =>
    journey.source === 'CENTRAL_STUDIES_V2'
      && isStudentGuidedJourneyReleased(journey)
      && journey.question_count > 0,
  );
  const previewJourneys = subjectJourneys.filter(isStudentGuidedJourneyPreview);
  const releasedByUnit = new Map<string, typeof releasedJourneys>();
  for (const journey of releasedJourneys) {
    const key = journey.unit_code || journey.unit_title;
    const lessons = releasedByUnit.get(key) ?? [];
    lessons.push(journey);
    releasedByUnit.set(key, lessons);
  }
  const previewByUnit = new Map<string, typeof previewJourneys>();
  for (const journey of previewJourneys) {
    const key = journey.unit_code || journey.unit_title;
    const lessons = previewByUnit.get(key) ?? [];
    lessons.push(journey);
    previewByUnit.set(key, lessons);
  }
  const isEnglish = selectedSubject?.code?.trim().toUpperCase() === 'ING'
    || selectedSubject?.name.toLocaleLowerCase('pt-BR').includes('inglês');

  if (subjects.isLoading) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  }

  if (subjects.isError || !selectedSubject) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar ao estudo guiado</Link>
        <div role={subjects.isError ? 'alert' : 'status'} className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">{subjects.isError ? 'Não foi possível carregar suas matérias agora.' : 'Esta matéria não está disponível para sua matrícula.'}</div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar ao estudo guiado</Link>

      <section aria-label={`Estudo guiado de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Estudo guiado</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Continue pelas aulas guiadas desta matéria.</p>
        {isEnglish ? <Link to="/student/study/english" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Abrir Tec Inglês</Link> : null}
      </section>

      {guidedJourneys.isLoading ? <p role="status" className="text-sm text-slate-500">Carregando aulas do estudo guiado...</p> : null}
      {guidedJourneys.isError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar as aulas guiadas desta matéria.</p> : null}

      {releasedByUnit.size ? (
        <section aria-label="Aulas do estudo guiado" className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Aulas disponíveis</h2>
          {[...releasedByUnit.values()].map((unitJourneys) => (
            <section key={unitJourneys[0].unit_code || unitJourneys[0].unit_title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white">{unitJourneys[0].unit_title}</h3>
              <div className="mt-3 space-y-2">
                {unitJourneys.map((journey) => (
                  <article key={journey.journey_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 p-3 dark:border-slate-700">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{journey.title}</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aula guiada e {journey.question_count} questões</p>
                    </div>
                    <Link to={`/student/study/guided?journey=${encodeURIComponent(journey.journey_id)}`} className="inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">
                      {journey.progress > 0 || journey.active_session_id ? 'Continuar aula' : 'Iniciar aula guiada'}
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}

      {previewByUnit.size ? (
        <section aria-label="Estudo guiado" className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Estudo guiado</h2>
          {[...previewByUnit.values()].map((unitJourneys) => (
              <section key={unitJourneys[0].unit_code || unitJourneys[0].unit_title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white">{unitJourneys[0].unit_title}</h3>
              <div className="mt-3 space-y-2">
                {unitJourneys.map((journey) => (
                  <article key={journey.journey_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 p-3 dark:border-slate-700">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{journey.title}</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aula guiada e {journey.question_count} questões</p>
                    </div>
                    <Link to={`/student/study/guided?journey=${encodeURIComponent(journey.journey_id)}`} className="inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">
                      {journey.progress > 0 || journey.active_session_id ? 'Continuar aula' : 'Abrir aula guiada'}
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}

      {!guidedJourneys.isLoading && !guidedJourneys.isError && !releasedByUnit.size && !previewByUnit.size ? (
        <p role="status" className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-slate-600 dark:border-blue-900 dark:bg-slate-900/50 dark:text-slate-300">Novas aulas do estudo guiado desta matéria estão sendo preparadas.</p>
      ) : null}

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <Link to="/student/activities" className="text-sm font-semibold text-[#005bbf] hover:underline">Ir para Lista de Exercícios</Link>
      </div>
    </div>
  );
}
