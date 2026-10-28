import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, CheckCircle2, Clock3, Flame, LockKeyhole, Play, RotateCcw, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useInstitution } from '../../contexts/InstitutionContext';
import EnglishExerciseCard from './EnglishExerciseCard';
import { isMissingTecEnglishRpc, tecEnglishService, tecLanguageDisplayName, tecLanguageLocale, tecLanguageName, type EnglishAnswerResult, type EnglishCourseMap, type EnglishLearningHome, type EnglishLessonSession, type EnglishLessonSummary, type EnglishSkillReview, type EnglishSkillReviewResult } from '../../services/tecEnglishService';
import type { TecLanguageLocale } from '../../lib/tecLanguage';

type Screen = 'map' | 'intro' | 'lesson' | 'result' | 'review';

const statusLabels = {
  AVAILABLE: 'Disponível',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  LOCKED: 'Bloqueada',
  REVIEW_PENDING: 'Em revisão',
} as const;

export default function EnglishLearningPage() {
  const { currentInstitutionId } = useInstitution();
  const [courseMap, setCourseMap] = useState<EnglishCourseMap | null>(null);
  const [learningHome, setLearningHome] = useState<EnglishLearningHome | null>(null);
  const [session, setSession] = useState<EnglishLessonSession | null>(null);
  const [skillReview, setSkillReview] = useState<EnglishSkillReview | null>(null);
  const [skillReviewResult, setSkillReviewResult] = useState<EnglishSkillReviewResult | null>(null);
  const [answerResult, setAnswerResult] = useState<EnglishAnswerResult | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<TecLanguageLocale>('en-US');
  const [screen, setScreen] = useState<Screen>('map');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [pageError, setPageError] = useState('');
  const pendingAnswer = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingReviewAnswer = useRef<{ fingerprint: string; key: string } | null>(null);

  const refreshMap = useCallback(async () => {
    if (!currentInstitutionId) {
      setCourseMap(null);
      setLearningHome(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setCourseMap(null);
    setLearningHome(null);
    setPageError('');
    try {
      const [mapResult, homeResult] = await Promise.allSettled([
        Promise.resolve().then(() => tecEnglishService.getLegacyMap(currentInstitutionId)),
        Promise.resolve().then(() => tecEnglishService.getLearningHome(currentInstitutionId)),
      ]);
      if (mapResult.status === 'rejected') throw mapResult.reason;
      setCourseMap(mapResult.value);
      const maps = [mapResult.value, ...(mapResult.value.additional_courses ?? [])];
      const languages = [...new Set(maps.map((course) => tecLanguageLocale(course.course.code)))];
      setSelectedLanguage((current) => languages.includes(current) ? current : languages[0] ?? 'en-US');
      setLearningHome(homeResult.status === 'fulfilled' ? homeResult.value : null);
      const warnings: string[] = [];
      if (mapResult.value.additional_courses_error) {
        warnings.push('Não foi possível verificar a disponibilidade do curso adaptativo. O percurso atual continua disponível.');
      }
      if (homeResult.status === 'rejected' && !isMissingTecEnglishRpc(homeResult.reason)) {
        warnings.push('Não foi possível atualizar suas revisões adaptativas. Seu progresso no curso continua disponível.');
      }
      if (warnings.length) setPageError(warnings.join(' '));
    } catch {
      setPageError('Não foi possível carregar seu caminho de inglês agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [currentInstitutionId]);

  useEffect(() => {
    setScreen('map');
    setSession(null);
    setAnswerResult(null);
    void refreshMap();
  }, [refreshMap]);

  const courseMaps = useMemo(() => courseMap ? [courseMap, ...(courseMap.additional_courses ?? [])] : [], [courseMap]);
  const availableLanguages = useMemo(() => [...new Set(courseMaps.map((course) => tecLanguageLocale(course.course.code)))], [courseMaps]);
  const selectedCourseMaps = useMemo(() => courseMaps.filter((course) => tecLanguageLocale(course.course.code) === selectedLanguage), [courseMaps, selectedLanguage]);
  const allLessons = useMemo(() => selectedCourseMaps.flatMap((course) => course.units.flatMap((unit) => unit.lessons)), [selectedCourseMaps]);
  const continueLesson = allLessons.find((lesson) => lesson.status === 'IN_PROGRESS')
    ?? allLessons.find((lesson) => lesson.status === 'AVAILABLE');
  const totalLessons = selectedCourseMaps.reduce((sum, course) => sum + course.total_lessons, 0);
  const completedLessons = selectedCourseMaps.reduce((sum, course) => sum + course.completed_lessons, 0);
  const totalXp = selectedCourseMaps.reduce((sum, course) => sum + course.stats.xp, 0);
  const longestActiveStreak = selectedCourseMaps.reduce((longest, course) => Math.max(longest, course.stats.current_streak), 0);
  const progressPercent = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  async function openLesson(lesson: EnglishLessonSummary) {
    if (!currentInstitutionId || lesson.status === 'LOCKED' || lesson.status === 'REVIEW_PENDING') return;
    setPageError('');
    setSubmitting(true);
    try {
      const opened = lesson.course_code
        ? await tecEnglishService.startLesson(currentInstitutionId, lesson.id, lesson.course_code)
        : await tecEnglishService.startLesson(currentInstitutionId, lesson.id);
      pendingAnswer.current = null;
      setSession({ ...opened, course_code: lesson.course_code ?? opened.course_code });
      setAnswerResult(null);
      setResetToken((value) => value + 1);
      setScreen(opened.current_position > 1 ? 'lesson' : 'intro');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('TEC_ENGLISH_CONTENT_NOT_APPROVED')) {
        setPageError('Esta lição ainda está aguardando revisão pedagógica.');
      } else if (message.includes('TEC_ENGLISH_LESSON_LOCKED')) {
        setPageError('Conclua a etapa anterior para desbloquear esta lição.');
      } else {
        setPageError('Não foi possível abrir esta lição. Seu progresso continua salvo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer(response: Record<string, unknown>) {
    if (!currentInstitutionId || !session?.exercise) return;
    setSubmitting(true);
    setPageError('');
    const fingerprint = JSON.stringify(response);
    if (pendingAnswer.current?.fingerprint !== fingerprint) {
      pendingAnswer.current = { fingerprint, key: crypto.randomUUID() };
    }
    try {
      const result = await tecEnglishService.submitAnswer(
        currentInstitutionId,
        session.session_id,
        session.exercise.id,
        response,
        pendingAnswer.current.key,
        session.course_code,
      );
      pendingAnswer.current = null;
      setAnswerResult(result);
      if (result.session_complete) {
        setScreen('result');
        await refreshMap();
      }
    } catch {
      setPageError('Não foi possível conferir a resposta. Confira sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function continueAfterAnswer() {
    if (!answerResult?.is_correct || !session) return;
    if (answerResult.session_complete) {
      setScreen('result');
      return;
    }
    if (!answerResult.next_exercise) {
      setPageError('Não foi possível carregar o próximo desafio. Seu progresso está salvo; retome a lição pelo mapa.');
      setScreen('map');
      setSession(null);
      await refreshMap();
      return;
    }
    setSession({
      ...session,
      current_position: answerResult.next_position,
      exercise: answerResult.next_exercise,
    });
    setAnswerResult(null);
    setResetToken((value) => value + 1);
  }

  async function returnToMap() {
    setScreen('map');
    setSession(null);
    setSkillReview(null);
    setSkillReviewResult(null);
    setAnswerResult(null);
    await refreshMap();
  }

  async function startSkillReview(skillCode: string) {
    if (!currentInstitutionId) return;
    setPageError('');
    setSubmitting(true);
    try {
      setSkillReview(await tecEnglishService.startSkillReview(currentInstitutionId, skillCode));
      setSkillReviewResult(null);
      pendingReviewAnswer.current = null;
      setResetToken((value) => value + 1);
      setScreen('review');
    } catch (error) {
      const unavailable = error instanceof Error && error.message.includes('TEC_ENGLISH_REVIEW_CONTENT_UNAVAILABLE');
      setPageError(unavailable ? 'Ainda não há uma atividade publicada para esta revisão.' : 'Não foi possível iniciar a revisão agora.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSkillReview(response: Record<string, unknown>) {
    if (!currentInstitutionId || !skillReview) return;
    const fingerprint = JSON.stringify(response);
    if (pendingReviewAnswer.current?.fingerprint !== fingerprint) {
      pendingReviewAnswer.current = { fingerprint, key: crypto.randomUUID() };
    }
    setSubmitting(true);
    setPageError('');
    try {
      const result = await tecEnglishService.submitSkillReview(currentInstitutionId, skillReview.skill_code, response, pendingReviewAnswer.current.key);
      pendingReviewAnswer.current = null;
      setSkillReviewResult(result);
      if (result.is_correct) await refreshMap();
    } catch {
      setPageError('Não foi possível conferir a revisão. Sua resposta pode ser enviada novamente com segurança.');
    } finally {
      setSubmitting(false);
    }
  }

  const lessonButtonLabel = (lesson: EnglishLessonSummary): string => {
    if (lesson.status === 'IN_PROGRESS') return 'Continuar lição';
    if (lesson.status === 'COMPLETED') return 'Revisar lição';
    if (lesson.status === 'REVIEW_PENDING') return 'Aguardando revisão';
    if (lesson.status === 'LOCKED') return 'Bloqueada';
    return 'Começar lição';
  };

  if (screen === 'review' && skillReview) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-5 px-1 pb-10">
        <button type="button" onClick={() => void returnToMap()} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao percurso
        </button>
        <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900 dark:bg-slate-900 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Revisão espaçada</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{skillReview.label}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Pratique de novo no nível adequado ao seu progresso. A revisão não altera o XP das lições.</p>
          {skillReviewResult ? (
            <div className={`my-6 rounded-2xl border p-4 ${skillReviewResult.is_correct ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'}`} role="status">
              <p className="text-lg font-extrabold">{skillReviewResult.feedback}</p>
              <p className="mt-2 leading-6">{skillReviewResult.explanation}</p>
              {skillReviewResult.is_correct ? <p className="mt-2 text-sm">Próxima revisão: {new Date(skillReviewResult.next_review_at).toLocaleDateString('pt-BR')} · domínio {skillReviewResult.mastery_score}%</p> : null}
            </div>
          ) : (
          <EnglishExerciseCard exercise={skillReview.exercise} attemptSeed={`${skillReview.skill_code}:${skillReview.exercise.id}:${resetToken}`} resetToken={resetToken} disabled={submitting} onSubmit={(response) => void submitSkillReview(response)} />
          )}
          {skillReviewResult?.is_correct ? <button type="button" onClick={() => void returnToMap()} className="mt-4 min-h-12 rounded-xl bg-violet-700 px-5 py-3 font-extrabold text-white hover:bg-violet-800">Concluir revisão</button> : null}
          {skillReviewResult && !skillReviewResult.is_correct ? <button type="button" onClick={() => { setSkillReviewResult(null); setResetToken((value) => value + 1); }} className="mt-4 min-h-12 rounded-xl bg-amber-600 px-5 py-3 font-extrabold text-white hover:bg-amber-700">Tentar novamente</button> : null}
          {pageError ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{pageError}</p> : null}
        </section>
      </main>
    );
  }

  if (screen === 'intro' && session) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 px-1 pb-10">
        <button type="button" onClick={() => void returnToMap()} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao mapa
        </button>
        <section className="rounded-3xl border border-sky-200 bg-white p-6 shadow-sm dark:border-sky-900 dark:bg-slate-900 sm:p-9">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">{session.unit_title}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">{session.lesson_title}</h1>
          <p className="mt-4 text-lg leading-7 text-slate-700 dark:text-slate-200">{session.lesson_intro}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="rounded-full bg-sky-50 px-3 py-2 dark:bg-sky-950/50">{session.total_exercises} desafios curtos</span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">Você pode tentar de novo</span>
          </div>
          <button type="button" disabled={submitting} onClick={() => setScreen('lesson')} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#075ec8] px-6 py-3 font-extrabold text-white shadow-sm hover:bg-[#064ea6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60">
            <Play className="h-5 w-5" aria-hidden="true" /> Começar os desafios
          </button>
        </section>
      </main>
    );
  }

  if (screen === 'lesson' && session?.exercise) {
    const percentage = Math.round(((session.current_position - 1) / session.total_exercises) * 100);
    return (
      <main className="mx-auto w-full max-w-3xl space-y-5 px-1 pb-10">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => void returnToMap()} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Sair da lição
          </button>
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{session.lesson_title}</span>
        </div>
        <div className="rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-label={`Progresso da lição: desafio ${session.current_position} de ${session.total_exercises}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
          <div className="h-2.5 rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
        <p className="text-right text-sm font-semibold text-slate-600 dark:text-slate-300">Desafio {session.current_position} de {session.total_exercises}</p>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          {answerResult ? (
            <div className={`mb-6 rounded-2xl border p-4 ${answerResult.is_correct ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'}`} role="status">
              <p className="text-lg font-extrabold">{answerResult.feedback}</p>
              <p className="mt-2 leading-6">{answerResult.explanation}</p>
            </div>
          ) : null}
          {answerResult?.is_correct ? (
            <button type="button" onClick={() => void continueAfterAnswer()} className="min-h-12 rounded-xl bg-emerald-600 px-6 py-3 font-extrabold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
              {answerResult.session_complete ? 'Ver resultado' : 'Próximo desafio'}
            </button>
          ) : answerResult ? (
            <button type="button" onClick={() => { setAnswerResult(null); setResetToken((value) => value + 1); }} className="min-h-12 rounded-xl bg-amber-600 px-6 py-3 font-extrabold text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
              Tentar novamente
            </button>
          ) : (
            <EnglishExerciseCard exercise={session.exercise} courseCode={session.course_code} attemptSeed={session.session_id} resetToken={resetToken} disabled={submitting} onSubmit={(response) => void submitAnswer(response)} />
          )}
        </section>
        {pageError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{pageError}</p> : null}
      </main>
    );
  }

  if (screen === 'result' && session && answerResult) {
    return (
      <main className="mx-auto w-full max-w-3xl px-1 pb-10">
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-7 text-center shadow-sm dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-900 sm:p-10">
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-8 w-8" aria-hidden="true" /></span>
          <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-200">Lição concluída</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">{session.lesson_title}</h1>
          <p className="mt-3 text-slate-700 dark:text-slate-200">Você concluiu os desafios desta etapa.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900"><Sparkles className="mx-auto h-5 w-5 text-amber-500" aria-hidden="true" /><p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">+{answerResult.xp_awarded} XP</p><p className="text-xs text-slate-600 dark:text-slate-300">Pontuação exclusiva deste curso</p></div>
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900"><BookOpen className="mx-auto h-5 w-5 text-sky-600" aria-hidden="true" /><p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{answerResult.total_xp} XP</p><p className="text-xs text-slate-600 dark:text-slate-300">Total neste curso</p></div>
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900"><Flame className="mx-auto h-5 w-5 text-rose-500" aria-hidden="true" /><p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{answerResult.current_streak} {answerResult.current_streak === 1 ? 'dia' : 'dias'}</p><p className="text-xs text-slate-600 dark:text-slate-300">Sequência de estudo</p></div>
          </div>
          <button type="button" onClick={() => void returnToMap()} className="mt-8 min-h-12 rounded-xl bg-[#075ec8] px-6 py-3 font-extrabold text-white hover:bg-[#064ea6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Voltar ao mapa</button>
        </section>
      </main>
    );
  }

  const reviewPending = allLessons.some((lesson) => lesson.status === 'REVIEW_PENDING');

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-1 pb-10">
      <Link to="/student/study" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Central de Estudos
      </Link>

      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-800 p-6 text-white shadow-sm sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-100">Tec Idiomas · {tecLanguageDisplayName(selectedCourseMaps[0]?.course.code)}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{selectedCourseMaps[0]?.course.title ?? 'Aprenda idiomas passo a passo'}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">{selectedCourseMaps[0]?.course.description ?? 'Pratique vocabulário, frases e conversas curtas no seu ritmo.'}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-50"><Sparkles className="h-4 w-4" aria-hidden="true" /> XP nos percursos</p><p className="mt-2 text-2xl font-extrabold">{totalXp} XP</p></div>
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-50"><Flame className="h-4 w-4" aria-hidden="true" /> Maior sequência</p><p className="mt-2 text-2xl font-extrabold">{longestActiveStreak} {longestActiveStreak === 1 ? 'dia' : 'dias'}</p></div>
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Caminho</p><p className="mt-2 text-2xl font-extrabold">{completedLessons} de {totalLessons} lições</p></div>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label={`Progresso do curso: ${progressPercent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="h-full rounded-full bg-emerald-300 transition-[width]" style={{ width: `${progressPercent}%` }} />
        </div>
        {continueLesson && continueLesson.status !== 'REVIEW_PENDING' ? (
          <button type="button" disabled={submitting} onClick={() => void openLesson(continueLesson)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 font-extrabold text-sky-900 shadow-sm hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">
            <Play className="h-4 w-4" aria-hidden="true" /> {continueLesson.status === 'IN_PROGRESS' ? 'Continuar de onde parei' : 'Começar próxima lição'}
          </button>
        ) : null}
      </header>

      {availableLanguages.length > 1 ? (
        <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-900 dark:bg-slate-900" aria-label="Seleção de idioma">
          <label htmlFor="tec-idiomas-language" className="block text-sm font-extrabold text-slate-900 dark:text-white">Escolha seu idioma</label>
          <select
            id="tec-idiomas-language"
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value as TecLanguageLocale)}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:max-w-md"
          >
            {availableLanguages.map((language) => {
              const course = courseMaps.find((item) => tecLanguageLocale(item.course.code) === language);
              return <option key={language} value={language}>{tecLanguageDisplayName(course?.course.code)}</option>;
            })}
          </select>
        </section>
      ) : null}

      {learningHome ? (
        <section aria-labelledby="english-daily-title" className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900 dark:bg-slate-900 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300"><Target className="h-4 w-4" aria-hidden="true" /> Aprendizado adaptativo</p><h2 id="english-daily-title" className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">Seu próximo passo</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Revisões e nível de desafio ajustados ao seu histórico.</p></div>
            <span className="rounded-full bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">{learningHome.due_reviews} {learningHome.due_reviews === 1 ? 'revisão para hoje' : 'revisões para hoje'}</span>
          </div>
          {learningHome.weak_skills.length ? <div className="mt-4 flex flex-wrap gap-2" aria-label="Habilidades para fortalecer">{learningHome.weak_skills.map((skill) => <span key={skill.skill_code} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{skill.label} · {Math.round(skill.mastery_score)}%</span>)}</div> : <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Complete desafios para montar seu plano personalizado de revisão.</p>}
          {learningHome.due_skills[0] ? <button type="button" disabled={submitting} onClick={() => void startSkillReview(learningHome.due_skills[0].skill_code)} className="mt-5 min-h-11 rounded-xl bg-violet-700 px-5 py-2.5 font-extrabold text-white hover:bg-violet-800 disabled:opacity-60">Começar revisão de {learningHome.due_skills[0].label}</button> : null}
        </section>
      ) : null}

      {reviewPending ? (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          O curso está em revisão pedagógica. As unidades e lições ficam visíveis; o início das atividades será liberado quando o conteúdo for aprovado e publicado.
        </p>
      ) : null}
      {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Carregando seus percursos de idiomas…</p> : null}
      {pageError && screen === 'map' ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{pageError}</p> : null}

      {!loading && courseMap ? (
        <section aria-labelledby="english-map-title" className="space-y-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Seu percurso</p>
            <h2 id="english-map-title" className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">Percursos de idiomas</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Conclua uma etapa para abrir a próxima. O progresso e o XP permanecem separados por curso.</p>
          </div>
          {selectedCourseMaps.map((course) => (
            <div key={course.course.code} className="space-y-5">
              {course.course.code !== courseMap.course.code ? (
                <div className="pt-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">{tecLanguageName(course.course.code).toLocaleUpperCase('pt-BR')}</p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">{course.course.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{course.course.description}</p>
                </div>
              ) : null}
              {course.units.map((unit) => {
                const unitCompleted = unit.lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
                return (
                  <section key={unit.id} aria-labelledby={`unit-${unit.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Unidade {unit.position}</p><h3 id={`unit-${unit.id}`} className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">{unit.title}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{unit.description}</p></div>
                      <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">{unitCompleted} de {unit.lessons.length}</span>
                    </div>
                    <ol className="relative mt-6 space-y-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                      {unit.lessons.map((lesson) => {
                        const blocked = lesson.status === 'LOCKED' || lesson.status === 'REVIEW_PENDING';
                        const lessonIcon = lesson.status === 'COMPLETED' ? <Check className="h-5 w-5" aria-hidden="true" />
                          : lesson.status === 'LOCKED' ? <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                            : lesson.status === 'IN_PROGRESS' ? <Clock3 className="h-5 w-5" aria-hidden="true" />
                              : <BookOpen className="h-5 w-5" aria-hidden="true" />;
                        return (
                          <li key={lesson.id} className="relative flex items-center gap-3">
                            <span className={`z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-white ${lesson.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : lesson.status === 'IN_PROGRESS' ? 'bg-sky-700 text-white' : lesson.status === 'LOCKED' ? 'bg-slate-200 text-slate-500 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-300' : 'bg-sky-100 text-sky-800 dark:border-slate-900 dark:bg-sky-950 dark:text-sky-200'}`}>{lessonIcon}</span>
                            <article className={`flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${lesson.status === 'IN_PROGRESS' ? 'border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                              <div className="min-w-[12rem] flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-extrabold text-slate-950 dark:text-white">{lesson.position}. {lesson.title}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100' : lesson.status === 'REVIEW_PENDING' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100' : lesson.status === 'LOCKED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100'}`}>{statusLabels[lesson.status]}</span></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{lesson.exercise_count} desafios · {lesson.xp_reward} XP ao concluir pela primeira vez</p></div>
                              <button type="button" disabled={blocked || submitting || loading} onClick={() => void openLesson(lesson)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-700 px-4 py-2 text-sm font-extrabold text-sky-800 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-transparent dark:border-sky-400 dark:text-sky-200 dark:disabled:border-slate-700 dark:disabled:text-slate-500">
                                {lesson.status === 'COMPLETED' ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : lesson.status === 'IN_PROGRESS' || lesson.status === 'AVAILABLE' ? <Play className="h-4 w-4" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}{lessonButtonLabel(lesson)}
                              </button>
                            </article>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
