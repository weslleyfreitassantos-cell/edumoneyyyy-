import { CheckCircle2, ChevronLeft, GraduationCap, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useCompleteGuidedLearningStep, usePublishedLearningActivities, useSubmitLearningAttemptWithFeedback } from '../../hooks/useLearningCenter';

interface PracticeResult {
  score: number;
  total_points: number;
  mastery_percent: number;
  feedback: Array<{
    question_id: string;
    is_correct: boolean;
    correct_answer: unknown;
    explanation: string | null;
  }>;
}
function feedbackAnswer(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export default function PracticePage() {
  const { activityId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [searchParams] = useSearchParams();
  const query = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const activity = query.data?.find((item) => item.id === activityId);
  const questions = useMemo(() => [...(activity?.learning_questions ?? [])].sort((a, b) => a.sort_order - b.sort_order), [activity]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [guidedOutcome, setGuidedOutcome] = useState<'completed' | 'retry' | 'support' | null>(null);
  const submit = useSubmitLearningAttemptWithFeedback(currentInstitutionId ?? undefined, profile?.id);
  const completeGuidedStep = useCompleteGuidedLearningStep(currentInstitutionId ?? undefined, profile?.id);
  const guidedStepId = searchParams.get('guidedStep');

  if (query.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando prática...</div>;
  if (!activity) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta atividade não está disponível para você.</div>;
  if (!questions.length) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta prática ainda não possui questões.</div>;

  const question = questions[currentIndex];
  const answer = answers[question.id] ?? '';
  const send = () => {
    void submit.mutateAsync({
      activityId: activity.id,
      answers: questions.map((item) => ({ question_id: item.id, answer: answers[item.id] ?? '' })),
    }).then(async (value) => {
      setResult(value);
      if (guidedStepId) {
        const guidedResult = await completeGuidedStep.mutateAsync({
          stepId: guidedStepId,
          status: 'COMPLETED',
          metadata: { mastery_confirmed: value.mastery_percent >= 80 },
        });
        setGuidedOutcome(guidedResult.needs_teacher_support ? 'support' : guidedResult.retry ? 'retry' : 'completed');
      }
    });
  };

  const retryGuidedStep = () => {
    setResult(null);
    setGuidedOutcome(null);
    setAnswers({});
    setCurrentIndex(0);
  };

  if (result) {
    return (
      <section className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold dark:text-white">Prática concluída</h1>
          <p className="mt-2 text-slate-500">Você acertou {result.score} de {result.total_points} pontos.</p>
          <p className="mt-4 text-sm font-semibold text-[#005bbf]">Domínio atualizado: {result.mastery_percent}%</p>
          {guidedOutcome === 'retry' && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900"><p className="font-bold">O lock-in ainda não foi confirmado.</p><p className="mt-1">Tente novamente para consolidar esta habilidade.</p><button type="button" onClick={retryGuidedStep} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 text-xs font-bold">Tentar lock-in novamente</button></div>}
          {guidedOutcome === 'support' && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-900"><p className="font-bold">Sessão encaminhada para apoio do professor.</p><p className="mt-1">Você pode voltar ao plano enquanto o professor revisa esta habilidade.</p></div>}
        </div>
        <div className="space-y-3">
          {questions.map((item, index) => {
            const itemFeedback = result.feedback.find((feedback) => feedback.question_id === item.id);
            return (
              <article key={item.id} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-bold dark:text-white">Questão {index + 1} · {itemFeedback?.is_correct ? 'Correto' : 'Ainda não'}</p>
                {!itemFeedback?.is_correct && itemFeedback && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Resposta esperada: {feedbackAnswer(itemFeedback.correct_answer)}</p>}
                {itemFeedback?.explanation && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{itemFeedback.explanation}</p>}
              </article>
            );
          })}
        </div>
        <Link to="/student/study" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central de Estudos</Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link>
      <header>
        <div className="flex items-center gap-3"><GraduationCap className="h-7 w-7 text-[#005bbf]" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Prática</p><h1 className="text-2xl font-bold dark:text-white">{activity.title}</h1></div></div>
        <p className="mt-2 text-sm text-slate-500">{activity.description ?? 'Uma questão por vez. O feedback aparece depois do envio.'}</p>
      </header>
      <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>Questão {currentIndex + 1} de {questions.length}</span><span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span></div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-[#005bbf] transition-all" style={{ width: String(((currentIndex + 1) / questions.length) * 100) + '%' }} /></div>
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <legend className="text-sm font-bold dark:text-white">Questão {currentIndex + 1}</legend>
        <p className="mt-3 text-base leading-6 dark:text-slate-200">{question.question_text}</p>
        {question.question_type === 'SHORT_ANSWER' ? <input value={answer} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="mt-5 w-full rounded-lg border px-3 py-3 text-sm dark:bg-slate-900 dark:text-white" placeholder="Digite sua resposta" /> : <div className="mt-5 space-y-2">{(question.options_json.length ? question.options_json : ['Verdadeiro', 'Falso']).map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:border-[#005bbf] dark:border-slate-700 dark:text-slate-200"><input type="radio" name={question.id} value={option} checked={answer === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</div>}
      </fieldset>
      <div className="flex flex-wrap gap-3">
      {currentIndex < questions.length - 1 ? <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={!answer.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Próxima questão</button> : <button type="button" onClick={send} disabled={submit.isPending || questions.some((item) => !answers[item.id]?.trim())} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Enviando...' : 'Enviar prática'}</button>}
      </div>
      {submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}
    </div>
  );
}
