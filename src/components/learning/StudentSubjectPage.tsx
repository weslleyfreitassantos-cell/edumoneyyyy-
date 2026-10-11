import { ChevronLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { mergeStudentSubjectsWithGuidedJourneys } from '../../lib/learningCenterSubjectDiscovery';
import {
  useLearningSkills,
  useLearningStudent,
  useLearningUnits,
  usePublishedLearningActivities,
  useGuidedDisciplineJourneysV9,
  useStartGuidedDisciplineJourneyV9,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const guidedJourneys = useGuidedDisciplineJourneysV9(currentInstitutionId ?? undefined, student.data?.id);
  const displaySubjects = useMemo(
    () => mergeStudentSubjectsWithGuidedJourneys(subjects.data ?? [], guidedJourneys.data ?? []),
    [guidedJourneys.data, subjects.data],
  );
  const selectedSubject = displaySubjects.find((item) => item.id === subjectId);
  const startGuided = useStartGuidedDisciplineJourneyV9(currentInstitutionId ?? undefined, student.data?.id);
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubject?.id);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, selectedUnitId);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubject?.id),
    [activities.data, selectedSubject?.id],
  );
  const subjectJourneys = useMemo(
    () => (guidedJourneys.data ?? []).filter((journey) => journey.subject_id === selectedSubject?.id),
    [guidedJourneys.data, selectedSubject?.id],
  );

  async function startGuidedJourney(journeyId: string, skillId: string) {
    await startGuided.mutateAsync(journeyId);
    navigate(`/student/study/guided?journey=${encodeURIComponent(journeyId)}&skill=${encodeURIComponent(skillId)}`);
  }

  if (subjects.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  if (subjects.isError || !selectedSubject) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta matéria não está disponível para você.</div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
      <section aria-label={`Estudo de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Área da matéria</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Continue de onde parou ou escolha um conteúdo.</p>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Estudo guiado</p>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">Conteúdo curricular global e atividades da escola ficam em trilhas separadas.</p>
          {guidedJourneys.isLoading ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Verificando conteúdos desta matéria...</p> : null}
          {guidedJourneys.isError ? <p role="status" className="mt-3 text-sm text-amber-800 dark:text-amber-200">Não foi possível verificar o estudo guiado agora. As atividades da escola continuam disponíveis.</p> : null}
          {!guidedJourneys.isLoading && !guidedJourneys.isError && subjectJourneys.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-emerald-300 bg-white/60 p-3 text-sm text-slate-600 dark:border-emerald-800 dark:bg-slate-900/40 dark:text-slate-300">Ainda não há uma jornada guiada disponível para esta matéria.</p> : null}
          {subjectJourneys.length ? <div className="mt-3 space-y-3">{subjectJourneys.map((journey) => {
            const active = Boolean(journey.active_session_id);
            const canStart = journey.question_count >= 2 && journey.missing_purposes.length === 0;
            const codeLabel = journey.official_codes.length ? journey.official_codes.join(', ') : 'Sem código relacionado';
            return <article key={journey.journey_id} className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{journey.unit_title}</p>
                  <h2 className="mt-1 font-semibold text-slate-900 dark:text-white">{journey.title}</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{journey.question_count} questões no conjunto · {Math.round(journey.progress)}% de progresso</p>
                </div>
                {active ? <Link to={`/student/study/guided?journey=${encodeURIComponent(journey.journey_id)}&skill=${encodeURIComponent(journey.execution_skill_id)}`} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">Continuar</Link> : canStart ? <button type="button" disabled={startGuided.isPending} onClick={() => void startGuidedJourney(journey.journey_id, journey.execution_skill_id)} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{startGuided.isPending ? 'Iniciando...' : 'Começar estudo'}</button> : <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Percurso incompleto</span>}
              </div>
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Prévia demonstrativa · revisão pedagógica pendente</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Relação curricular candidata, não validada: {codeLabel}. {journey.learning_role === 'FOUNDATION_REVIEW' ? 'Conteúdo de reforço de fundamentos, não uma sequência exclusiva do 1º ano.' : 'Sequência introdutória recomendada pelo TecEscola; a habilidade EM13 não é exclusiva de uma série.'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{journey.mapping_reason}</p>
              {!canStart && journey.missing_purposes.length ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Etapas ainda sem questões: {journey.missing_purposes.join(', ')}.</p> : null}
              {startGuided.isError ? <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{startGuided.error.message}</p> : null}
            </article>;
          })}</div> : null}
        </div>

        {units.isLoading ? <p className="mt-5 text-sm text-slate-500">Carregando conteúdos...</p> : null}
        {units.data?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{units.data.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnitId === unit.id} className={`rounded-lg border p-3 text-left text-sm transition hover:border-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'dark:border-slate-700 dark:text-slate-200'}`}><span className="font-semibold">{unit.title}</span>{unit.description ? <span className="mt-1 block text-xs text-slate-500">{unit.description}</span> : null}</button>)}</div> : null}
        {selectedUnitId && skills.data?.length ? <div className="mt-4"><p className="text-sm font-bold dark:text-white">Conteúdos para praticar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{skills.data.map((skill) => <li key={skill.id} className="rounded-lg border p-3 text-sm dark:border-slate-700 dark:text-slate-200">{skill.title}</li>)}</ul></div> : null}
        {subjectActivities.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold dark:text-white">Atividades disponíveis</p>{subjectActivities.slice(0, 4).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Nenhuma atividade institucional publicada para esta matéria.</p>}
      </section>
    </div>
  );
}
