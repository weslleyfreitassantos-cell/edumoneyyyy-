import { CheckCircle2, ChevronLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningErrorReview,
  useLearningStudent,
  useSubmitLearningErrorReview,
} from '../../hooks/useLearningCenter';

function answerLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export default function ErrorReviewPage() {
  const { errorId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const review = useLearningErrorReview(errorId);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const submit = useSubmitLearningErrorReview(currentInstitutionId ?? undefined, student.data?.id);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof submit.mutateAsync>> | null>(null);

  if (review.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando revisão...</div>;
  if (!review.data) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta revisão não está disponível.</section>;

  const question = review.data;
  const send = () => {
    if (!errorId || !answer.trim()) return;
    void submit.mutateAsync({ errorId, answer }).then(setResult);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Caderno de erros</p>
        <h1 className="mt-1 text-2xl font-bold dark:text-white">Revisar questão</h1>
        <p className="mt-2 text-sm text-slate-500">Tente novamente antes de ver a explicação.</p>
      </header>
      <fieldset className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <legend className="text-sm font-bold dark:text-white">Questão</legend>
        <p className="mt-3 text-base leading-6 dark:text-slate-200">{question.statement}</p>
        {question.question_type === 'SHORT_ANSWER' ? (
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-5 w-full rounded-lg border px-3 py-3 text-sm dark:bg-slate-900 dark:text-white" placeholder="Digite sua resposta" />
        ) : (
          <div className="mt-5 space-y-2">
            {(question.options.length ? question.options : ['Verdadeiro', 'Falso']).map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:border-[#005bbf] dark:border-slate-700 dark:text-slate-200">
                <input type="radio" name={question.error_id} value={option} checked={answer === option} onChange={() => setAnswer(option)} />
                {option}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {result ? (
        <section className={`rounded-xl border p-5 ${result.is_correct ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">{result.is_correct ? 'Revisão concluída' : 'Ainda vale revisar'}</h2>
              <p className="mt-2 text-sm">Resposta esperada: {answerLabel(result.correct_answer)}</p>
              {result.explanation && <p className="mt-2 text-sm leading-6">{result.explanation}</p>}
            </div>
          </div>
          {!result.is_correct && <button type="button" onClick={() => { setResult(null); setAnswer(''); }} className="mt-4 rounded-lg border border-amber-700 px-4 py-2 text-sm font-bold">Tentar novamente</button>}
        </section>
      ) : (
        <button type="button" onClick={send} disabled={!answer.trim() || submit.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Send className="h-4 w-4" />{submit.isPending ? 'Enviando...' : 'Enviar resposta'}
        </button>
      )}
      {submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}
    </div>
  );
}
