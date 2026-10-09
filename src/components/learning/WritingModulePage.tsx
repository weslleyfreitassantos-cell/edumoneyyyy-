import {
  BookOpen,
  ChevronLeft,
  Clock3,
  FileText,
  FolderOpen,
  PencilLine,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const draftsStorageKey = 'student-writing-module-drafts';
const legacyDraftStorageKey = 'student-writing-module-draft';

const writingThemes = [
  { year: 2025, title: 'Perspectivas acerca do envelhecimento na sociedade brasileira' },
  { year: 2024, title: 'Desafios para a valorização da herança africana no Brasil' },
  { year: 2023, title: 'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil' },
  { year: 2022, title: 'Desafios para a valorização de comunidades e povos tradicionais no Brasil' },
  { year: 2021, title: 'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil' },
  { year: 2020, title: 'O estigma associado às doenças mentais na sociedade brasileira' },
  { year: 2019, title: 'Democratização do acesso ao cinema no Brasil' },
  { year: 2018, title: 'Manipulação do comportamento do usuário pelo controle de dados na internet' },
  { year: 2017, title: 'Desafios para a formação educacional de surdos no Brasil' },
  { year: 2016, title: 'Caminhos para combater a intolerância religiosa no Brasil' },
];

const writingThemeTitles = writingThemes.map(({ title }) => title);

interface StoredDraft {
  id: string;
  name: string;
  theme: string;
  text: string;
  savedAt: number;
}

function isKnownTheme(theme: unknown): theme is string {
  return typeof theme === 'string' && writingThemeTitles.includes(theme);
}

function normalizeDraft(value: unknown, index: number): StoredDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<StoredDraft>;
  if (!isKnownTheme(draft.theme) || typeof draft.text !== 'string') return null;
  const savedAt = typeof draft.savedAt === 'number' && Number.isFinite(draft.savedAt) ? draft.savedAt : 0;
  const id = typeof draft.id === 'string' && draft.id ? draft.id : 'draft-' + savedAt + '-' + index;
  const name = typeof draft.name === 'string' && draft.name.trim() ? draft.name.trim() : 'Rascunho sem nome';
  return { id, name, theme: draft.theme, text: draft.text, savedAt };
}

function loadDrafts(): StoredDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const storedDrafts = window.localStorage.getItem(draftsStorageKey);
    if (storedDrafts) {
      const parsed = JSON.parse(storedDrafts);
      if (Array.isArray(parsed)) {
        return parsed
          .map((draft, index) => normalizeDraft(draft, index))
          .filter((draft): draft is StoredDraft => Boolean(draft))
          .sort((first, second) => second.savedAt - first.savedAt);
      }
    }

    const legacyDraft = window.localStorage.getItem(legacyDraftStorageKey);
    if (!legacyDraft) return [];
    const parsed = JSON.parse(legacyDraft) as { theme?: unknown; text?: unknown };
    if (!isKnownTheme(parsed.theme) || typeof parsed.text !== 'string') return [];
    return [{ id: 'legacy-draft', name: 'Rascunho anterior', theme: parsed.theme, text: parsed.text, savedAt: Date.now() }];
  } catch {
    return [];
  }
}

function persistDrafts(drafts: StoredDraft[]) {
  window.localStorage.setItem(draftsStorageKey, JSON.stringify(drafts));
}

function formatSavedAt(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp);
}

