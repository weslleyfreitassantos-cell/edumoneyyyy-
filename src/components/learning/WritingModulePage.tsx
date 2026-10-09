import { ChevronLeft, FileText, PencilLine, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const draftStorageKey = 'student-writing-module-draft';

const writingThemes = [
  'Tecnologia e aprendizagem na escola',
  'Participação dos jovens na comunidade',
  'A importância da leitura na formação cidadã',
];

interface StoredDraft {
  theme: string;
  text: string;
}

function loadDraft(): StoredDraft {
  if (typeof window === 'undefined') return { theme: writingThemes[0], text: '' };

  try {
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return { theme: writingThemes[0], text: '' };
    const parsed = JSON.parse(stored) as Partial<StoredDraft>;
    return {
      theme: writingThemes.includes(parsed.theme ?? '') ? parsed.theme ?? writingThemes[0] : writingThemes[0],
      text: typeof parsed.text === 'string' ? parsed.text : '',
    };
  } catch {
    return { theme: writingThemes[0], text: '' };
  }
}

export default function WritingModulePage() {
  const initialDraft = useMemo(loadDraft, []);
  const [theme, setTheme] = useState(initialDraft.theme);
  const [text, setText] = useState(initialDraft.text);
  const [saveMessage, setSaveMessage] = useState('');
  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  const saveDraft = () => {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ theme, text }));
    setSaveMessage('Rascunho salvo neste dispositivo.');
  };

  const clearDraft = () => {
    setText('');
    window.localStorage.removeItem(draftStorageKey);
    setSaveMessage('Rascunho limpo.');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Central de Estudos
      </Link>

      <header className="rounded-2xl border border-blue-900/20 bg-[#073b78] p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
            <PencilLine className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Módulo de redação</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Planeje, escreva e revise</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
              Pratique sua escrita em um espaço organizado. Este rascunho é de estudo e não representa uma nota oficial.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6">
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
              onChange={(event) => setTheme(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {writingThemes.map((item) => <option key={item}>{item}</option>)}
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
              <button type="button" onClick={saveDraft} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#004d9f]">
                <Save className="h-4 w-4" aria-hidden="true" />
                Salvar rascunho
              </button>
            </div>
          </div>
          {saveMessage ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{saveMessage}</p> : null}
        </section>

      </div>
    </div>
  );
}
