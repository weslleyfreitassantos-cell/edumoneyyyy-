import { CheckCircle2, ChevronLeft, Clock3, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningSimulationAttempts,
  useLearningSimulations,
  useLearningStudent,
  useSaveLearningSimulationAnswers,
  useStartLearningSimulation,
  useSubmitLearningSimulation,
} from '../../hooks/useLearningCenter';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function SimulationPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const simulations = useLearningSimulations(currentInstitutionId ?? undefined);
  const attempts = useLearningSimulationAttempts(currentInstitutionId ?? undefined, student.data?.id);
  const start = useStartLearningSimulation(currentInstitutionId ?? undefined, student.data?.id);
  const saveAnswers = useSaveLearningSimulationAnswers();
  const submit = useSubmitLearningSimulation(currentInstitutionId ?? undefined, student.data?.id);
  const [selectedSimulationId, setSelectedSimulationId] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<{ score: number; correct_count: number; total_questions: number; area_breakdown?: Record<string, { correct: number; total: number }> } | null>(null);

  const simulation = useMemo(() => {
    const available = simulations.data ?? [];
    return available.find((item) => item.id === selectedSimulationId) ?? available[0];
  }, [selectedSimulationId, simulations.data]);
  const questions = useMemo(() => [...(simulation?.learning_simulation_questions ?? [])].sort((left, right) => left.position - right.position), [simulation]);
  const completedAttempts = useMemo(() => (attempts.data ?? []).filter((item) => item.simulation_id === simulation?.id && item.status === 'COMPLETED'), [attempts.data, simulation?.id]);

  useEffect(() => {
    if (!selectedSimulationId && simulations.data?.[0]) setSelectedSimulationId(simulations.data[0].id);
  }, [selectedSimulationId, simulations.data]);

  useEffect(() => {
    if (!simulation || attemptId || result) return;
    const openAttempt = (attempts.data ?? []).find((item) => item.simulation_id === simulation.id && item.status === 'IN_PROGRESS');
    if (!openAttempt) return;
    setAttemptId(openAttempt.id);
    setStartedAt(new Date(openAttempt.started_at).getTime());
    const restored = Object.fromEntries(Object.entries(openAttempt.answers ?? {}).map(([id, value]) => [id, String(value.answer ?? '')]));
    setAnswers(restored);
  }, [attemptId, attempts.data, result, simulation]);

  const resetForSimulation = (simulationId: string) => {
    setSelectedSimulationId(simulationId);
    setAttemptId(null);
    setStartedAt(null);
    setAnswers({});
    setSaveStatus('idle');
    setCurrentIndex(0);
    setResult(null);
  };

  if (simulations.isLoading || student.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando simulados...</div>;
  if (!simulation || !questions.length) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Ainda não há simulado disponível para sua turma.</section>;

  const question = questions[currentIndex];
  const bankQuestion = one(question.learning_question_bank);
  if (!bankQuestion) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">O simulado está sendo preparado.</section>;
  const answer = answers[bankQuestion.id] ?? '';
  const begin = () => { void start.mutateAsync(simulation.id).then((id) => { setAttemptId(id); setStartedAt(Date.now()); setSaveStatus('idle'); }); };
  const answerQuestion = (value: string) => {
    const nextAnswers = { ...answers, [bankQuestion.id]: value };
    setAnswers(nextAnswers);
    if (!attemptId) return;
    const version = saveVersionRef.current + 1;
    saveVersionRef.current = version;
    const payload = Object.entries(nextAnswers).map(([question_bank_id, answer]) => ({ question_bank_id, answer }));
    setSaveStatus('saving');
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveAnswers.mutateAsync({ attemptId, answers: payload }))
      .then(() => { if (saveVersionRef.current === version) setSaveStatus('saved'); })
      .catch(() => { if (saveVersionRef.current === version) setSaveStatus('error'); });
  };
  const finish = () => { if (!attemptId) return; void submit.mutateAsync({ attemptId, answers: questions.map((item) => { const bank = one(item.learning_question_bank)!; return { question_bank_id: bank.id, answer: answers[bank.id] ?? '' }; }), durationSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0 }).then(setResult); };

  if (result) return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h1 className="mt-4 text-2xl font-bold dark:text-white">Simulado concluído</h1><p className="mt-2 text-slate-500">{result.correct_count} de {result.total_questions} acertos · {result.score}%</p><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">O resultado alimentou suas evidências de aprendizagem. Ele não é uma nota oficial do ENEM.</p></div>
      {result.area_breakdown && Object.keys(result.area_breakdown).length > 0 && <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Leitura do resultado</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{(Object.entries(result.area_breakdown) as Array<[string, { correct: number; total: number }]>).map(([area, value]) => <div key={area} className="rounded-lg border p-3 text-sm dark:border-slate-700"><p className="font-semibold dark:text-white">{area}</p><p className="mt-1 text-slate-500">{value.correct}/{value.total} acertos</p></div>)}</div></section>}
      <Link to="/student/study" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Voltar à Central de Estudos</Link>
    </section>
  );

  if (!attemptId) return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar</Link>
      <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Simulados</p><h1 className="mt-1 text-2xl font-bold dark:text-white">Escolha uma prática</h1><p className="mt-2 text-sm text-slate-500">Simulados TecEscola, por área ou adaptativos ficam separados do resultado oficial.</p></header>
      <div className="grid gap-2 sm:grid-cols-2">{(simulations.data ?? []).map((item) => <button key={item.id} type="button" onClick={() => resetForSimulation(item.id)} className={`rounded-lg border p-4 text-left ${item.id === simulation.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'dark:border-slate-700'}`}><p className="font-semibold dark:text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.simulation_type} · {item.learning_simulation_questions?.length ?? 0} questões</p></button>)}</div>
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-bold dark:text-white">{simulation.title}</h2><p className="mt-2 text-sm text-slate-500">{questions.length} questões · {simulation.duration_minutes ?? 20} min</p><button type="button" onClick={begin} disabled={start.isPending || !student.data} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{start.isPending ? 'Preparando...' : 'Começar simulado'}</button></div>
      {completedAttempts.length > 0 && <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Histórico deste simulado</h2><div className="mt-3 divide-y dark:divide-slate-700">{completedAttempts.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-500">{new Date(item.completed_at ?? item.started_at).toLocaleDateString('pt-BR')}</span><strong className="dark:text-white">{item.correct_count}/{item.total_questions} · {item.score}%</strong></div>)}</div></section>}
    </section>
  );

  return <div className="mx-auto max-w-2xl space-y-5"><Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">{simulation.simulation_type}</p><h1 className="mt-1 text-2xl font-bold dark:text-white">{simulation.title}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />Questão {currentIndex + 1} de {questions.length}</p></header><div className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-base leading-6 dark:text-slate-200">{bankQuestion.statement}</p><div className="mt-5 space-y-2">{bankQuestion.options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:text-slate-200"><input type="radio" name={bankQuestion.id} value={option} checked={answer === option} onChange={() => answerQuestion(option)} />{option}</label>)}</div></div><div className="flex items-center justify-between gap-3"><div className="min-h-5 text-xs text-slate-500" role="status" aria-live="polite">{saveStatus === 'saving' ? 'Salvando resposta...' : saveStatus === 'saved' ? 'Resposta salva.' : saveStatus === 'error' ? 'Não foi possível salvar a resposta.' : ''}</div><div className="flex gap-3">{currentIndex < questions.length - 1 ? <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={!answer} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Próxima</button> : <button type="button" onClick={finish} disabled={submit.isPending || questions.some((item) => !answers[one(item.learning_question_bank)?.id ?? ''])} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Enviando...' : 'Finalizar simulado'}</button>}</div></div>{submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}</div>;
}
