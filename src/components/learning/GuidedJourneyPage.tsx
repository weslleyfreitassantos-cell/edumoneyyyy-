import { BookOpenCheck, CheckCircle2, ChevronLeft, CircleAlert, Pause, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useAdvanceGuidedLearningSessionV2,
  useGuidedLearningSessionByIdV11,
  useGuidedLearningStepV2,
  useGuidedStudyOverviewV11,
  useLearningStudent,
  usePauseGuidedStudyV11,
  useRecordGuidedHintV5,
  useStartGuidedStudyV11,
  useSubmitGuidedStepV2,
} from '../../hooks/useLearningCenter';
import type { GuidedQuestionV2 } from '../../services/learningCenterService';
import LessonMarkdown from './LessonMarkdown';

function idempotencyKey(stepId: string): string {
  return `guided-v2:${stepId}`;
}

function draftKey(stepId: string): string {
  return `tec-escola:guided-draft:${stepId}`;
}

function normalizeAnswerOption(option: GuidedQuestionV2['options'][number], index: number) {
  if (typeof option === 'string') return { value: option, text: option };

  const fallback = String.fromCharCode('A'.charCodeAt(0) + index);
  const value = option.value ?? option.id ?? option.label ?? option.text ?? fallback;
  const text = option.text ?? option.label ?? option.value ?? option.id ?? fallback;
  return { value: String(value), text: String(text) };
}

