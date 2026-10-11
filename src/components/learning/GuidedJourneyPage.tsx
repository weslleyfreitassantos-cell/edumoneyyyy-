import { BookOpenCheck, CheckCircle2, ChevronLeft, CircleAlert, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import LessonMarkdown from './LessonMarkdown';
import {
  useAdvanceGuidedLearningSessionV2,
  useGuidedLearningSessionV2,
  useGuidedLearningStepV2,
  useLearningStudent,
  useSubmitGuidedStepV2,
  useStartGuidedLearningSessionV2,
} from '../../hooks/useLearningCenter';

function idempotencyKey(stepId: string): string {
  return `guided-v2:${stepId}`;
}

function draftKey(stepId: string): string {
  return `tec-escola:guided-draft:${stepId}`;
}

function curriculumAreaLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    MATEMATICA: 'Matemática',
    LINGUAGENS: 'Linguagens',
    CIENCIAS_DA_NATUREZA: 'Ciências da Natureza',
    CIENCIAS_HUMANAS: 'Ciências Humanas',
  };
  return labels[value ?? ''] ?? value?.replaceAll('_', ' ') ?? 'Currículo oficial';
}

export default function GuidedJourneyPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetSkillId = searchParams.get('skill') ?? undefined;
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const session = useGuidedLearningSessionV2(currentInstitutionId ?? undefined, student.data?.id, targetSkillId);
  const step = useGuidedLearningStepV2(session.data?.current_step_id ?? undefined);
  const startGuided = useStartGuidedLearningSessionV2(currentInstitutionId ?? undefined, student.data?.id);
  const advance = useAdvanceGuidedLearningSessionV2(currentInstitutionId ?? undefined, student.data?.id);
  const submit = useSubmitGuidedStepV2(currentInstitutionId ?? undefined, student.data?.id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lessonDone, setLessonDone] = useState(false);
  const hydratedStepId = useRef<string | null>(null);
  const recoveryTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const targetId = session.data?.current_step_id ? null : session.data?.target_canonical_skill_id ?? null;
    if (!targetId || session.isLoading || startGuided.isPending || recoveryTargetRef.current === targetId) return;
    recoveryTargetRef.current = targetId;
    void startGuided.mutateAsync(targetId).catch(() => {
      recoveryTargetRef.current = null;
    });
  }, [session.data?.current_step_id, session.data?.target_canonical_skill_id, session.isLoading, startGuided.isPending]);

  useEffect(() => {
    const stepId = step.data?.id;
    if (!stepId) return;
    hydratedStepId.current = stepId;
    try {
      const stored = window.sessionStorage.getItem(draftKey(stepId));
      setAnswers(stored ? JSON.parse(stored) as Record<string, string> : {});
    } catch {
      setAnswers({});
    }
  }, [step.data?.id]);

  useEffect(() => {
    const stepId = step.data?.id;
    if (!stepId || hydratedStepId.current !== stepId || submitted) return;
    try {
      if (Object.keys(answers).length === 0) window.sessionStorage.removeItem(draftKey(stepId));
      else window.sessionStorage.setItem(draftKey(stepId), JSON.stringify(answers));
    } catch {
      // Draft persistence is a convenience; server progress remains authoritative.
    }
  }, [answers, step.data?.id, submitted]);

  const questions = useMemo(
    () => [...(step.data?.questions ?? [])].sort((left, right) => left.position - right.position),
    [step.data?.questions],
  );
  const demoPreview = session.data?.metadata?.demo_preview === true;
  const allAnswered = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]?.trim()));
  const stepPurpose = step.data?.purpose;
  const stepHeading = step.data?.step_type === 'LESSON'
    ? step.data.lesson?.title ?? 'Aprender'
    : step.data?.step_type === 'PROBE'
      ? 'Vamos descobrir seu ponto de partida'
      : step.data?.step_type === 'RETURN_TO_TARGET'
        ? 'Voltar ao objetivo'
        : stepPurpose === 'TRANSFER'
          ? 'Vamos praticar esta habilidade: aplicar em um novo contexto'
          : stepPurpose === 'LOCK_IN'
            ? 'Vamos praticar esta habilidade: verificar o que ficou consolidado'
            : stepPurpose === 'REVIEW'
              ? 'Vamos praticar esta habilidade: revisar e reter'
        : 'Vamos praticar esta habilidade';
  const stepTypeLabel = step.data?.step_type === 'LESSON'
    ? 'Leitura guiada'
    : step.data?.step_type === 'PROBE'
      ? 'Diagnóstico inicial'
      : stepPurpose === 'PRACTICE'
        ? 'Prática orientada'
        : stepPurpose === 'TRANSFER'
          ? 'Aplicação em novo contexto'
          : stepPurpose === 'LOCK_IN'
            ? 'Verificação de domínio'
            : stepPurpose === 'REVIEW'
              ? 'Revisão e retenção'
              : 'Prática';

  if (submitted && submit.data) {
    const sessionCompleted = submit.data.session_status === 'COMPLETED' && session.data?.metadata?.adaptive_policy_version === 'V8';
    return <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <CheckCircle2 className="h-6 w-6" />
        <h2 className="mt-2 font-bold">{sessionCompleted ? 'Jornada concluída' : 'Evidência registrada'}</h2>
        <p className="mt-1 text-sm">{sessionCompleted ? 'O servidor corrigiu suas respostas e registrou esta jornada.' : 'O servidor corrigiu suas respostas e atualizou o próximo passo.'}</p>
        <p className="mt-4 text-sm font-bold">Resultado: {submit.data.score}% ({submit.data.correct_count}/{submit.data.total_questions})</p>
        <ul className="mt-3 space-y-2 text-sm">
          {submit.data.feedback.map((item) => <li key={item.question_bank_id} className="rounded-lg border border-emerald-200 bg-white/70 p-3"><strong>{item.is_correct ? 'Acerto' : 'Revisar'}</strong>{!item.is_correct && item.correct_answer != null && <span> · resposta correta: {String(item.correct_answer)}</span>}{item.explanation && <p className="mt-1">{item.explanation}</p>}{!item.is_correct && item.remediation_hint && <p className="mt-2 font-semibold text-amber-900">Orientação: {item.remediation_hint}</p>}</li>)}
        </ul>
        {sessionCompleted ? <Link to="/student/study" className="mt-4 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central</Link> : <button type="button" onClick={() => { window.sessionStorage.removeItem(draftKey(step.data?.id ?? '')); setSubmitted(false); setAnswers({}); setLessonDone(false); }} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Continuar jornada</button>}
      </div>
    </div>;
  }

  if (session.isLoading || step.isLoading) {
    return <div className="grid min-h-56 place-items-center text-sm text-slate-500">Carregando sua jornada...</div>;
  }
  if (session.isError || step.isError) {
    return <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"><CircleAlert className="h-6 w-6" /><h1 className="mt-3 text-lg font-bold">Não foi possível carregar a jornada</h1><p className="mt-2">Tente novamente. Seu progresso salvo no servidor permanece protegido.</p><button type="button" onClick={() => { void session.refetch(); if (step.isError) void step.refetch(); }} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 font-bold text-white">Tentar novamente</button></section>;
  }
  if (!session.data) {
    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Nenhuma jornada guiada está ativa. Volte à Central de Estudos para começar.</section>;
  }
  if (!session.data.current_step_id) {
    return <section role={startGuided.isError ? 'alert' : undefined} className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950"><h1 className="text-lg font-bold">{startGuided.isError ? 'Não foi possível retomar a jornada' : 'Retomando sua jornada...'}</h1><p className="mt-2">{startGuided.isError ? 'Tente novamente para abrir a etapa salva.' : 'Estamos recuperando a próxima etapa sem perder seu progresso.'}</p>{startGuided.isError ? <button type="button" onClick={() => { recoveryTargetRef.current = null; void startGuided.mutateAsync(session.data!.target_canonical_skill_id); }} className="mt-4 rounded-lg bg-[#005bbf] px-4 py-2 font-bold text-white">Tentar novamente</button> : null}</section>;
  }
  if (session.data.status === 'NEEDS_TEACHER_SUPPORT') {
    return <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><CircleAlert className="h-6 w-6" /><h1 className="mt-3 text-xl font-bold">Vamos pedir apoio ao professor</h1><p className="mt-2 text-sm">A evidência ainda não confirmou esta habilidade depois de duas tentativas de replanejamento. O professor verá o contexto sem que você precise repetir a mesma etapa.</p><Link to="/student/study" className="mt-5 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central</Link></section>;
  }
  if (!step.data) {
    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">A próxima etapa ainda não está disponível. Tente atualizar a jornada.</section>;
  }

  const finishLesson = () => {
    if (!session.data || !step.data || lessonDone) return;
    void advance.mutateAsync({
      sessionId: session.data.id,
      stepId: step.data.id,
      action: 'LESSON_COMPLETED',
      idempotencyKey: idempotencyKey(step.data.id),
    }).then(() => setLessonDone(true)).catch(() => undefined);
  };
  const submitAnswers = () => {
    if (!step.data || !allAnswered || submitted) return;
    void submit.mutateAsync({
      stepId: step.data.id,
      answers: questions.map((question) => ({ question_bank_id: question.id, answer: answers[question.id] })),
      idempotencyKey: idempotencyKey(step.data.id),
    }).then(() => {
      window.sessionStorage.removeItem(draftKey(step.data!.id));
      setSubmitted(true);
    }).catch(() => undefined);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link>
      <header className="rounded-2xl border border-blue-900/20 bg-[#073b78] p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Sua jornada</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-100"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />{stepTypeLabel}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{stepHeading}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">Etapa {step.data.position + 1}</span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100">{session.data.decision_reason === 'CONFIRMED_GAP' ? 'Encontramos um ponto para reforçar. A próxima evidência vai orientar o caminho.' : 'Uma etapa por vez. Sua resposta define a próxima recomendação.'}</p>
        {demoPreview ? <p className="mt-4 rounded-lg border border-amber-200/40 bg-amber-100/15 px-3 py-2 text-xs font-bold text-amber-100">Prévia demonstrativa · revisão pedagógica pendente</p> : null}
        {step.data?.curriculum?.official_code ? (
          <div className="mt-5 rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-blue-50">
            <p className="font-bold">BNCC · {step.data.curriculum.official_code}</p>
            <p className="mt-1 text-blue-100">{curriculumAreaLabel(step.data.curriculum.subject_area)} · Ensino Médio</p>
            {step.data.curriculum.recommended_grade ? <p className="mt-1 text-xs text-blue-200">Sequência TecEscola: {step.data.curriculum.recommended_grade}º ano · a habilidade oficial abrange {step.data.curriculum.official_grade_range ?? '1º ao 3º ano'}.</p> : null}
            {step.data.curriculum.official_source_page ? <p className="mt-2 text-xs font-semibold text-blue-200">Fonte oficial da BNCC · p. {step.data.curriculum.official_source_page}</p> : null}
          </div>
        ) : null}
      </header>

      {step.data.step_type === 'LESSON' ? (
        <article className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
          <LessonMarkdown content={step.data.lesson?.content_markdown} fallback={step.data.lesson?.summary} />
          {step.data.lesson?.worked_example && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100"><strong>Exemplo guiado</strong><br />{step.data.lesson.worked_example}</div>}
          <button type="button" onClick={finishLesson} disabled={advance.isPending || lessonDone} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{advance.isPending ? 'Salvando...' : lessonDone ? 'Etapa registrada' : 'Continuar para a prática'}</button>
          {advance.isError && <p role="alert" className="text-sm text-red-600">{advance.error.message}</p>}
        </article>
      ) : step.data.step_type === 'RETURN_TO_TARGET' ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><h2 className="mt-3 text-xl font-bold text-emerald-950 dark:text-emerald-100">Você fortaleceu a base</h2><p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">Agora vamos voltar ao objetivo original e conferir o que ficou consolidado.</p><button type="button" onClick={() => void advance.mutateAsync({ sessionId: session.data!.id, stepId: step.data!.id, action: 'TARGET_RETURNED', idempotencyKey: idempotencyKey(step.data!.id) })} disabled={advance.isPending} className="mt-5 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Voltar ao objetivo</button>{advance.isError && <p role="alert" className="mt-3 text-sm text-red-600">{advance.error.message}</p>}</article>
      ) : (
        <section className="space-y-5">
          {questions.map((question, index) => (
            <fieldset key={question.id} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
              <legend className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200">Questão {index + 1} de {questions.length}</legend>
              <p className="mt-4 text-lg font-semibold leading-7 text-slate-900 dark:text-slate-100">{question.statement}</p>
              <div className="mt-6 grid gap-3">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option;
                  return <label key={option} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 text-base transition hover:border-[#005bbf] focus-within:ring-2 focus-within:ring-blue-200 dark:border-slate-700 dark:text-slate-200 ${selected ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'bg-white dark:bg-slate-900'}`}><input className="h-4 w-4 accent-[#005bbf]" type="radio" name={question.id} value={option} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>;
                })}
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={submitAnswers} disabled={!allAnswered || submit.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Corrigindo...' : 'Enviar respostas'}</button>
          {submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}
        </section>
      )}
      <p className="text-center text-xs text-slate-500">Sua resposta fica protegida até o envio. O gabarito aparece somente depois da correção.</p>
      <button type="button" onClick={() => navigate('/student/study')} className="text-sm font-bold text-[#005bbf]">Voltar sem perder o progresso</button>
    </div>
  );
}
