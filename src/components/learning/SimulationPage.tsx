import { CheckCircle2, ChevronLeft, Circle, Clock3, Flag, ListChecks, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningSimulationAttempts,
  useLearningSimulations,
  useLearningStudent,
  useSaveLearningSimulationAnswers,
  useSaveLearningSimulationNavigation,
  useStartLearningSimulation,
  useSubmitLearningSimulation,
} from '../../hooks/useLearningCenter';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function answerMapFromAttempt(answers: Record<string, { answer: unknown }> | undefined) {
  return Object.fromEntries(Object.entries(answers ?? {}).map(([id, value]) => [id, String(value.answer ?? '')]));
}

type SimulationResult = {
  score: number;
  correct_count: number;
  total_questions: number;
  area_breakdown?: Record<string, { correct: number; total: number }>;
  skill_breakdown?: Record<string, { correct: number; total: number }>;
  answered_count: number;
  duration_seconds: number;
};

export default function SimulationPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const simulations = useLearningSimulations(currentInstitutionId ?? undefined);
  const attempts = useLearningSimulationAttempts(currentInstitutionId ?? undefined, student.data?.id);
  const start = useStartLearningSimulation(currentInstitutionId ?? undefined, student.data?.id);
  const saveAnswers = useSaveLearningSimulationAnswers();
  const saveNavigation = useSaveLearningSimulationNavigation();
  const submit = useSubmitLearningSimulation(currentInstitutionId ?? undefined, student.data?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSimulationId, setSelectedSimulationId] = useState(() => searchParams.get('simulation') ?? '');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [navigationStatus, setNavigationStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const simulation = useMemo(() => {
    const available = simulations.data ?? [];
    return available.find((item) => item.id === selectedSimulationId) ?? available[0];
  }, [selectedSimulationId, simulations.data]);
  const questions = useMemo(() => [...(simulation?.learning_simulation_questions ?? [])].sort((left, right) => left.position - right.position), [simulation]);
  const questionEntries = useMemo(() => questions.map((item) => ({ item, bank: one(item.learning_question_bank) })).filter((entry): entry is typeof entry & { bank: NonNullable<typeof entry.bank> } => Boolean(entry.bank)), [questions]);
  const completedAttempts = useMemo(() => (attempts.data ?? []).filter((item) => item.simulation_id === simulation?.id && item.status === 'COMPLETED'), [attempts.data, simulation?.id]);
  const answeredCount = questionEntries.filter(({ bank }) => Boolean(answers[bank.id]?.trim())).length;
  const flaggedIds = questionEntries.filter(({ bank }) => flagged[bank.id]).map(({ bank }) => bank.id);
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const durationLimitSeconds = (simulation?.duration_minutes ?? 20) * 60;
  const remainingSeconds = Math.max(0, durationLimitSeconds - elapsedSeconds);

  useEffect(() => {
    const available = simulations.data ?? [];
    if (!available.length) return;
    const requestedId = searchParams.get('simulation');
    const requestedIsAvailable = requestedId ? available.some((item) => item.id === requestedId) : false;
    const selectedIsAvailable = selectedSimulationId ? available.some((item) => item.id === selectedSimulationId) : false;
    const nextId = requestedIsAvailable ? requestedId : selectedIsAvailable ? selectedSimulationId : available[0].id;
    if (selectedSimulationId !== nextId) setSelectedSimulationId(nextId);
    if (searchParams.get('simulation') !== nextId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('simulation', nextId);
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedSimulationId, setSearchParams, simulations.data]);

  useEffect(() => {
    if (!simulation || attemptId || result) return;
    const openAttempt = (attempts.data ?? []).find((item) => item.simulation_id === simulation.id && item.status === 'IN_PROGRESS');
    if (!openAttempt) return;
    const restoredFlags = openAttempt.navigation_state?.flagged ?? [];
    setAttemptId(openAttempt.id);
    setStartedAt(new Date(openAttempt.started_at).getTime());
    setAnswers(answerMapFromAttempt(openAttempt.answers));
    setFlagged(Object.fromEntries(restoredFlags.map((id) => [id, true])));
    setCurrentIndex(Math.min(Math.max(openAttempt.navigation_state?.current_index ?? 0, 0), Math.max(questionEntries.length - 1, 0)));
  }, [attemptId, attempts.data, questionEntries.length, result, simulation]);

  useEffect(() => {
    if (!attemptId || result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attemptId, result]);

  const persistNavigation = (index: number, nextFlagged: Record<string, boolean>) => {
    if (!attemptId) return;
    setNavigationStatus('saving');
    void saveNavigation.mutateAsync({
      attemptId,
      navigation: { current_index: index, flagged: Object.keys(nextFlagged).filter((id) => nextFlagged[id]) },
    }).then(() => setNavigationStatus('idle')).catch(() => setNavigationStatus('error'));
  };

  const moveToQuestion = (index: number) => {
    setCurrentIndex(index);
    setReviewing(false);
    persistNavigation(index, flagged);
  };

  const toggleFlag = (questionId: string) => {
    const nextFlagged = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(nextFlagged);
    persistNavigation(currentIndex, nextFlagged);
  };

  const resetForSimulation = (simulationId: string) => {
    setSelectedSimulationId(simulationId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('simulation', simulationId);
    setSearchParams(nextParams, { replace: true });
    setAttemptId(null);
    setStartedAt(null);
    setAnswers({});
    setFlagged({});
    setSaveStatus('idle');
    setNavigationStatus('idle');
    setCurrentIndex(0);
    setReviewing(false);
    setResult(null);
  };

  if (simulations.isLoading || student.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando simulados...</div>;
  if (!simulation || !questionEntries.length) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Ainda não há simulado disponível para sua turma.</section>;

  const currentEntry = questionEntries[currentIndex] ?? questionEntries[0];
  const bankQuestion = currentEntry.bank;
  const answer = answers[bankQuestion.id] ?? '';
  const begin = () => {
    void start.mutateAsync(simulation.id).then((id) => {
      setAttemptId(id);
      setStartedAt(Date.now());
      setNow(Date.now());
      setSaveStatus('idle');
      setNavigationStatus('idle');
    });
  };
  const answerQuestion = (value: string) => {
    const nextAnswers = { ...answers, [bankQuestion.id]: value };
    setAnswers(nextAnswers);
    if (!attemptId) return;
    const version = saveVersionRef.current + 1;
    saveVersionRef.current = version;
    const payload = (Object.entries(nextAnswers) as Array<[string, string]>).filter(([, currentAnswer]) => currentAnswer.trim()).map(([question_bank_id, currentAnswer]) => ({ question_bank_id, answer: currentAnswer }));
    setSaveStatus('saving');
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveAnswers.mutateAsync({ attemptId, answers: payload }))
      .then(() => { if (saveVersionRef.current === version) setSaveStatus('saved'); })
      .catch(() => { if (saveVersionRef.current === version) setSaveStatus('error'); });
  };
  const finish = () => {
    if (!attemptId) return;
    const payload = (Object.entries(answers) as Array<[string, string]>).filter(([, currentAnswer]) => currentAnswer.trim()).map(([question_bank_id, currentAnswer]) => ({ question_bank_id, answer: currentAnswer }));
    void submit.mutateAsync({ attemptId, answers: payload, durationSeconds: elapsedSeconds }).then((submitted) => setResult({ ...submitted, answered_count: payload.length, duration_seconds: elapsedSeconds }));
  };

  if (result) {
    const unanswered = Math.max(0, result.total_questions - result.answered_count);
    const wrong = Math.max(0, result.total_questions - result.correct_count - unanswered);
    return (
      <section className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h1 className="mt-4 text-2xl font-bold dark:text-white">Simulado concluído</h1><p className="mt-2 text-slate-500">{result.correct_count} de {result.total_questions} acertos · {result.score}%</p><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">O resultado alimentou suas evidências de aprendizagem. Ele não é uma nota oficial do ENEM.</p></div>
        <section aria-label="Resumo do resultado" className="grid gap-2 sm:grid-cols-4"><div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xl font-bold text-emerald-600">{result.correct_count}</p><p className="text-xs text-slate-500">Acertos</p></div><div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xl font-bold text-rose-600">{wrong}</p><p className="text-xs text-slate-500">Incorretas</p></div><div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xl font-bold text-amber-600">{unanswered}</p><p className="text-xs text-slate-500">Não respondidas</p></div><div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xl font-bold text-slate-800 dark:text-white">{formatDuration(result.duration_seconds)}</p><p className="text-xs text-slate-500">Duração</p></div></section>
        {result.area_breakdown && Object.keys(result.area_breakdown).length > 0 && <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Leitura do resultado</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{(Object.entries(result.area_breakdown) as Array<[string, { correct: number; total: number }]>).map(([area, value]) => <div key={area} className="rounded-lg border p-3 text-sm dark:border-slate-700"><p className="font-semibold dark:text-white">{area}</p><p className="mt-1 text-slate-500">{value.correct}/{value.total} acertos</p></div>)}</div></section>}
        <section aria-label="Próximos passos" className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Próximos passos</h2><p className="mt-1 text-sm text-slate-500">Use o resultado para decidir como continuar, sem transformar esta prática em nota oficial.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/student/study#study-progress" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Revisar habilidades</Link><Link to="/student/study" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white">Continuar estudo</Link><Link to="/student/study#study-practice" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white">Fazer reforço</Link><button type="button" onClick={() => resetForSimulation(simulation.id)} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white">Novo simulado</button></div></section>
      </section>
    );
  }

  if (!attemptId) return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar</Link>
      <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Simulados</p><h1 className="mt-1 text-2xl font-bold dark:text-white">Escolha uma prática</h1><p className="mt-2 text-sm text-slate-500">Simulados TecEscola, por área ou adaptativos ficam separados do resultado oficial.</p></header>
      <div className="grid gap-2 sm:grid-cols-2">{(simulations.data ?? []).map((item) => <button key={item.id} type="button" onClick={() => resetForSimulation(item.id)} className={`rounded-lg border p-4 text-left ${item.id === simulation.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'dark:border-slate-700'}`}><p className="font-semibold dark:text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.simulation_type} · {item.learning_simulation_questions?.length ?? 0} questões</p></button>)}</div>
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-bold dark:text-white">{simulation.title}</h2><p className="mt-2 text-sm text-slate-500">{questionEntries.length} questões · {simulation.duration_minutes ?? 20} min</p><button type="button" onClick={begin} disabled={start.isPending || !student.data} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{start.isPending ? 'Preparando...' : 'Começar simulado'}</button></div>
      {completedAttempts.length > 0 && <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Histórico deste simulado</h2><div className="mt-3 divide-y dark:divide-slate-700">{completedAttempts.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-500">{new Date(item.completed_at ?? item.started_at).toLocaleDateString('pt-BR')}</span><strong className="dark:text-white">{item.correct_count}/{item.total_questions} · {item.score}%</strong></div>)}</div></section>}
    </section>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Central de Estudos</Link>
      <header><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">{simulation.simulation_type}</p><h1 className="mt-1 text-2xl font-bold dark:text-white">{simulation.title}</h1></div><div className={`shrink-0 rounded-lg border px-3 py-2 text-right text-sm font-bold ${remainingSeconds < 60 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}><Clock3 className="mb-1 ml-auto h-4 w-4" />{formatDuration(remainingSeconds)}<span className="block text-[10px] font-normal">tempo restante</span></div></div><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><ListChecks className="h-4 w-4" />Questão {currentIndex + 1} de {questionEntries.length} · {answeredCount} respondida(s)</p></header>
      <nav aria-label="Navegador do simulado" className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold dark:text-white">Navegação</p><p className="text-xs text-slate-500">{flaggedIds.length} marcada(s) para revisar</p></div><div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">{questionEntries.map(({ bank }, index) => { const isAnswered = Boolean(answers[bank.id]?.trim()); const isFlagged = Boolean(flagged[bank.id]); return <button key={bank.id} type="button" onClick={() => moveToQuestion(index)} aria-label={`Questão ${index + 1}${isAnswered ? ', respondida' : ', não respondida'}${isFlagged ? ', marcada' : ''}`} aria-current={index === currentIndex ? 'step' : undefined} className={`relative min-h-10 rounded-lg border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${index === currentIndex ? 'border-[#005bbf] bg-blue-50 text-[#005bbf]' : isAnswered ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}>{index + 1}{isFlagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-500 text-amber-600" aria-hidden="true" />}</button>; })}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />Respondida</span><span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5 text-slate-400" />Não respondida</span><span className="inline-flex items-center gap-1"><Flag className="h-3 w-3 fill-amber-500 text-amber-600" />Marcada</span></div></nav>
      {reviewing ? <section aria-label="Revisão final" className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30"><h2 className="text-lg font-bold text-blue-950 dark:text-blue-100">Revise antes de finalizar</h2><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900"><strong className="block text-xl text-emerald-600">{answeredCount}</strong>respondidas</div><div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900"><strong className="block text-xl text-amber-600">{questionEntries.length - answeredCount}</strong>não respondidas</div><div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900"><strong className="block text-xl text-amber-600">{flaggedIds.length}</strong>marcadas</div></div><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setReviewing(false)} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-800 dark:bg-slate-900 dark:text-blue-200">Voltar às questões</button><button type="button" onClick={finish} disabled={submit.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{submit.isPending ? 'Enviando...' : 'Finalizar simulado'}</button></div></section> : <><div className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><p className="text-base leading-6 dark:text-slate-200">{bankQuestion.statement}</p><button type="button" onClick={() => toggleFlag(bankQuestion.id)} aria-pressed={Boolean(flagged[bankQuestion.id])} aria-label={flagged[bankQuestion.id] ? 'Remover marcação da questão' : 'Marcar questão para revisar'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${flagged[bankQuestion.id] ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}><Flag className="h-4 w-4" fill={flagged[bankQuestion.id] ? 'currentColor' : 'none'} /></button></div><div className="mt-5 space-y-2">{bankQuestion.options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 dark:text-slate-200"><input type="radio" name={bankQuestion.id} value={option} checked={answer === option} onChange={() => answerQuestion(option)} />{option}</label>)}</div></div><div className="flex items-center justify-between gap-3"><div className="min-h-5 text-xs text-slate-500" role="status" aria-live="polite">{saveStatus === 'saving' ? 'Salvando resposta...' : saveStatus === 'saved' ? 'Resposta salva.' : saveStatus === 'error' ? 'Não foi possível salvar a resposta.' : navigationStatus === 'saving' ? 'Salvando navegação...' : navigationStatus === 'error' ? 'Navegação não salva.' : ''}</div><div className="flex gap-3">{currentIndex < questionEntries.length - 1 ? <button type="button" onClick={() => moveToQuestion(currentIndex + 1)} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Próxima</button> : <button type="button" onClick={() => setReviewing(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"><ListChecks className="h-4 w-4" />Revisar e finalizar</button>}</div></div></>}
      {submit.isError && <p role="alert" className="text-sm text-red-600">{submit.error.message}</p>}
    </div>
  );
}