export default function GuidedJourneyPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintsByQuestion, setHintsByQuestion] = useState<Record<string, string>>({});
  const [hintLoadingQuestionId, setHintLoadingQuestionId] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [lessonDone, setLessonDone] = useState(false);
  const hydratedStepId = useRef<string | null>(null);
  const subjectId = searchParams.get('subject') ?? undefined;
  const subjectHref = subjectId ? `/student/study/subject/${encodeURIComponent(subjectId)}` : '/student/study';
  const continueLabel = subjectId ? 'Continuar nesta matéria' : 'Continuar jornada';
  const overview = useGuidedStudyOverviewV11(currentInstitutionId ?? undefined, profile?.id, subjectId);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const requestedSessionId = searchParams.get('session');
  const hasLegacySelection = searchParams.has('journey') || searchParams.has('skill');
  const sessionId = requestedSessionId ?? overview.data?.session_id ?? undefined;
  const session = useGuidedLearningSessionByIdV11(currentInstitutionId ?? undefined, student.data?.id, sessionId);
  const step = useGuidedLearningStepV2(session.data?.current_step_id ?? undefined);
  const startGuidedStudy = useStartGuidedStudyV11(currentInstitutionId ?? undefined, profile?.id, subjectId);
  const pauseGuidedStudy = usePauseGuidedStudyV11(currentInstitutionId ?? undefined, profile?.id);
  const advance = useAdvanceGuidedLearningSessionV2(currentInstitutionId ?? undefined, student.data?.id, profile?.id);
  const submit = useSubmitGuidedStepV2(currentInstitutionId ?? undefined, student.data?.id, profile?.id);
  const recordHint = useRecordGuidedHintV5();

  useEffect(() => {
    if (hasLegacySelection) navigate('/student/study', { replace: true });
  }, [hasLegacySelection, navigate]);

  useEffect(() => {
    if (!requestedSessionId || student.isLoading || session.isLoading || session.isError) return;
    if (session.data?.id !== requestedSessionId) navigate('/student/study', { replace: true });
  }, [navigate, requestedSessionId, session.data?.id, session.isError, session.isLoading, student.isLoading]);

  useEffect(() => {
    const stepId = step.data?.id;
    if (!stepId || hydratedStepId.current === stepId) return;
    hydratedStepId.current = stepId;
    try {
      const stored = window.sessionStorage.getItem(draftKey(stepId));
      const draft = stored ? JSON.parse(stored) as Record<string, unknown> : {};
      setAnswers(draft.answers && typeof draft.answers === 'object' ? draft.answers as Record<string, string> : {});
    } catch {
      setAnswers({});
    }
    setQuestionIndex(0);
    setHintsByQuestion({});
    setHintError(null);
    setHintLoadingQuestionId(null);
    setSubmitted(false);
    setLessonDone(false);
  }, [step.data?.id]);

  useEffect(() => {
    const stepId = step.data?.id;
    if (!stepId || hydratedStepId.current !== stepId || submitted) return;
    try {
      if (Object.keys(answers).length === 0) window.sessionStorage.removeItem(draftKey(stepId));
      else window.sessionStorage.setItem(draftKey(stepId), JSON.stringify({ answers }));
    } catch {
      // Server progress is authoritative; this only keeps unsubmitted drafts convenient.
    }
  }, [answers, step.data?.id, submitted]);

  const questions = useMemo(
    () => [...(step.data?.questions ?? [])].sort((left, right) => left.position - right.position),
    [step.data?.questions],
  );
  const currentQuestion = questions[questionIndex];
  const answerOptions = currentQuestion?.options.map(normalizeAnswerOption) ?? [];
  const allAnswered = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]?.trim()));
  const stepPurpose = step.data?.purpose;
  const stepHeading = step.data?.step_type === 'LESSON'
    ? step.data.lesson?.title ?? 'Aprender'
    : step.data?.step_type === 'PROBE'
      ? 'Vamos descobrir seu ponto de partida'
      : step.data?.step_type === 'RETURN_TO_TARGET'
        ? 'Retomar o objetivo'
        : stepPurpose === 'TRANSFER'
          ? 'Aplicar em um novo contexto'
          : stepPurpose === 'LOCK_IN'
            ? 'Verificar o que ficou consolidado'
            : stepPurpose === 'REVIEW'
              ? 'Revisar e reter'
              : 'Vamos praticar esta habilidade';
  const stepTypeLabel = step.data?.step_type === 'LESSON'
    ? 'Leitura guiada'
    : step.data?.step_type === 'PROBE'
      ? 'Diagnóstico inicial'
      : stepPurpose === 'TRANSFER'
        ? 'Aplicação em novo contexto'
        : stepPurpose === 'LOCK_IN'
          ? 'Verificação de domínio'
          : stepPurpose === 'REVIEW'
            ? 'Revisão e retenção'
            : 'Prática orientada';

  async function handlePause() {
    if (!session.data?.id) return;
    try {
      await pauseGuidedStudy.mutateAsync(session.data.id);
      navigate(subjectHref);
    } catch {
      // Keep the student on the current step so the pause can be retried.
    }
  }

  async function handleContinueGlobally() {
    try {
      const result = await startGuidedStudy.mutateAsync();
      if (result.state === 'ACTIVE' && result.session_id) {
        const params = new URLSearchParams({ session: result.session_id });
        if (subjectId) params.set('subject', subjectId);
        navigate(`/student/study/guided?${params.toString()}`, { replace: true });
      } else {
        navigate(subjectHref, { replace: true });
      }
    } catch {
      navigate(subjectHref, { replace: true });
    }
  }

  async function revealHint(questionId: string) {
    const stepId = step.data?.id;
    if (!stepId || hintsByQuestion[questionId] || hintLoadingQuestionId) return;
    setHintError(null);
    setHintLoadingQuestionId(questionId);
    try {
      const result = await recordHint.mutateAsync({ stepId, questionId });
      if (!result.recorded || !result.hint.trim()) throw new Error('A dica não está disponível para esta questão.');
      setHintsByQuestion((current) => ({ ...current, [questionId]: result.hint }));
    } catch (error) {
      setHintError(error instanceof Error ? error.message : 'Não foi possível carregar a dica.');
    } finally {
      setHintLoadingQuestionId(null);
    }
  }

  function finishLesson() {
    if (!session.data || !step.data || lessonDone) return;
    void advance.mutateAsync({
      sessionId: session.data.id,
      stepId: step.data.id,
      action: 'LESSON_COMPLETED',
      idempotencyKey: idempotencyKey(step.data.id),
    }).then(() => setLessonDone(true)).catch(() => undefined);
  }

  function submitAnswers() {
    if (!step.data || !allAnswered || submitted) return;
    void submit.mutateAsync({
      stepId: step.data.id,
      answers: questions.map((question) => ({ question_bank_id: question.id, answer: answers[question.id] })),
      idempotencyKey: idempotencyKey(step.data.id),
    }).then(() => {
      window.sessionStorage.removeItem(draftKey(step.data!.id));
      setSubmitted(true);
    }).catch(() => undefined);
  }

  if (hasLegacySelection) return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Voltando à Central de Estudos...</div>;
  if ((!requestedSessionId && overview.isLoading) || student.isLoading || (sessionId && session.isLoading)) {
    return <div role="status" className="grid min-h-56 place-items-center text-sm text-slate-500">Retomando seu estudo...</div>;
  }
  if ((!requestedSessionId && overview.isError) || student.isError || session.isError) {
    return <section role="alert" className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"><CircleAlert className="h-6 w-6" /><h1 className="mt-3 text-lg font-bold">Não foi possível recuperar seu estudo</h1><p className="mt-2">Seu progresso no servidor está preservado. Volte à Central e tente novamente.</p><Link to="/student/study" className="mt-4 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 font-bold text-white">Voltar à Central</Link></section>;
  }
  if (requestedSessionId && session.data?.id !== requestedSessionId) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Validando a sessão...</div>;
  }
  if (!session.data) {
    return <section className="mx-auto max-w-2xl rounded-xl border border-blue-200 bg-blue-50 p-6 text-blue-950"><h1 className="text-xl font-bold">Seu próximo passo está na Central</h1><p className="mt-2 text-sm">A escolha da habilidade é feita automaticamente com base na matrícula, no conteúdo publicado e no seu progresso.</p><Link to="/student/study" className="mt-5 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Ir para a Central de Estudos</Link></section>;
  }
  if (session.data.status === 'NEEDS_TEACHER_SUPPORT') {
    return <section role="status" className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><CircleAlert className="h-6 w-6" /><h1 className="mt-3 text-xl font-bold">Vamos pedir apoio ao professor</h1><p className="mt-2 text-sm">Seu progresso está salvo. As evidências indicam que é importante revisar os pré-requisitos com o professor antes de avançar.</p><Link to="/student/study" className="mt-5 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central</Link></section>;
  }
  if (session.data.status === 'PAUSED') {
    return <section role="status" className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-bold">Estudo pausado</h1><p className="mt-2 text-sm">Sua etapa e suas respostas já processadas continuam salvas.</p><button type="button" disabled={startGuidedStudy.isPending} onClick={() => void handleContinueGlobally()} className="mt-5 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{startGuidedStudy.isPending ? 'Retomando...' : continueLabel}</button></section>;
  }
  if (submitted && submit.data) {
    const sessionCompleted = submit.data.session_status === 'COMPLETED';
    return <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <CheckCircle2 className="h-6 w-6" />
        <h2 className="mt-2 font-bold">{sessionCompleted ? 'Habilidade concluída' : 'Resposta corrigida'}</h2>
        <p className="mt-1 text-sm">{sessionCompleted ? 'O sistema registrou as evidências e está pronto para escolher automaticamente a próxima habilidade.' : 'Sua resposta foi registrada. O motor adaptativo definiu a próxima etapa.'}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {submit.data.feedback.map((item) => <li key={item.question_bank_id} className="rounded-lg border border-emerald-200 bg-white/70 p-3"><strong>{item.is_correct ? 'Acerto' : 'Revisar'}</strong>{!item.is_correct && item.correct_answer != null && <span> · resposta correta: {String(item.correct_answer)}</span>}{item.explanation && <p className="mt-1">{item.explanation}</p>}{!item.is_correct && item.remediation_hint && <p className="mt-2 font-semibold text-amber-900">Orientação: {item.remediation_hint}</p>}</li>)}
        </ul>
        {sessionCompleted ? <button type="button" disabled={startGuidedStudy.isPending} onClick={() => void handleContinueGlobally()} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{startGuidedStudy.isPending ? 'Preparando...' : continueLabel}</button> : <button type="button" onClick={() => { window.sessionStorage.removeItem(draftKey(step.data?.id ?? '')); setSubmitted(false); setAnswers({}); }} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Próxima etapa</button>}
      </div>
    </div>;
  }
  if (!session.data.current_step_id) {
    return <section role="status" className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-bold">Etapa indisponível</h1><p className="mt-2 text-sm">Seu progresso permanece salvo. O sistema verificará novamente o próximo passo elegível.</p><button type="button" disabled={startGuidedStudy.isPending} onClick={() => void handleContinueGlobally()} className="mt-5 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Tentar continuar</button></section>;
  }
  if (step.isLoading) return <div role="status" className="grid min-h-56 place-items-center text-sm text-slate-500">Carregando a próxima etapa...</div>;
  if (step.isError) return <section role="alert" className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"><h1 className="font-bold">Não foi possível carregar esta etapa</h1><p className="mt-2">Seu progresso está salvo no servidor.</p><button type="button" onClick={() => void step.refetch()} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 font-bold text-white">Tentar novamente</button></section>;
  if (!step.data) return <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Esta etapa ainda não está disponível. Seu progresso foi preservado.</section>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={subjectHref} className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />{overview.data?.subject_name ?? 'Central de Estudos'}</Link>
      <header className="rounded-2xl border border-blue-900/20 bg-[#073b78] p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">{overview.data?.subject_name ?? 'Estudo Guiado'}{overview.data?.grade_label ? ` · ${overview.data.grade_label}` : ''}</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-100"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />{stepTypeLabel}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{overview.data?.topic_title ?? stepHeading}</h1>
          </div>
          <button type="button" disabled={pauseGuidedStudy.isPending} onClick={() => void handlePause()} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/50 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"><Pause className="h-4 w-4" />{pauseGuidedStudy.isPending ? 'Pausando...' : 'Pausar'}</button>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100">{session.data.decision_reason === 'CONFIRMED_GAP' ? 'Encontramos um ponto para reforçar. A próxima evidência vai orientar o caminho.' : 'Uma etapa por vez. Sua resposta ajuda o sistema a escolher o próximo passo.'}</p>
      </header>
      {pauseGuidedStudy.isError ? <p role="alert" className="text-sm text-red-600">Não foi possível pausar agora. Sua etapa continua aberta e salva.</p> : null}

      {step.data.step_type === 'LESSON' ? (
        <article className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
          <LessonMarkdown content={step.data.lesson?.content_markdown} fallback={step.data.lesson?.summary} />
          {step.data.lesson?.worked_example ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><strong>Exemplo guiado</strong><br />{step.data.lesson.worked_example}</div> : null}
          <button type="button" onClick={finishLesson} disabled={advance.isPending || lessonDone} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{advance.isPending ? 'Salvando...' : lessonDone ? 'Etapa registrada' : 'Continuar para a prática'}</button>
          {advance.isError ? <p role="alert" className="text-sm text-red-600">{advance.error.message}</p> : null}
        </article>
      ) : step.data.step_type === 'RETURN_TO_TARGET' ? (
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm"><CheckCircle2 className="h-8 w-8 text-amber-600" /><h2 className="mt-3 text-xl font-bold text-amber-950">Retomar o objetivo original</h2><p className="mt-2 text-sm text-amber-900">Ainda não há evidências suficientes para comprovar o domínio dos pré-requisitos. Vamos continuar sem marcar essas habilidades como dominadas.</p><button type="button" onClick={() => void advance.mutateAsync({ sessionId: session.data.id, stepId: step.data.id, action: 'TARGET_RETURNED', idempotencyKey: idempotencyKey(step.data.id) })} disabled={advance.isPending} className="mt-5 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Voltar ao objetivo</button>{advance.isError ? <p role="alert" className="mt-3 text-sm text-red-600">{advance.error.message}</p> : null}</article>
      ) : (
        <section className="space-y-5">
          {currentQuestion ? <fieldset key={currentQuestion.id} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <legend className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#005bbf]">Questão {questionIndex + 1} de {questions.length}</legend>
            <p className="mt-4 text-lg font-semibold leading-7 text-slate-900 dark:text-slate-100">{currentQuestion.statement}</p>
            {currentQuestion.has_hint ? <div className="mt-4">{hintsByQuestion[currentQuestion.id] ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">Dica: {hintsByQuestion[currentQuestion.id]}</p> : <button type="button" onClick={() => void revealHint(currentQuestion.id)} disabled={hintLoadingQuestionId !== null} className="min-h-10 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60">{hintLoadingQuestionId === currentQuestion.id ? 'Carregando dica...' : 'Ver dica'}</button>}{hintError ? <p role="alert" className="mt-2 text-sm text-red-600">{hintError}</p> : null}</div> : null}
            <div className="mt-6 grid gap-3">{answerOptions.map((option, index) => { const selected = answers[currentQuestion.id] === option.value; return <label key={`${option.value}-${index}`} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 text-base transition hover:border-[#005bbf] focus-within:ring-2 focus-within:ring-blue-200 dark:border-slate-700 dark:text-slate-200 ${selected ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'bg-white dark:bg-slate-900'}`}><input className="h-4 w-4 accent-[#005bbf]" type="radio" name={currentQuestion.id} value={option.value} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: option.value }))} />{option.text}</label>; })}</div>
          </fieldset> : <p role="status" className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Esta etapa ainda não tem questões disponíveis.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))} disabled={questionIndex === 0} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Questão anterior</button>
            {questionIndex < questions.length - 1 ? <button type="button" onClick={() => setQuestionIndex((current) => current + 1)} disabled={!currentQuestion || !answers[currentQuestion.id]?.trim()} className="min-h-11 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Próxima questão</button> : <button type="button" onClick={submitAnswers} disabled={!allAnswered || submit.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Corrigindo...' : 'Enviar respostas'}</button>}
          </div>
          {submit.isError ? <p role="alert" className="text-sm text-red-600">{submit.error.message}</p> : null}
        </section>
      )}
      <p className="text-center text-xs text-slate-500">Suas respostas processadas ficam salvas no servidor. O gabarito aparece somente depois da correção.</p>
      <button type="button" onClick={() => void handlePause()} className="text-sm font-bold text-[#005bbf]">Pausar e voltar à Central</button>
    </div>
  );
}
