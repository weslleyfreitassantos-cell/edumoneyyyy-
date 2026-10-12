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
  useRecommendedGuidedStudyV10,
  useStartRecommendedGuidedStudyV10,
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
  const guidedRecommendation = useRecommendedGuidedStudyV10(currentInstitutionId ?? undefined, selectedSubject?.id, profile?.id);
  const startRecommendedStudy = useStartRecommendedGuidedStudyV10(currentInstitutionId ?? undefined, student.data?.id, profile?.id);
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubject?.id);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, selectedUnitId);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubject?.id),
    [activities.data, selectedSubject?.id],
  );
  async function startRecommendedJourney() {
    if (!selectedSubject) return;
    const result = await startRecommendedStudy.mutateAsync(selectedSubject.id).catch(() => null);
    if (result?.journey_id && result.execution_skill_id) {
      navigate(`/student/study/guided?journey=${encodeURIComponent(result.journey_id)}&skill=${encodeURIComponent(result.execution_skill_id)}`);
    }
  }

  const recommendation = guidedRecommendation.data;
  const gradeLabel = recommendation?.stage && recommendation.grade_level
    ? recommendation.stage === 'ENSINO_MEDIO'
      ? `${recommendation.grade_level}º ano do Ensino Médio`
      : recommendation.stage === 'ENSINO_FUNDAMENTAL'
        ? `${recommendation.grade_level}º ano do Ensino Fundamental`
        : `${recommendation.grade_level}º ano`
    : null;
  const recommendationUnavailableMessage: Record<string, string> = {
    NO_ACTIVE_ENROLLMENT: 'Não encontramos uma matrícula ativa para definir seu próximo estudo.',
    AMBIGUOUS_ENROLLMENT: 'Há mais de uma matrícula ativa. Peça à escola para confirmar sua turma atual.',
    GRADE_NOT_SUPPORTED: 'Ainda não há conteúdo demonstrativo disponível para sua série nesta matéria.',
    NO_BNCC_MAPPING: 'Esta matéria ainda não possui vínculo curricular autorizado para o estudo guiado.',
    NO_ELIGIBLE_CONTENT: 'Ainda não há uma etapa completa disponível para esta matéria.',
    CONTENT_EXHAUSTED: 'Você concluiu as etapas disponíveis nesta prévia demonstrativa.',
    NEEDS_TEACHER_SUPPORT: 'Esta etapa precisa de acompanhamento do professor antes de continuar.',
  };

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
          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Seu estudo guiado</p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">Organizamos seu aprendizado com base na sua série e no que você já estudou.</p>
          {guidedRecommendation.isLoading ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">Preparando sua próxima etapa...</p> : null}
          {guidedRecommendation.isError ? <p role="alert" className="mt-3 text-sm text-amber-800 dark:text-amber-200">Não foi possível consultar seu estudo guiado agora. As atividades da escola continuam disponíveis.</p> : null}
          {!guidedRecommendation.isLoading && !guidedRecommendation.isError && recommendation ? <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {gradeLabel ? <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{gradeLabel}</p> : null}
                {recommendation.unit_title ? <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{recommendation.unit_title}</p> : null}
                {recommendation.title ? <h2 className="mt-1 font-semibold text-slate-900 dark:text-white">{recommendation.title}</h2> : null}
                {typeof recommendation.progress === 'number' && recommendation.progress > 0 ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Progresso nesta etapa: {Math.round(recommendation.progress)}%</p> : null}
                {recommendation.state === 'ACTIVE' && recommendation.session_status === 'PAUSED' ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Você continuará do ponto em que parou.</p> : null}
              </div>
              {recommendation.state === 'ACTIVE' && recommendation.execution_skill_id ? <Link to={`/student/study/guided?${recommendation.journey_id ? `journey=${encodeURIComponent(recommendation.journey_id)}&` : ''}skill=${encodeURIComponent(recommendation.execution_skill_id)}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">Continuar estudo</Link> : null}
              {(recommendation.state === 'READY' || recommendation.state === 'REVIEW') ? <button type="button" disabled={startRecommendedStudy.isPending} onClick={() => void startRecommendedJourney()} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{startRecommendedStudy.isPending ? 'Preparando...' : recommendation.state === 'REVIEW' ? 'Retomar revisão' : 'Iniciar estudo'}</button> : null}
            </div>
            {recommendation.demonstration_only || recommendation.pedagogical_review_status === 'PEDAGOGICAL_REVIEW_PENDING' ? <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">Prévia demonstrativa · revisão pedagógica pendente</p> : null}
            {recommendationUnavailableMessage[recommendation.state] ? <p role="status" className="mt-1 text-sm text-slate-600 dark:text-slate-300">{recommendationUnavailableMessage[recommendation.state]}</p> : null}
          </div> : null}
          {startRecommendedStudy.isError ? <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">Não foi possível iniciar sua próxima etapa. Tente novamente em instantes.</p> : null}
        </div>

        {units.isLoading ? <p className="mt-5 text-sm text-slate-500">Carregando conteúdos...</p> : null}
        {units.data?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{units.data.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnitId === unit.id} className={`rounded-lg border p-3 text-left text-sm transition hover:border-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'dark:border-slate-700 dark:text-slate-200'}`}><span className="font-semibold">{unit.title}</span>{unit.description ? <span className="mt-1 block text-xs text-slate-500">{unit.description}</span> : null}</button>)}</div> : null}
        {selectedUnitId && skills.data?.length ? <div className="mt-4"><p className="text-sm font-bold dark:text-white">Conteúdos para praticar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{skills.data.map((skill) => <li key={skill.id} className="rounded-lg border p-3 text-sm dark:border-slate-700 dark:text-slate-200">{skill.title}</li>)}</ul></div> : null}
        {subjectActivities.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold dark:text-white">Atividades disponíveis</p>{subjectActivities.slice(0, 4).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Nenhuma atividade institucional publicada para esta matéria.</p>}
      </section>
    </div>
  );
}
