import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock3, Loader2, Radio, Trophy } from 'lucide-react';
import {
  humanizeTecQuizError,
  tecQuizLiveService,
  type TecQuizGameState,
} from '../../services/tecQuizLiveService';

const studentGameStorageKey = 'tec-quiz-student-game-v1';

function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}

function Leaderboard({ state }: { state: TecQuizGameState }) {
  if (state.leaderboard.length === 0) {
    return (
      <section aria-label="Participantes da partida" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Participantes</h2>
        {state.participants.length ? (
          <ul className="mt-4 space-y-2">
            {state.participants.map(({ alias }) => <li key={alias} className="rounded-xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 dark:bg-slate-800 dark:text-white">{alias}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-500">A turma ainda não entrou na sala.</p>}
        <p className="mt-3 text-xs text-slate-500">A classificação aparece entre as perguntas.</p>
      </section>
    );
  }
  return (
    <section aria-label="Classificação" className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Trophy className="h-5 w-5 text-amber-500" />Classificação</h2>
      <ol className="mt-4 space-y-2">
        {state.leaderboard.map((entry) => <li key={entry.alias} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800"><span className="font-semibold text-slate-800 dark:text-white">{entry.rank}º · {entry.alias}</span><span className="text-sm font-bold text-[#005bbf]">{entry.score ?? '—'} pts</span></li>)}
      </ol>
      <p className="mt-3 text-xs text-slate-500">O placar usa apelidos para proteger a identidade dos estudantes.</p>
    </section>
  );
}

export default function StudentLiveQuizPage() {
  const queryClient = useQueryClient();
  const [gameId, setGameId] = useState(() => window.sessionStorage.getItem(studentGameStorageKey));
  const [pin, setPin] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const currentGame = useQuery({
    queryKey: ['tec-quiz-live', 'my-current-game'],
    queryFn: () => tecQuizLiveService.myCurrentGame(),
    enabled: !gameId,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!gameId && currentGame.data) {
      window.sessionStorage.setItem(studentGameStorageKey, currentGame.data);
      setGameId(currentGame.data);
    }
  }, [currentGame.data, gameId]);

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
    if (!gameId) return undefined;
    return tecQuizLiveService.subscribe(gameId, () => {
      void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
    });
  }, [gameId, queryClient]);

  const joinMutation = useMutation({
    mutationFn: () => tecQuizLiveService.join(pin),
    onSuccess: ({ game_id }) => {
      window.sessionStorage.setItem(studentGameStorageKey, game_id);
      setGameId(game_id);
      setMessage('Você entrou na sala. Aguarde o professor iniciar o jogo.');
      setSelectedOption(null);
      void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'my-current-game'] });
    },
    onError: (error: unknown) => setMessage(humanizeTecQuizError(error)),
  });
  const answerMutation = useMutation({
    mutationFn: () => tecQuizLiveService.answer(gameId!, selectedOption!),
    onSuccess: () => {
      setMessage('Resposta registrada. O professor mostrará a correção ao encerrar a rodada.');
      void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', gameId] });
    },
    onError: (error: unknown) => setMessage(humanizeTecQuizError(error)),
  });
  const busy = joinMutation.isPending || answerMutation.isPending;

  const leaveFinishedGame = () => {
    window.sessionStorage.removeItem(studentGameStorageKey);
    setGameId(null);
    setSelectedOption(null);
    setMessage('');
    void queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'my-current-game'] });
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Painel do estudante</Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Aprendizagem</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">Jogos ao Vivo</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Entre com o PIN compartilhado pelo professor. Sua matrícula é verificada pela escola.</p>
      </header>

      {message ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">{message}</p> : null}

      {!gameId ? (
        <section className="mx-auto max-w-xl rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/40"><Radio className="h-7 w-7" /></div>
          <h2 className="mt-4 text-center text-xl font-bold text-slate-900 dark:text-white">Entrar em uma partida</h2>
          {currentGame.isLoading ? <p role="status" className="mt-3 flex justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Procurando uma partida em andamento...</p> : null}
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); setMessage(''); joinMutation.mutate(); }}>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">PIN da partida
              <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="mt-1.5 w-full rounded-xl border px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.3em] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <button type="submit" disabled={pin.length !== 6 || busy} className="w-full rounded-xl bg-[#005bbf] px-5 py-3 font-bold text-white disabled:opacity-50">{joinMutation.isPending ? 'Entrando...' : 'Entrar no jogo'}</button>
          </form>
        </section>
      ) : stateQuery.isLoading ? (
        <section role="status" className="grid min-h-64 place-items-center rounded-2xl border bg-white p-8 text-slate-600 dark:border-slate-700 dark:bg-slate-900"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Reconectando à partida...</section>
      ) : stateQuery.isError ? (
        <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p>{humanizeTecQuizError(stateQuery.error)}</p><button type="button" onClick={leaveFinishedGame} className="mt-4 font-bold underline">Voltar aos jogos</button></section>
      ) : state ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#005bbf]">Tec Quiz Live</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{state.activity_title ?? 'Partida da turma'}</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-[#005bbf] dark:bg-blue-950/40">{state.participant_count} jogadores</span></div>
            {state.status === 'LOBBY' ? <div role="status" className="rounded-2xl bg-blue-50 p-6 text-center dark:bg-blue-950/30"><Radio className="mx-auto h-8 w-8 text-[#005bbf]" /><h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Você está na sala</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Aguarde o professor iniciar. A tela se atualiza automaticamente quando o jogo começar.</p></div> : null}
            {state.status === 'IN_PROGRESS' && state.question ? <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><span className="font-bold text-slate-700 dark:text-slate-200">Pergunta {state.question.index} de {state.question.total}</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xl font-black text-[#005bbf] dark:bg-slate-950"><Clock3 className="h-5 w-5" />{remaining}s</span></div>
              <h3 className="text-xl font-bold leading-relaxed text-slate-900 dark:text-white">{state.question.text}</h3>
              {state.my_answer?.submitted ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Resposta registrada. Aguarde o encerramento da rodada para ver a correção.</p> : <div className="grid gap-3 sm:grid-cols-2">{state.question.options.map((option, index) => <button type="button" key={`${index}-${option}`} disabled={remaining <= 0 || busy} aria-pressed={selectedOption === index} onClick={() => setSelectedOption(index)} className={`min-h-20 rounded-xl border-2 p-4 text-left font-semibold transition ${selectedOption === index ? 'border-[#005bbf] bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white'} disabled:cursor-not-allowed disabled:opacity-50`}><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-sm font-black text-[#005bbf] dark:bg-blue-950/60">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>}
              {!state.my_answer?.submitted ? <button type="button" onClick={() => answerMutation.mutate()} disabled={selectedOption === null || remaining <= 0 || busy} className="inline-flex items-center gap-2 rounded-xl bg-[#005bbf] px-5 py-3 font-bold text-white disabled:opacity-50">{answerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirmar resposta</button> : null}
            </> : null}
            {state.status === 'INTERMISSION' && state.question ? <div className="space-y-4 rounded-xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-xs font-bold uppercase tracking-widest text-[#005bbf]">Resposta revelada · pergunta {state.question.index}</p><h3 className="text-lg font-bold text-slate-900 dark:text-white">{state.question.text}</h3><p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-900">Resposta correta: {state.question.options[state.question.correct_option_index ?? -1] ?? '—'}</p>{state.my_answer?.submitted ? <p className="text-sm font-semibold">{state.my_answer.is_correct ? `Você acertou e ganhou ${state.my_answer.points_awarded} pontos!` : 'Desta vez não acertou. Continue na próxima pergunta.'}</p> : <p className="text-sm text-slate-600 dark:text-slate-300">Você não respondeu nesta rodada. Continue acompanhando.</p>}{state.question.explanation ? <p className="text-sm text-slate-700 dark:text-slate-200">{state.question.explanation}</p> : null}</div> : null}
            {state.status === 'FINISHED' ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><h3 className="text-xl font-bold">Jogo concluído!</h3><p className="mt-1 text-sm">Seu resultado e a classificação final ficaram salvos.</p><button type="button" onClick={leaveFinishedGame} className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">Voltar aos jogos</button></div> : null}
            {state.status === 'CANCELLED' || state.status === 'EXPIRED' ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">Esta sala foi encerrada.</p> : null}
          </section>
          <Leaderboard state={state} />
        </div>
      ) : null}
    </main>
  );
}
