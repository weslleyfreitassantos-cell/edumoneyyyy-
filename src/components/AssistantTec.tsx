import { useEffect, useMemo, useState } from 'react';
import { Bot, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  getAssistantFeatures,
  recordAssistantUsage,
  type AssistantFeature,
} from '../services/featureRegistry';
import type { UserRole } from '../types';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function AssistantTec({
  role,
  institutionId,
}: {
  role: UserRole;
  institutionId: string | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Olá! O que você deseja fazer?',
  );
  const [selected, setSelected] =
    useState<AssistantFeature | null>(null);
  const [voiceEnabled, setVoiceEnabled] =
    useState(false);
  const features = getAssistantFeatures(role);

  const results = useMemo(() => {
    const terms = normalize(question)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!terms.length) {
      return [];
    }

    return features
      .map((item) => {
        const haystack = normalize(
          `${item.label} ${item.description} ${item.id} ${item.keywords.join(' ')}`,
        );
        const score = terms.reduce(
          (total, term) =>
            total + (haystack.includes(term) ? 1 : 0),
          0,
        );

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .map(({ item }) => item);
  }, [features, question]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function speak(text: string): void {
    if (
      !voiceEnabled ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function go(item: AssistantFeature): void {
    recordAssistantUsage(item.id, institutionId);
    setSelected(item);
    const text = `Encontrei ${item.label}. Vou abrir essa tela para você.`;
    setAnswer(text);
    speak(text);
    navigate(item.route);
    setQuestion('');
  }

  function ask(): void {
    const best = results[0];

    if (!question.trim()) {
      return;
    }

    if (best) {
      go(best);
      return;
    }

    const text =
      'Ainda não encontrei essa área para o seu perfil. Tente escrever o nome da tela ou do recurso.';
    setAnswer(text);
    speak(text);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente TEC"
        data-print-hide
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#005bbf] text-white shadow-lg transition hover:bg-[#004a9c] sm:bottom-5 sm:right-5"
        title="Assistente TEC"
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Assistente TEC"
          data-print-hide
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[calc(100dvh-7rem)] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:inset-x-auto sm:right-5 sm:max-h-[min(680px,calc(100dvh-7rem))] sm:w-[min(420px,calc(100vw-2.5rem))]"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 bg-[#005bbf] px-4 py-3 text-white">
            <div className="min-w-0">
              <strong className="block truncate">
                Assistente TEC
              </strong>
              <p className="mt-0.5 text-xs text-blue-100">
                Encontre recursos disponíveis para seu perfil.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 space-y-4 overflow-y-auto p-3 sm:p-4">
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
              <Bot
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <span>{answer}</span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask();
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950"
            >
              <input
                autoFocus
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                placeholder="Digite o que você quer fazer..."
                aria-label="Pergunte ao Assistente TEC"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <button
                type="submit"
                aria-label="Enviar pergunta"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#005bbf] hover:bg-blue-50 dark:hover:bg-slate-800"
                title="Enviar"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <span className="text-xs leading-relaxed text-slate-400">
                Ex.: grade, materiais, avisos, chamadas ou notas.
              </span>
              <button
                type="button"
                onClick={() =>
                  setVoiceEnabled((value) => !value)
                }
                aria-label={
                  voiceEnabled
                    ? 'Desativar áudio'
                    : 'Ativar áudio'
                }
                title={
                  voiceEnabled
                    ? 'Desativar áudio'
                    : 'Ativar áudio'
                }
                className="inline-flex shrink-0 items-center gap-1 self-end text-xs font-semibold text-slate-600 dark:text-slate-300 sm:self-start"
              >
                {voiceEnabled ? (
                  <Volume2
                    className="h-4 w-4 text-[#005bbf]"
                    aria-hidden="true"
                  />
                ) : (
                  <VolumeX
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                Áudio
              </button>
            </div>

            {question.trim() && (
              <div className="space-y-2">
                {results.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-[#005bbf] hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-800 dark:text-slate-100">
                        {item.label}
                      </strong>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                    <Send
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#005bbf]"
                      aria-hidden="true"
                    />
                  </button>
                ))}

                {results.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Não encontrei um recurso correspondente para seu perfil.
                  </p>
                )}
              </div>
            )}

            {selected && (
              <p className="break-words text-right text-[11px] text-slate-400">
                Aberto agora: {selected.label} - {location.pathname}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
