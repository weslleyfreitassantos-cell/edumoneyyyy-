import { CheckCircle2, ChevronLeft, Clock3, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useLearningSimulations, useStartLearningSimulation, useSubmitLearningSimulation } from '../../hooks/useLearningCenter';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function SimulationPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const simulations = useLearningSimulations(currentInstitutionId ?? undefined);
  const start = useStartLearningSimulation(currentInstitutionId ?? undefined, profile?.id);
  const submit = useSubmitLearningSimulation(currentInstitutionId ?? undefined, profile?.id);
  const simulation = simulations.data?.[0];
  const questions = useMemo(() => [...(simulation?.learning_simulation_questions ?? [])].sort((left, right) => left.position - right.position), [simulation]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<{ score: number; correct_count: number; total_questions: number } | null>(null);

  if (simulations.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando simulados...</div>;
  if (!simulation || !questions.length) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Ainda não há simulado disponível para sua turma.</section>;

  const question = questions[currentIndex];
  const bankQuestion = one(question.learning_question_bank);
  if (!bankQuestion) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">O simulado está sendo preparado.</section>;
  const answer = answers[bankQuestion.id] ?? '';

  const begin = () => {
    void start.mutateAsync(simulation.id).then((id) => { setAttemptId(id); setStartedAt(Date.now()); });
  };
  const finish = () => {
    if (!attemptId) return;
    void submit.mutateAsync({ attemptId, answers: questions.map((item) => { const bank = one(item.learning_question_bank)!; return { question_bank_id: bank.id, answer: answers[bank.id] ?? '' }; }), durationSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0 }).then((value) => setResult(value));
  };

  if (result) return <section className="mx-auto max-w-xl space-y-5"><div className="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h1 className="mt-4 text-2xl font-bold dark:text-white">Simulado concluído</h1><p className="mt-2 text-slate-500">{result.correct_count} de {result.total_questions} acertos · {result.score}%</p><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">O resultado alimentou suas evidências de aprendizagem. Ele não é uma nota oficial do ENEM.</p></div><Link to="/student/study" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central de Estudos</Link></section>;

  if (!attemptId) return <section className="mx-auto max-w-xl space-y-5"><Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar</Link><div className="rounded-xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Simulado</p><h1 className="mt-2 text-2xl font-bold dark:text-white">{simulation.title}</h1><p className="mt-2 text-sm text-slate-500">{questions.length} questões · {simulation.duration_minutes ?? 20} min</p><button type="button" onClick={begin} disabled={start.isPending} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{start.isPending ? 'Preparando...' : 'Começar simulado'}</button></div></section>;

  return <div className="mx-auto max-w-2xl space-y-5"><Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Simulado</p><h1 className="mt-1 text-2xl font-bold dark:text-white">{simulation.title}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />Questão {currentIndex + 1} de {questions.length}</p></header><div className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-base leading-6 dark:text-slate-200">{bankQuestion.statement}</p><div className="mt-5 space-y-2">{bankQuestion.options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:text-slate-200"><input type="radio" name={bankQuestion.id} value={option} checked={answer === option} onChange={() => setAnswers((current) => ({ ...current, [bankQuestion.id]: option }))} />{option}</label>)}</div></div><div className="flex gap-3">{currentIndex < questions.length - 1 ? <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={!answer} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Próxima</button> : <button type="button" onClick={finish} disabled={submit.isPending || questions.some((item) => !answers[one(item.learning_question_bank)?.id ?? ''])} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Enviando...' : 'Finalizar simulado'}</button>}</div>{submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}</div>;
}