export default function WritingModulePage() {
  const initialDrafts = useMemo(loadDrafts, []);
  const initialDraft = initialDrafts[0];
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [theme, setTheme] = useState(initialDraft?.theme ?? writingThemes[0].title);
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [saveMessage, setSaveMessage] = useState('');
  const [isNamingDraft, setIsNamingDraft] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNameError, setDraftNameError] = useState('');
  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  const openSaveDialog = () => {
    setDraftName('');
    setDraftNameError('');
    setIsNamingDraft(true);
  };

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      setDraftNameError('Digite um nome para identificar este rascunho.');
      return;
    }

    const savedDraft: StoredDraft = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      name: name.slice(0, 80),
      theme,
      text,
      savedAt: Date.now(),
    };
    const nextDrafts = [savedDraft, ...drafts];
    setDrafts(nextDrafts);
    setSelectedDraftId(savedDraft.id);
    persistDrafts(nextDrafts);
    setIsNamingDraft(false);
    setSaveMessage('Rascunho "' + savedDraft.name + '" salvo neste dispositivo.');
  };

  const clearDraft = () => {
    setTheme(writingThemes[0].title);
    setText('');
    setSelectedDraftId(null);
    setSaveMessage('Editor limpo. Seus rascunhos salvos continuam disponíveis.');
  };

  const openDraft = (draft: StoredDraft) => {
    setSelectedDraftId(draft.id);
    setTheme(draft.theme);
    setText(draft.text);
    setSaveMessage('Rascunho "' + draft.name + '" aberto.');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Central de Estudos
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="min-w-0 space-y-6">
          <header className="rounded-2xl border border-blue-900/20 bg-[#073b78] p-5 text-white shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
                <PencilLine className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Módulo de redação</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Planeje, escreva e revise</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Pratique sua escrita em um espaço organizado. Este rascunho é de estudo e não representa uma nota oficial.</p>
              </div>
            </div>
          </header>

          <section aria-label="Editor de redação" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sua redação</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Escolha um tema e desenvolva suas ideias.</p>
              </div>
            </div>

            <label className="mt-6 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tema de prática
              <select
                aria-label="Tema de prática"
                value={theme}
                onChange={(event) => {
                  setTheme(event.target.value);
                  setSaveMessage('');
                }}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {writingThemes.map(({ title, year }) => (
                  <option key={year} value={title}>{title} — {year}</option>
                ))}
              </select>
            </label>

            <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Texto da redação
              <textarea
                aria-label="Texto da redação"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setSaveMessage('');
                }}
                placeholder="Comece pela sua introdução..."
                className="mt-2 min-h-80 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-base font-normal leading-7 text-slate-900 outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={clearDraft} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Limpar
                </button>
                <button type="button" onClick={openSaveDialog} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#004d9f]">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Salvar rascunho
                </button>
              </div>
            </div>
            {saveMessage ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{saveMessage}</p> : null}
          </section>
        </div>

        <aside aria-label="Rascunhos salvos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6 lg:sticky lg:top-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-300">
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Meus rascunhos</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Os mais recentes aparecem primeiro.</p>
            </div>
          </div>

          {drafts.length ? (
            <div className="mt-5 space-y-3">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  aria-label={'Abrir rascunho ' + draft.name}
                  onClick={() => openDraft(draft)}
                  className={'w-full rounded-xl border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/60 dark:hover:border-blue-500 dark:hover:bg-slate-800 ' + (selectedDraftId === draft.id ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700')}
                >
                  <span className="block truncate font-bold text-slate-900 dark:text-white">{draft.name}</span>
                  <span className="mt-2 flex items-start gap-2 text-xs leading-4 text-slate-500 dark:text-slate-400">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-2">{draft.theme}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatSavedAt(draft.savedAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Nenhum rascunho salvo ainda.</p>
              <p className="mt-1">Escreva sua redação e salve uma versão com um nome para encontrá-la aqui.</p>
            </div>
          )}
        </aside>
      </div>

      {isNamingDraft ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="draft-name-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="draft-name-title" className="text-xl font-bold text-slate-900 dark:text-white">Nomeie seu rascunho</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use um nome que ajude você a encontrar esta redação depois.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setIsNamingDraft(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form className="mt-5" onSubmit={saveDraft}>
              <label htmlFor="draft-name" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nome do rascunho</label>
              <input
                id="draft-name"
                autoFocus
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                  setDraftNameError('');
                }}
                placeholder="Ex.: Introdução sobre tecnologia"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              {draftNameError ? <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">{draftNameError}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setIsNamingDraft(false)} className="min-h-10 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#004d9f]">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Salvar rascunho
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
