import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Globe2 } from 'lucide-react';

import unitedStatesFlag from '../../assets/flags/us.svg';
import spainFlag from '../../assets/flags/es.svg';
import southKoreaFlag from '../../assets/flags/kr.svg';
import { tecLanguageDisplayName, tecLanguageLocale, type EnglishCourseMap } from '../../services/tecEnglishService';
import type { TecLanguageLocale } from '../../lib/tecLanguage';

interface LanguageCourseSwitcherProps {
  courses: EnglishCourseMap[];
  selectedLanguage: TecLanguageLocale;
  onSelect: (language: TecLanguageLocale) => void;
  loading?: boolean;
}

const flagSources: Partial<Record<TecLanguageLocale, string>> = {
  'en-US': unitedStatesFlag,
  'es-ES': spainFlag,
  'ko-KR': southKoreaFlag,
};

export default function LanguageCourseSwitcher({
  courses,
  selectedLanguage,
  onSelect,
  loading = false,
}: LanguageCourseSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const options = courses.filter((course, index, all) =>
    all.findIndex((candidate) => tecLanguageLocale(candidate.course.code) === tecLanguageLocale(course.course.code)) === index,
  );
  const selectedIndex = Math.max(0, options.findIndex((course) => tecLanguageLocale(course.course.code) === selectedLanguage));
  const selectedCourse = options[selectedIndex];
  const selectedName = selectedCourse ? tecLanguageDisplayName(selectedCourse.course.code) : null;
  const selectedFlag = selectedCourse ? flagSources[tecLanguageLocale(selectedCourse.course.code)] : undefined;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedIndex]?.focus();
  }, [open, selectedIndex]);

  function selectCourse(course: EnglishCourseMap) {
    onSelect(tecLanguageLocale(course.course.code));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open && options.length > 0) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative z-30 w-full shrink-0 sm:w-auto"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={selectedName ? `Escolher idioma: ${selectedName}` : 'Escolher idioma'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={loading || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/35 bg-white/15 px-4 py-2.5 text-left font-extrabold text-white shadow-sm backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:min-w-48"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="inline-flex w-8 shrink-0 items-center justify-center">
            {selectedFlag ? (
              <img src={selectedFlag} alt="" aria-hidden="true" className="h-auto w-8 rounded-[3px] border border-white/70 shadow-sm" />
            ) : <Globe2 className="h-5 w-5" />}
          </span>
          <span className="truncate">{loading ? 'Carregando idiomas…' : selectedName ?? 'Idiomas indisponíveis'}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 max-h-[min(22rem,calc(100dvh-6rem))] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <p className="px-3 pb-2 pt-1 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Meus idiomas</p>
          <div id={listboxId} role="listbox" aria-label="Meus idiomas">
            {options.map((course, index) => {
              const locale = tecLanguageLocale(course.course.code);
              const selected = locale === selectedLanguage;
              const languageName = tecLanguageDisplayName(course.course.code);
              const stats = `${course.completed_lessons} concluídas · ${course.stats.xp} XP`;
              return (
                <button
                  key={course.course.code}
                  ref={(element) => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${languageName}, ${stats}`}
                  onClick={() => selectCourse(course)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  className={`flex min-h-[3.75rem] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${selected ? 'bg-sky-50 text-sky-950 dark:bg-sky-950/60 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <span aria-hidden="true" className="inline-flex w-8 shrink-0 items-center justify-center">
                    {flagSources[locale] ? (
                      <img src={flagSources[locale]} alt="" aria-hidden="true" className="h-auto w-8 rounded-[3px] border border-slate-200 shadow-sm" />
                    ) : <Globe2 className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold">{languageName}</span>
                    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{stats}</span>
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
