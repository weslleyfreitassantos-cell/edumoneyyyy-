import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock3, Loader2, Play, Radio, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  humanizeTecQuizError,
  tecQuizLiveService,
  type TecQuizGameState,
  type TecQuizTeacherOption,
} from '../../services/tecQuizLiveService';

const teacherGameStorageKey = 'tec-quiz-teacher-game-v1';

function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}

function Ranking({ state }: { state: TecQuizGameState }) {
  if (state.leaderboard.length === 0) {
    return (
      <section aria-label="Participantes da partida" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Participantes</h2>
        {state.participants.length ? (
          <ul className="mt-4 space-y-2">
            {state.participants.map(({ alias }) => <li key={alias} className="rounded-xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 dark:bg-slate-800 dark:text-white">{alias}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-500">A turma ainda não entrou na sala.</p>}
        <p className="mt-3 text-xs text-slate-500">Os estudantes aparecem por apelidos para proteger sua identidade.</p>
      </section>
    );
  }
  return (
    <section aria-label="Classificação da partida" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Trophy className="h-5 w-5 text-amber-500" />Classificação</h2>
      <ol className="mt-4 space-y-2">
        {state.leaderboard.map((entry) => (
          <li key={entry.alias} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
            <span className="font-semibold text-slate-800 dark:text-white">{entry.rank}º · {entry.alias}</span>
            <span className="text-sm font-bold text-[#005bbf]">{entry.score ?? '—'} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function TeacherLiveQuizPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [gameId, setGameId] = useState(() => window.sessionStorage.getItem(teacherGameStorageKey));
  const [activityId, setActivityId] = useState(searchParams.get('activityId') ?? '');
  const [classId, setClassId] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [basePoints, setBasePoints] = useState(500);
  const [message, setMessage] = useState('');
  const options = useQuery({
    queryKey: ['tec-quiz-live', 'teacher-options', currentInstitutionId, profile?.id],
    queryFn: () => tecQuizLiveService.teacherOptions(),
    enabled: Boolean(currentInstitutionId && profile?.id),
    staleTime: 15_000,
  });
  const availableOptions = options.data ?? [];
  const activityOptions = useMemo(() => {
    const unique = new Map<string, { id: string; title: string; subject: string; questionCount: number }>();
    availableOptions.forEach((item) => unique.set(item.activity_id, {
      id: item.activity_id, title: item.activity_title, subject: item.subject_name, questionCount: item.question_count,
    }));
    return [...unique.values()];
  }, [availableOptions]);
  const classOptions = availableOptions.filter((item) => item.activity_id === activityId);
  const stateQuery = useQuery({
    queryKey: ['tec-quiz-live', 'state', gameId],
    queryFn: () => tecQuizLiveService.state(gameId!),
    enabled: Boolean(gameId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const state = stateQuery.data;
  const remaining = useCountdown(state?.round_deadline_at);

  useEffect(() => {
    if (state?.status === 'FINISHED' && gameId) {
      window.sessionStorage.removeItem(teacherGameStorageKey);
    }
  }, [gameId, state?.status]);

  useEffect(() => {
    if (!gameId) return undefined;
    return tecQuizLiveService.subscribe(gameId, () => {
      void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
    });
  }, [gameId, queryClient]);

  const mutationOptions = {
    onError: (error: unknown) => setMessage(humanizeTecQuizError(error)),
    onSuccess: () => {
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
    },
  };
  const createMutation = useMutation({
    mutationFn: () => tecQuizLiveService.createGame({
      activityId,
      classId,
      timePerQuestionSeconds: seconds,
      basePoints,
    }),
    onSuccess: (result) => {
      window.sessionStorage.setItem(teacherGameStorageKey, result.game_id);
      setGameId(result.game_id);
      setMessage('Sala criada. Compartilhe o PIN com os estudantes da turma.');
    },
    onError: (error: unknown) => setMessage(humanizeTecQuizError(error)),
  });
  const startMutation = useMutation({ mutationFn: () => tecQuizLiveService.start(gameId!), ...mutationOptions });
  const advanceMutation = useMutation({ mutationFn: () => tecQuizLiveService.advance(gameId!), ...mutationOptions });
  const busy = createMutation.isPending || startMutation.isPending || advanceMutation.isPending;
  const selectedActivity = activityOptions.find((item) => item.id === activityId);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/teacher/classroom" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Sala de Aula</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Aprendizagem e recursos</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Tec Quiz Live</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Inicie uma atividade publicada e acompanhe a turma em uma partida ao vivo.</p>
        </div>
        {gameId && state?.status === 'FINISHED' ? <button type="button" onClick={() => { window.sessionStorage.removeItem(teacherGameStorageKey); setGameId(null); setMessage(''); }} className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-white">Preparar outra partida</button> : null}
      </header>

      {message ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">{message}</p> : null}

      {!gameId ? (
        <section className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Preparar uma partida</h2>
          {options.isLoading ? <p role="status" className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando atividades compatíveis...</p> : null}
          {options.isError ? <p role="alert" className="mt-5 text-sm text-red-700">Não foi possível carregar suas atividades e turmas.</p> : null}
          {!options.isLoading && !options.isError && activityOptions.length === 0 ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Para iniciar um jogo, publique uma atividade com ao menos três questões de múltipla escolha ou verdadeiro/falso e atribua-a a uma turma vinculada à sua disciplina.</p> : null}
          {activityOptions.length > 0 ? (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Atividade publicada
                <select required value={activityId} onChange={(event) => { setActivityId(event.target.value); setClassId(''); }} className="mt-1.5 w-full rounded-lg border px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <option value="">Selecione uma atividade</option>
                  {activityOptions.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.title} ({item.questionCount} questões)</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Turma autorizada
                <select required value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <option value="">Selecione uma turma</option>
                  {classOptions.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tempo por pergunta
                <select value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  {[10, 15, 20, 30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} segundos</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pontuação base
                <select value={basePoints} onChange={(event) => setBasePoints(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  {[100, 250, 500, 750, 1000].map((value) => <option key={value} value={value}>{value} pontos (mais bônus por rapidez)</option>)}
                </select>
              </label>
              <div className="sm:col-span-2"><button type="submit" disabled={!activityId || !classId || busy} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}Criar sala e gerar PIN</button></div>
            </form>
          ) : null}
          {selectedActivity ? <p className="mt-4 text-xs text-slate-500">As respostas, correção e pontuação são calculadas pelo servidor; o gabarito só aparece ao encerrar cada rodada.</p> : null}
        </section>
      ) : stateQuery.isLoading ? (
        <div role="status" className="grid min-h-64 place-items-center rounded-2xl border bg-white p-8 text-slate-600 dark:border-slate-700 dark:bg-slate-900"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Reconectando à sala...</div>
      ) : stateQuery.isError ? (
        <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p>{humanizeTecQuizError(stateQuery.error)}</p><button type="button" onClick={() => { window.sessionStorage.removeItem(teacherGameStorageKey); setGameId(null); }} className="mt-4 font-bold underline">Voltar e preparar outra partida</button></section>
      ) : state ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <article className="rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 p-6 text-white shadow-lg sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-blue-100">{state.activity_title ?? 'Atividade'}</p><h2 className="mt-2 text-2xl font-bold">{state.status === 'LOBBY' ? 'Aguardando estudantes' : state.status === 'FINISHED' ? 'Partida encerrada' : 'Partida ao vivo'}</h2></div><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{state.participant_count} participante(s)</span></div>
              <div className="mt-6 rounded-2xl bg-white/10 p-5 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-blue-100">PIN de entrada</p><p aria-label={`PIN ${state.pin}`} className="mt-1 font-mono text-5xl font-black tracking-[0.25em] sm:text-6xl">{state.pin ?? '••••••'}</p><p className="mt-2 text-sm text-blue-100">Os estudantes entram em Sala de Aula → Jogos ao Vivo.</p></div>
              {state.status === 'LOBBY' ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-blue-100">O jogo começa quando dois ou mais estudantes da turma estiverem na sala.</p><button type="button" onClick={() => startMutation.mutate()} disabled={busy || state.participant_count < 2} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-[#005bbf] disabled:cursor-not-allowed disabled:opacity-50">{startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Iniciar jogo</button></div> : null}
              {state.status === 'IN_PROGRESS' && state.question ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 p-4"><span className="font-bold">Pergunta {state.question.index} de {state.question.total}</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xl font-black text-[#005bbf]"><Clock3 className="h-5 w-5" />{remaining}s</span><span className="text-sm text-blue-100">{state.round_response_count ?? 0} / {state.participant_count} respostas</span></div> : null}
              {(state.status === 'IN_PROGRESS' || state.status === 'INTERMISSION') && state.question ? <div className="mt-5 rounded-xl bg-white p-5 text-slate-900"><p className="text-lg font-bold sm:text-2xl">{state.question.text}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{state.question.options.map((option, index) => <div key={`${index}-${option}`} className={`rounded-lg border p-3 text-sm font-semibold ${state.question?.correct_option_index === index ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50'}`}>{String.fromCharCode(65 + index)}. {option}</div>)}</div>{state.status === 'INTERMISSION' && state.question.explanation ? <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{state.question.explanation}</p> : null}</div> : null}
              {state.status === 'IN_PROGRESS' ? <button type="button" onClick={() => advanceMutation.mutate()} disabled={busy || !state.can_advance} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-[#005bbf] disabled:opacity-50"><Check className="h-4 w-4" />Revelar resposta e classificação</button> : null}
              {state.status === 'INTERMISSION' ? <button type="button" onClick={() => advanceMutation.mutate()} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-[#005bbf] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{state.question_index >= state.total_questions ? 'Encerrar e ver relatório' : 'Próxima pergunta'}</button> : null}
            </article>
            <Ranking state={state} />
          </section>
          {state.status === 'FINISHED' ? <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><h2 className="text-xl font-bold">Relatório final</h2><p className="mt-1 text-sm">Partida encerrada com {state.total_questions} perguntas e {state.participant_count} participantes. O placar utiliza apelidos e não mostra nomes completos.</p></section> : null}
        </>
      ) : null}
    </main>
  );
}
