import { ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { buildStudentSubjectLearningSummary, isStudentGuidedJourneyReleased, mergeStudentSubjectsWithGuidedJourneys } from '../../lib/learningCenterSubjectDiscovery';
import {
  useGuidedDisciplineJourneysV9,
  useLearningCanonicalProgress,
  useLearningCurriculumSubjectLinks,
  useLearningProgress,
  useLearningStudent,
  usePublishedLearningActivities,
  useStudentGuidedLearningTargets,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

function formatMastery(value: number): string {
  return `${Math.min(100, Math.max(0, value))}%`;
}

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const studentId = student.data?.id;
  const guidedJourneys = useGuidedDisciplineJourneysV9(currentInstitutionId ?? undefined, studentId);
  const guidedTargets = useStudentGuidedLearningTargets(currentInstitutionId ?? undefined, studentId);
  const curriculumLinks = useLearningCurriculumSubjectLinks(currentInstitutionId ?? undefined);
  const canonicalProgress = useLearningCanonicalProgress(currentInstitutionId ?? undefined, studentId);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const activityProgress = useLearningProgress(currentInstitutionId ?? undefined, studentId);
  const displaySubjects = useMemo(
    () => mergeStudentSubjectsWithGuidedJourneys(subjects.data ?? [], guidedJourneys.data ?? []),
    [guidedJourneys.data, subjects.data],
  );
  const selectedSubject = displaySubjects.find((item) => item.id === subjectId);
  const summary = useMemo(() => selectedSubject ? buildStudentSubjectLearningSummary({
    subject: selectedSubject,
    curriculumLinks: curriculumLinks.data ?? [],
    guidedTargets: guidedTargets.data ?? [],
    canonicalProgress: canonicalProgress.data ?? [],
    activities: activities.data ?? [],
    activityProgress: activityProgress.data ?? [],
    journeys: guidedJourneys.data ?? [],
  }) : null, [activities.data, activityProgress.data, canonicalProgress.data, curriculumLinks.data, guidedJourneys.data, guidedTargets.data, selectedSubject]);
  const isEnglish = selectedSubject?.code?.trim().toUpperCase() === 'ING'
    || selectedSubject?.name.toLocaleLowerCase('pt-BR').includes('inglês');

  if (subjects.isLoading || student.isLoading) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  }

  if (subjects.isError || student.isError || !selectedSubject || !summary) {
    const hasLoadError = subjects.isError || student.isError;
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar à Central de Estudos</Link>
        <div role={hasLoadError ? 'alert' : 'status'} className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          {hasLoadError ? 'Não foi possível carregar seus vínculos escolares agora.' : 'Esta matéria não está disponível para sua matrícula.'}
        </div>
      </section>
    );
  }

  if (!studentId) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar à Central de Estudos</Link>
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Não foi possível confirmar uma matrícula ativa para consultar seu conteúdo e progresso.
        </div>
      </section>
    );
  }

  const areaLoading = curriculumLinks.isLoading || guidedTargets.isLoading;
  const areaError = curriculumLinks.isError || guidedTargets.isError;
  const progressLoading = canonicalProgress.isLoading || activityProgress.isLoading;
  const availableJourneys = summary.releasedJourneys.filter(isStudentGuidedJourneyReleased);

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar à Central de Estudos</Link>

      <section aria-label={`Acompanhamento de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Acompanhamento de aprendizagem</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Seu progresso real aparece separado do conteúdo geral da área BNCC. O Estudo Guiado escolhe automaticamente a próxima habilidade.</p>
        {isEnglish ? <Link to="/student/study/english" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Abrir Tec Idiomas</Link> : null}
      </section>

      <section aria-label="Conteúdo disponível na área BNCC" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#005bbf]">Estudo Guiado</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Conteúdo disponível na área BNCC</h2>
        </div>
        {areaLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Consultando habilidades publicadas para sua matrícula...</p> : null}
        {areaError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível consultar o catálogo BNCC e seus vínculos institucionais. A consulta falhou; isso não significa que a matéria esteja sem conteúdo.</p> : null}
        {!areaLoading && !areaError ? summary.areaScopes.length === 0 ? (
          <p role="status" className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Ainda não há um vínculo curricular de área BNCC para esta matéria. Isso não altera nem oculta as atividades específicas publicadas pela escola.</p>
        ) : summary.areaSkills.length ? (
          <>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {summary.areaScopes.map((area) => area.label).join(' · ')}. Estas habilidades pertencem à área curricular e não são atribuídas automaticamente, de forma exclusiva, a {selectedSubject.name}.
            </p>
            {!progressLoading && !canonicalProgress.isError ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><dt className="text-xs font-semibold text-slate-500">Habilidades disponíveis na área</dt><dd className="mt-1 text-2xl font-bold">{summary.areaStats.availableCount}</dd></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><dt className="text-xs font-semibold text-slate-500">Em andamento</dt><dd className="mt-1 text-2xl font-bold">{summary.areaStats.inProgressCount}</dd></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><dt className="text-xs font-semibold text-slate-500">Consolidadas</dt><dd className="mt-1 text-2xl font-bold">{summary.areaStats.masteredCount}</dd></div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><dt className="text-xs font-semibold text-slate-500">Domínio médio real</dt><dd className="mt-1 text-2xl font-bold">{summary.areaStats.masteryPercent ?? 0}%</dd></div>
              </dl>
            ) : null}
            {progressLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Carregando seu estado de aprendizagem...</p> : null}
            {canonicalProgress.isError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">As habilidades foram consultadas, mas seu estado e suas evidências não puderam ser lidos agora.</p> : null}
            <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
              {summary.areaSkills.map((skill) => (
                <li key={skill.target_canonical_skill_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{skill.title}</p>
                    <p className="text-sm text-slate-500">{skill.official_code} · {skill.subject_area.replace(/_/g, ' ')}</p>
                    {!canonicalProgress.isError ? <p className="mt-1 text-xs text-slate-500">{skill.progressState === 'MASTERED' ? 'Consolidada' : skill.evidenceCount > 0 || skill.masteryEstimate > 0 ? 'Em andamento' : 'Ainda não iniciada'} · {skill.evidenceCount} {skill.evidenceCount === 1 ? 'evidência' : 'evidências'} · {skill.question_count} questões adaptativas disponíveis</p> : <p className="mt-1 text-xs text-slate-500">{skill.question_count} questões adaptativas disponíveis · progresso indisponível</p>}
                  </div>
                  {!canonicalProgress.isError ? <span className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">{formatMastery(skill.masteryEstimate)}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p role="status" className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">O banco confirmou que não há habilidades publicadas e elegíveis para a série desta matrícula nas áreas {summary.areaScopes.map((area) => area.label).join(' · ')}.</p>
        ) : null}
      </section>

      <section aria-label={`Conteúdo publicado especificamente em ${selectedSubject.name}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#005bbf]">Conteúdo específico</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Publicado para {selectedSubject.name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Somente atividades e jornadas vinculadas diretamente a esta matéria aparecem nesta lista.</p>
        </div>
        {activities.isLoading || guidedJourneys.isLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Consultando publicações da matéria...</p> : null}
        {activities.isError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível consultar as atividades publicadas pela escola.</p> : null}
        {guidedJourneys.isError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível consultar as jornadas anteriores desta matéria.</p> : null}
        {!activities.isLoading && !activities.isError && summary.publishedActivities.length ? (
          <div className="mt-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Atividades publicadas pela escola ({summary.publishedActivities.length})</h3>
            {activityProgress.isError ? <p role="alert" className="mt-2 text-sm text-red-700">As atividades estão disponíveis, mas o progresso delas não pôde ser consultado.</p> : null}
            {!activityProgress.isError && summary.activityProgress ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Domínio registrado nas habilidades associadas: {summary.activityProgress.masteryPercent}% · {summary.activityProgress.masteredCount} consolidadas.</p> : null}
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
              {summary.publishedActivities.map((activity) => (
                <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="font-semibold text-slate-900 dark:text-white">{activity.title}</p><p className="text-sm text-slate-500">{activity.learning_questions?.length ?? 0} questões</p></div>
                  <Link to="/student/activities" className="text-sm font-semibold text-[#005bbf] hover:underline">Abrir Lista de Exercícios</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!guidedJourneys.isLoading && !guidedJourneys.isError && availableJourneys.length ? (
          <div className="mt-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Jornadas publicadas da matéria ({availableJourneys.length})</h3>
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
              {availableJourneys.map((journey) => (
                <li key={journey.journey_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div><p className="font-semibold text-slate-900 dark:text-white">{journey.title}</p><p className="text-sm text-slate-500">{journey.unit_title} · {journey.question_count} questões</p></div>
                  <span className="shrink-0 text-sm font-semibold text-slate-600 dark:text-slate-300">{formatMastery(journey.progress)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!activities.isLoading && !guidedJourneys.isLoading && !activities.isError && !guidedJourneys.isError && !summary.publishedActivities.length && !availableJourneys.length ? (
          <p role="status" className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">O banco confirmou que ainda não há atividades ou jornadas publicadas especificamente para esta matéria.</p>
        ) : null}
        <Link to="/student/activities" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Ir para Lista de Exercícios</Link>
      </section>
    </div>
  );
}
