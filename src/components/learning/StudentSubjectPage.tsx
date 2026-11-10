import { ArrowLeft, CircleAlert, Play } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useGuidedStudyOverviewV11, useStartGuidedStudyV11, useStudentLearningSubjects } from '../../hooks/useLearningCenter';

function getStudentAvailabilityMessage(state: string, reason?: string, subjectName?: string) {
  switch (state) {
    case 'NO_BNCC_MAPPING':
    case 'NO_ELIGIBLE_CONTENT':
      return `Ainda não há uma etapa de estudo guiado disponível para ${subjectName ?? 'esta matéria'} nesta série. Seu progresso anterior continua salvo.`;
    case 'NO_ACTIVE_ENROLLMENT':
      return 'Não encontramos uma matrícula ativa para identificar sua série. Procure a secretaria da escola.';
    case 'AMBIGUOUS_ENROLLMENT':
      return 'Encontramos mais de uma matrícula ativa. Peça à secretaria para confirmar sua turma.';
    case 'GRADE_NOT_SUPPORTED':
      return 'Não foi possível identificar sua série para preparar o estudo guiado. Seu progresso continua salvo.';
    case 'NO_STUDENT_PROFILE':
      return 'Seu perfil de estudante ainda não está vinculado a esta instituição. Procure a secretaria.';
    case 'AMBIGUOUS_STUDENT':
      return 'Há mais de um perfil de estudante vinculado à sua conta. Peça à secretaria para revisar o cadastro.';
    case 'NEEDS_TEACHER_SUPPORT':
      return 'Sua jornada precisa de acompanhamento do professor antes de continuar.';
    case 'CONTENT_EXHAUSTED':
      return 'Você concluiu as etapas disponíveis desta matéria. Novas etapas serão liberadas quando estiverem prontas.';
    default:
      return reason && !/BNCC|EM\d{2}|TECESCOLA_CORE|version|publication|technical/i.test(reason)
        ? reason
        : 'Ainda não há uma etapa guiada disponível para esta matéria e série.';
  }
}

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const selectedSubject = subjects.data?.find((subject) => subject.id === subjectId);
  const isEnglish = selectedSubject?.code?.trim().toUpperCase() === 'ING'
    || selectedSubject?.name.toLocaleLowerCase('pt-BR').includes('inglês');
  const overview = useGuidedStudyOverviewV11(currentInstitutionId ?? undefined, profile?.id, subjectId);
  const startStudy = useStartGuidedStudyV11(currentInstitutionId ?? undefined, profile?.id, subjectId);
  const canStart = overview.data?.state === 'READY' || overview.data?.state === 'ACTIVE';

  async function openJourney() {
    if (!canStart || !subjectId) return;
    try {
      const result = await startStudy.mutateAsync();
      if (result.state === 'ACTIVE' && result.session_id) {
        const query = new URLSearchParams({ session: result.session_id, subject: subjectId });
        navigate(`/student/study/guided?${query.toString()}`);
      }
    } catch {
      // Keep the page state available so the student can retry without losing context.
    }
  }

  if (subjects.isLoading) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  }

  if (subjects.isError || !selectedSubject || !subjectId) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Voltar às matérias</Link>
        <p role={subjects.isError ? 'alert' : 'status'} className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {subjects.isError ? 'Não foi possível carregar suas matérias.' : 'Esta matéria não está disponível para sua matrícula.'}
        </p>
      </section>
    );
  }

  const otherSessionHref = overview.data?.session_id
    ? `/student/study/guided?${new URLSearchParams({
      session: overview.data.session_id,
      ...(overview.data.session_subject_id ? { subject: overview.data.session_subject_id } : {}),
    }).toString()}`
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Voltar às matérias</Link>

      <section aria-label={`Estudo de ${selectedSubject.name}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#005bbf]">Estudo Guiado</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{selectedSubject.name}</h1>
        {overview.data?.grade_label ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{overview.data.grade_label}</p> : null}

        {isEnglish ? (
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-300">Seu curso de idiomas continua disponível separadamente.</p>
            <Link to="/student/study/english" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Abrir Tec Idiomas</Link>
          </div>
        ) : null}

        {!isEnglish && overview.isLoading ? <p role="status" className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-500 dark:border-slate-700">Preparando sua jornada...</p> : null}
        {!isEnglish && overview.isError ? (
          <p role="alert" className="mt-6 flex items-start gap-2 border-t border-slate-200 pt-5 text-sm text-red-700 dark:border-slate-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Não foi possível consultar sua jornada agora. Seu progresso permanece salvo; tente novamente.
          </p>
        ) : null}

        {!isEnglish && overview.data?.topic_title ? (
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assunto atual</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{overview.data.topic_title}</h2>
          </div>
        ) : null}

        {!isEnglish && overview.data?.state === 'ACTIVE_SESSION_OTHER_SUBJECT' ? (
          <div role="status" className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="text-sm text-slate-700 dark:text-slate-200">{overview.data.reason}</p>
            {otherSessionHref ? <Link to={otherSessionHref} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004d9f]">Retomar jornada salva</Link> : null}
          </div>
        ) : null}

        {!isEnglish && overview.data && !['READY', 'ACTIVE', 'ACTIVE_SESSION_OTHER_SUBJECT'].includes(overview.data.state) ? (
          <p role="status" className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {getStudentAvailabilityMessage(overview.data.state, overview.data.reason, selectedSubject.name)}
          </p>
        ) : null}

        {!isEnglish && canStart ? (
          <button type="button" onClick={() => void openJourney()} disabled={startStudy.isPending} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#004d9f] disabled:cursor-wait disabled:opacity-60">
            <Play className="h-4 w-4" aria-hidden="true" />
            {startStudy.isPending ? 'Preparando...' : overview.data?.state === 'ACTIVE' ? 'Continuar estudo' : 'Começar estudo guiado'}
          </button>
        ) : null}
        {!isEnglish && startStudy.isError ? <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível iniciar sua jornada. Tente novamente.</p> : null}
      </section>
    </div>
  );
}
