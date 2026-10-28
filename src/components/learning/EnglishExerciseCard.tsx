import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Mic, Volume2, X } from 'lucide-react';

import { tecLanguageLocale, tecLanguageName } from '../../lib/tecLanguage';
import { seededExerciseOrder } from '../../lib/tecEnglishExerciseOrder';
import type { EnglishExercise } from '../../services/tecEnglishService';

interface EnglishExerciseCardProps {
  exercise: EnglishExercise;
  courseCode?: string;
  attemptSeed?: string;
  resetToken: number;
  disabled?: boolean;
  onSubmit: (response: Record<string, unknown>) => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function EnglishExerciseCard({ exercise, courseCode, attemptSeed = exercise.id, resetToken, disabled = false, onSubmit }: EnglishExerciseCardProps) {
  const [choice, setChoice] = useState('');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [rate, setRate] = useState(1);
  const [localError, setLocalError] = useState('');
  const [speechMessage, setSpeechMessage] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const languageLocale = tecLanguageLocale(courseCode, exercise.skill_code);
  const languageName = tecLanguageName(courseCode, exercise.skill_code);
  const optionOrder = useMemo(
    () => seededExerciseOrder(exercise.options.length, `${attemptSeed}:${exercise.id}:options`),
    [attemptSeed, exercise.id, exercise.options.length],
  );
  const wordOrder = useMemo(
    () => seededExerciseOrder(exercise.word_bank.length, `${attemptSeed}:${exercise.id}:word-bank`),
    [attemptSeed, exercise.id, exercise.word_bank.length],
  );

  const speechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const browserWindow = window as WindowWithSpeechRecognition;
    return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  }, []);

  useEffect(() => {
    const activeRecognition = recognitionRef.current;
    if (activeRecognition) {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      try {
        activeRecognition.stop();
      } catch {
        // The browser may already have stopped recognition after a permission or device error.
      }
      recognitionRef.current = null;
    }
    setChoice('');
    setTypedAnswer('');
    setSelectedWords([]);
    setPairs({});
    setLocalError('');
    setSpeechMessage('');
    setRecognizing(false);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // Cleanup is best-effort if the browser already ended the microphone session.
      }
      recognitionRef.current = null;
    };
  }, [attemptSeed, exercise.id, resetToken]);

  function playAudio() {
    if (!exercise.audio_text || typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechMessage('A reprodução de áudio não está disponível neste navegador. Você ainda pode responder por escrito.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(exercise.audio_text);
    utterance.lang = languageLocale;
    utterance.rate = rate;
    utterance.onerror = () => setSpeechMessage('Não foi possível reproduzir o áudio. Você ainda pode ler a frase e responder por escrito.');
    try {
      window.speechSynthesis.speak(utterance);
      setSpeechMessage(`Reproduzindo em ${languageName}. Você pode ouvir novamente.`);
    } catch {
      setSpeechMessage('Não foi possível reproduzir o áudio. Você ainda pode responder por escrito.');
    }
  }

  function useMicrophone() {
    if (!speechRecognition) {
      setSpeechMessage('O reconhecimento de voz não está disponível neste navegador. Digite a frase para continuar.');
      return;
    }
    const recognition = new speechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = languageLocale;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setTypedAnswer(transcript);
        setSpeechMessage('Sua fala foi convertida em texto. Confira e envie quando estiver pronto.');
      }
    };
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setRecognizing(false);
      setSpeechMessage('Não foi possível usar o microfone. Digite sua resposta para continuar.');
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setRecognizing(false);
    };
    setRecognizing(true);
    setSpeechMessage('O navegador está ouvindo. Nenhuma gravação é salva.');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setRecognizing(false);
      setSpeechMessage('Não foi possível usar o microfone. Digite sua resposta para continuar.');
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (exercise.type === 'MULTIPLE_CHOICE' || exercise.type === 'FILL_BLANK') {
      if (!choice) return setLocalError('Escolha uma opção para continuar.');
      onSubmit({ choice });
      return;
    }
    if (exercise.type === 'WORD_ORDER') {
      if (selectedWords.length === 0) return setLocalError('Toque nas palavras para montar a frase.');
      onSubmit({ tokens: selectedWords.map((index) => exercise.word_bank[index]) });
      return;
    }
    if (exercise.type === 'MATCHING') {
      if (Object.keys(pairs).length !== exercise.left_items.length) return setLocalError('Associe todos os pares antes de enviar.');
      onSubmit({ pairs });
      return;
    }
    const value = typedAnswer.trim();
    if (!value) return setLocalError(exercise.type === 'SPEAKING' ? 'Digite ou fale a frase para continuar.' : 'Escreva sua resposta para continuar.');
    onSubmit({ text: value });
  }

  const showTextInput = ['TRANSLATION', 'LISTENING', 'SPEAKING'].includes(exercise.type);

  return (
    <form onSubmit={submit} className="space-y-5" aria-labelledby="english-exercise-prompt">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{exercise.instruction}</p>
          {exercise.difficulty_level ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Nível {exercise.difficulty_level}</span> : null}
        </div>
        {exercise.dialogue_context?.length || exercise.dialogue_speaker ? (
          <section aria-label="Contexto da conversa" className="mt-4 space-y-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20">
            {exercise.dialogue_context?.map((turn, index) => (
              <div key={`${turn.speaker}-${index}`} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${turn.speaker === 'Você' ? 'ml-auto bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100' : 'bg-sky-700 text-white'}`}>
                <span className="block text-[0.68rem] font-bold uppercase opacity-75">{turn.speaker}</span>{turn.text}
              </div>
            ))}
            {exercise.dialogue_speaker ? <p className="pt-1 text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200">{exercise.dialogue_speaker} diz:</p> : null}
          </section>
        ) : null}
        <h2 id="english-exercise-prompt" className="mt-2 text-xl font-extrabold leading-snug text-slate-900 dark:text-white sm:text-2xl">{exercise.prompt}</h2>
      </div>

      {exercise.audio_text ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <button type="button" onClick={playAudio} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 font-bold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <Volume2 className="h-5 w-5" aria-hidden="true" /> Ouvir novamente
          </button>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Velocidade
            <select aria-label="Velocidade do áudio" value={rate} onChange={(event) => setRate(Number(event.target.value))} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
              <option value={0.75}>Devagar</option>
              <option value={1}>Normal</option>
              <option value={1.25}>Mais rápido</option>
            </select>
          </label>
        </div>
      ) : null}

      {exercise.type === 'MULTIPLE_CHOICE' || exercise.type === 'FILL_BLANK' ? (
        <div className="grid gap-3">
          {optionOrder.map((optionIndex, displayIndex) => {
            const option = exercise.options[optionIndex];
            return (
              <button key={`${optionIndex}-${option}`} type="button" aria-pressed={choice === option} disabled={disabled} onClick={() => setChoice(option)} className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-60 ${choice === option ? 'border-sky-700 bg-sky-50 text-sky-950 dark:border-sky-400 dark:bg-sky-950/60 dark:text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}>
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm dark:bg-slate-800">{String.fromCharCode(65 + displayIndex)}</span>{option}
              </button>
            );
          })}
        </div>
      ) : null}

      {exercise.type === 'WORD_ORDER' ? (
        <div className="space-y-4">
          <div className="flex min-h-14 flex-wrap gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/20" aria-label="Frase montada">
            {selectedWords.length === 0 ? <span className="self-center text-sm text-slate-500">Toque nas palavras abaixo para montar a frase.</span> : selectedWords.map((wordIndex, selectedIndex) => (
              <button key={`${wordIndex}-${selectedIndex}`} type="button" disabled={disabled} onClick={() => setSelectedWords((current) => current.filter((_, index) => index !== selectedIndex))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-300 bg-white px-3 font-semibold text-slate-900 dark:border-sky-800 dark:bg-slate-900 dark:text-white">
                {exercise.word_bank[wordIndex]} <X className="h-3.5 w-3.5" aria-label="Remover palavra" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Palavras disponíveis">
            {wordOrder.map((wordIndex) => {
              const word = exercise.word_bank[wordIndex];
              return selectedWords.includes(wordIndex) ? null : (
                <button key={wordIndex} type="button" disabled={disabled} onClick={() => setSelectedWords((current) => [...current, wordIndex])} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {word}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {exercise.type === 'MATCHING' ? (
        <div className="space-y-3">
          {exercise.left_items.map((left) => (
            <label key={left} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] dark:border-slate-700 dark:bg-slate-900">
              <span className="font-bold text-slate-900 dark:text-white">{left}</span>
              <select aria-label={`Significado para ${left}`} value={pairs[left] ?? ''} disabled={disabled} onChange={(event) => setPairs((current) => ({ ...current, [left]: event.target.value }))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">Escolha o significado</option>
                {exercise.right_items.map((right) => <option key={right} value={right}>{right}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {showTextInput ? (
        <div className="space-y-3">
          {exercise.type === 'SPEAKING' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={disabled || recognizing || !speechRecognition} onClick={useMicrophone} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-700 px-4 py-2 font-bold text-sky-800 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-400 dark:text-sky-200 dark:hover:bg-sky-950/40">
                <Mic className="h-4 w-4" aria-hidden="true" /> {recognizing ? 'Ouvindo…' : 'Tentar falar'}
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">{speechRecognition ? 'A escola não armazena gravações. Digitar também funciona.' : 'Seu navegador não oferece reconhecimento de voz. Digite a frase para continuar.'}</span>
            </div>
          ) : null}
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {exercise.type === 'SPEAKING' ? `Sua frase em ${languageName}` : exercise.type === 'LISTENING' ? 'O que você ouviu?' : 'Sua tradução'}
            <input value={typedAnswer} disabled={disabled} onChange={(event) => setTypedAnswer(event.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
        </div>
      ) : null}

      {speechMessage ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{speechMessage}</p> : null}
      {localError ? <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{localError}</p> : null}

      <button type="submit" disabled={disabled} className="min-h-12 w-full rounded-xl bg-[#075ec8] px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-[#064ea6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
        Conferir resposta
      </button>
    </form>
  );
}
