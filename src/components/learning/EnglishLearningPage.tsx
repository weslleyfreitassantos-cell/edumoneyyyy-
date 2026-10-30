import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Clock3, Flame, LockKeyhole, Play, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  getFirstPlacementQuestion,
  getNextPlacementQuestion,
  getRecommendedUnitPosition,
  getPlacementQuestion,
  isPlacementRecord,
  supportsPlacementAssessment,
  PLACEMENT_QUESTION_LIMIT,
  type PlacementAnswer,
  type PlacementDifficulty,
  type PlacementRecord,
  type PlacementQuestion,
} from '../../lib/tecIdiomasPlacement';
import EnglishExerciseCard from './EnglishExerciseCard';
import LanguageCourseSwitcher from './LanguageCourseSwitcher';
import { tecEnglishService, tecLanguageDisplayName, tecLanguageLocale, tecLanguagePlacementCourseCode, type EnglishAnswerResult, type EnglishCourseMap, type EnglishLessonSession, type EnglishLessonSummary } from '../../services/tecEnglishService';
import type { TecLanguageLocale } from '../../lib/tecLanguage';

type Screen = 'map' | 'intro' | 'lesson' | 'result';
type PlacementMode = 'WELCOME' | 'QUESTION' | 'FEEDBACK' | 'RESULT' | 'CLOSED';

interface PlacementFlow {
  scopeKey: string;
  attemptId: string | null;
  mode: PlacementMode;
  record: PlacementRecord | null;
  questionId: string | null;
  selectedOption: number | null;
  answers: PlacementAnswer[];
  highestDifficulty: PlacementDifficulty;
  feedback: { question: PlacementQuestion; isCorrect: boolean; nextQuestionId: string | null } | null;
  openedManually: boolean;
}

type PlacementSyncStatus = 'loading' | 'saving' | 'synced' | 'local' | 'error';
type ResetRequest = 'course' | 'activity' | null;

const RESETTABLE_ACTIVITY_COURSES = new Set([
  'TEC_ENGLISH_FOUNDATIONS',
  'TEC_ENGLISH_FOUNDATIONS_V2',
  'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
  'TEC_SPANISH_FOUNDATIONS_V1',
  'TEC_KOREAN_FOUNDATIONS_V1',
  'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
  'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
  'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
]);

const statusLabels = {
  AVAILABLE: 'Disponível',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  LOCKED: 'Bloqueada',
  REVIEW_PENDING: 'Indisponível',
} as const;

function languagePreferenceKey(profileId: string, institutionId: string): string {
  return `tec-escola:tec-idiomas:language:${profileId}:${institutionId}`;
}

function readLanguagePreference(profileId?: string, institutionId?: string): TecLanguageLocale | null {
  if (!profileId || !institutionId || typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(languagePreferenceKey(profileId, institutionId));
    return stored === 'en-US' || stored === 'es-ES' || stored === 'ko-KR' ? stored : null;
  } catch {
    return null;
  }
}

function writeLanguagePreference(profileId: string, institutionId: string, language: TecLanguageLocale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(languagePreferenceKey(profileId, institutionId), language);
  } catch {
    // A seleção continua funcional mesmo quando o armazenamento local está indisponível.
  }
}

function placementStorageKey(profileId: string, institutionId: string, language: TecLanguageLocale): string {
  return `tec-escola:tec-idiomas:placement:v1:${profileId}:${institutionId}:${language}`;
}

function placementAttemptStorageKey(key: string): string {
  return `${key}:attempt-id`;
}

function readPlacementRecord(key: string): PlacementRecord | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return isPlacementRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function writePlacementRecord(key: string, record: PlacementRecord): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // O diagnóstico continua útil nesta sessão quando o armazenamento local não está disponível.
  }
}

function readPlacementAttemptId(key: string): string | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(placementAttemptStorageKey(key));
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writePlacementAttempt(key: string, attemptId: string, record: PlacementRecord): void {
  writePlacementRecord(key, record);
  try {
    window.localStorage.setItem(placementAttemptStorageKey(key), attemptId);
  } catch {
    // The server request remains authoritative even when local storage is unavailable.
  }
}

function createPlacementFlow(scopeKey: string, record: PlacementRecord | null, openedManually = false): PlacementFlow {
  return {
    scopeKey,
    attemptId: null,
    mode: record ? 'CLOSED' : 'WELCOME',
    record,
    questionId: null,
    selectedOption: null,
    answers: [],
    highestDifficulty: 1,
    feedback: null,
    openedManually,
  };
}

export default function EnglishLearningPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [courseMap, setCourseMap] = useState<EnglishCourseMap | null>(null);
  const [session, setSession] = useState<EnglishLessonSession | null>(null);
  const [answerResult, setAnswerResult] = useState<EnglishAnswerResult | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<TecLanguageLocale>('en-US');
  const [placementFlow, setPlacementFlow] = useState<PlacementFlow | null>(null);
  const [placementSync, setPlacementSync] = useState<{ scopeKey: string; status: PlacementSyncStatus }>({ scopeKey: '', status: 'loading' });
  const [screen, setScreen] = useState<Screen>('map');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetRequest, setResetRequest] = useState<ResetRequest>(null);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetToken, setResetToken] = useState(0);
  const [pageError, setPageError] = useState('');
  const pendingAnswer = useRef<{ fingerprint: string; key: string } | null>(null);
  const profileId = profile?.id;
  const currentPlacementKey = profileId && currentInstitutionId
    ? placementStorageKey(profileId, currentInstitutionId, selectedLanguage)
    : '';

  useEffect(() => {
    if (!currentPlacementKey) {
      setPlacementFlow(null);
      setPlacementSync({ scopeKey: '', status: 'loading' });
      return;
    }
    let active = true;
    const cachedRecord = readPlacementRecord(currentPlacementKey);
    setPlacementFlow({
      ...createPlacementFlow(currentPlacementKey, cachedRecord),
      attemptId: readPlacementAttemptId(currentPlacementKey),
    });
    setPlacementSync({ scopeKey: currentPlacementKey, status: 'loading' });
    if (!currentInstitutionId) {
      setPlacementSync({ scopeKey: currentPlacementKey, status: 'error' });
      return () => { active = false; };
    }

    const courseCode = tecLanguagePlacementCourseCode(selectedLanguage);
    void (async () => {
      try {
        const persisted = await tecEnglishService.getPlacement(currentInstitutionId, courseCode);
        if (!active) return;
        if (persisted.record && persisted.attemptId) {
          const cachedAttemptId = readPlacementAttemptId(currentPlacementKey);
          const cachedIsNewer = cachedRecord !== null
            && cachedAttemptId !== persisted.attemptId
            && Date.parse(cachedRecord.completedAt) > Date.parse(persisted.record.completedAt);
          if (cachedRecord && cachedIsNewer) {
            const attemptId = cachedAttemptId ?? crypto.randomUUID();
            writePlacementAttempt(currentPlacementKey, attemptId, cachedRecord);
            setPlacementFlow({ ...createPlacementFlow(currentPlacementKey, cachedRecord), attemptId });
            setPlacementSync({ scopeKey: currentPlacementKey, status: 'saving' });
            try {
              const reconciled = await tecEnglishService.savePlacement(currentInstitutionId, courseCode, attemptId, cachedRecord);
              if (!active) return;
              writePlacementAttempt(currentPlacementKey, reconciled.attemptId, reconciled.record);
              setPlacementFlow({ ...createPlacementFlow(currentPlacementKey, reconciled.record), attemptId: reconciled.attemptId });
              setPlacementSync({ scopeKey: currentPlacementKey, status: 'synced' });
            } catch {
              if (active) setPlacementSync({ scopeKey: currentPlacementKey, status: 'local' });
            }
            return;
          }
          writePlacementAttempt(currentPlacementKey, persisted.attemptId, persisted.record);
          setPlacementFlow({ ...createPlacementFlow(currentPlacementKey, persisted.record), attemptId: persisted.attemptId });
          setPlacementSync({ scopeKey: currentPlacementKey, status: 'synced' });
          return;
        }
        if (cachedRecord) {
          const attemptId = readPlacementAttemptId(currentPlacementKey) ?? crypto.randomUUID();
          writePlacementAttempt(currentPlacementKey, attemptId, cachedRecord);
          setPlacementFlow({ ...createPlacementFlow(currentPlacementKey, cachedRecord), attemptId });
          setPlacementSync({ scopeKey: currentPlacementKey, status: 'saving' });
          try {
            const migrated = await tecEnglishService.savePlacement(currentInstitutionId, courseCode, attemptId, cachedRecord);
            if (!active) return;
            writePlacementAttempt(currentPlacementKey, migrated.attemptId ?? attemptId, migrated.record ?? cachedRecord);
            setPlacementFlow({ ...createPlacementFlow(currentPlacementKey, migrated.record ?? cachedRecord), attemptId: migrated.attemptId ?? attemptId });
            setPlacementSync({ scopeKey: currentPlacementKey, status: 'synced' });
          } catch {
            if (active) setPlacementSync({ scopeKey: currentPlacementKey, status: 'local' });
          }
          return;
        }
        setPlacementFlow(createPlacementFlow(currentPlacementKey, null));
        setPlacementSync({ scopeKey: currentPlacementKey, status: 'synced' });
      } catch {
        if (!active) return;
        setPlacementFlow({
          ...createPlacementFlow(currentPlacementKey, cachedRecord),
          attemptId: readPlacementAttemptId(currentPlacementKey),
        });
        setPlacementSync({ scopeKey: currentPlacementKey, status: cachedRecord ? 'local' : 'error' });
      }
    })();

    return () => { active = false; };
  }, [currentInstitutionId, currentPlacementKey, selectedLanguage]);

  const refreshMap = useCallback(async () => {
    if (!currentInstitutionId) {
      setCourseMap(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setCourseMap(null);
    setPageError('');
    try {
      const map = await tecEnglishService.getMap(currentInstitutionId);
      setCourseMap(map);
      const maps = [map, ...(map.additional_courses ?? [])];
      const languages = [...new Set(maps.map((course) => tecLanguageLocale(course.course.code)))];
      const preferredLanguage = readLanguagePreference(profileId, currentInstitutionId);
      setSelectedLanguage((current) => preferredLanguage && languages.includes(preferredLanguage)
        ? preferredLanguage
        : languages.includes(current) ? current : languages[0] ?? 'en-US');
      const warnings: string[] = [];
      if (map.additional_courses_error) {
        warnings.push('Alguns idiomas não puderam ser carregados agora. Atualize a página para tentar novamente.');
      }
      if (warnings.length) setPageError(warnings.join(' '));
    } catch {
      setPageError('Não foi possível carregar seus percursos de idiomas agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [currentInstitutionId, profileId]);

  useEffect(() => {
    setScreen('map');
    setSession(null);
    setAnswerResult(null);
    void refreshMap();
  }, [refreshMap]);

  const courseMaps = useMemo(() => courseMap ? [courseMap, ...(courseMap.additional_courses ?? [])] : [], [courseMap]);
  const selectedCourseMaps = useMemo(() => courseMaps.filter((course) => tecLanguageLocale(course.course.code) === selectedLanguage), [courseMaps, selectedLanguage]);
  const allLessons = useMemo(() => selectedCourseMaps.flatMap((course) => course.units.flatMap((unit) => unit.lessons)), [selectedCourseMaps]);
  const continueLesson = allLessons.find((lesson) => lesson.status === 'IN_PROGRESS')
    ?? allLessons.find((lesson) => lesson.status === 'AVAILABLE');
  const totalLessons = selectedCourseMaps.reduce((sum, course) => sum + course.total_lessons, 0);
  const completedLessons = selectedCourseMaps.reduce((sum, course) => sum + course.completed_lessons, 0);
  const totalXp = selectedCourseMaps.reduce((sum, course) => sum + course.stats.xp, 0);
  const progressPercent = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;
  const activeCourse = selectedCourseMaps[0];
  const activeLanguageName = activeCourse ? tecLanguageDisplayName(activeCourse.course.code) : 'Tec Idiomas';
  const placementAssessmentAvailable = supportsPlacementAssessment(selectedLanguage);
  const hasCourseProgress = allLessons.some((lesson) => lesson.status === 'IN_PROGRESS' || lesson.status === 'COMPLETED');
  const activePlacementFlow = placementFlow?.scopeKey === currentPlacementKey ? placementFlow : null;
  const placementRecord = activePlacementFlow?.record ?? null;
  const activePlacementSyncStatus = placementSync.scopeKey === currentPlacementKey ? placementSync.status : 'loading';
  const showFirstUsePlacement = screen === 'map'
    && !loading
    && !hasCourseProgress
    && continueLesson?.status === 'AVAILABLE'
    && activePlacementSyncStatus !== 'loading'
    && !placementRecord;
  const showPlacementPanel = screen === 'map'
    && !loading
    && Boolean(activePlacementFlow)
    && activePlacementFlow?.mode !== 'CLOSED'
    && (showFirstUsePlacement || Boolean(activePlacementFlow?.openedManually) || activePlacementFlow?.mode === 'RESULT');
  const currentPlacementQuestion = activePlacementFlow?.questionId
    ? placementAssessmentAvailable ? getPlacementQuestion(selectedLanguage, activePlacementFlow.questionId) : null
    : null;
  const recommendationUnit = placementRecord
    ? activeCourse?.units.find((unit) => unit.position === placementRecord.recommendedUnitPosition)
    : undefined;
  const resettableActivity = Boolean(session?.course_code && RESETTABLE_ACTIVITY_COURSES.has(session.course_code));

  function closeResetDialog() {
    if (submitting) return;
    setResetRequest(null);
    setResetConfirmation('');
  }

  async function confirmReset() {
    if (!currentInstitutionId || !profileId || !resetRequest || submitting) return;
    setSubmitting(true);
    setPageError('');
    try {
      if (resetRequest === 'activity') {
        if (!session?.course_code || !session.lesson_id || !session.session_id) return;
        const restarted = await tecEnglishService.resetActivity(
          currentInstitutionId,
          session.course_code,
          session.lesson_id,
          session.session_id,
        );
        pendingAnswer.current = null;
        setSession(restarted);
        setAnswerResult(null);
        setResetToken((value) => value + 1);
        setScreen('lesson');
      } else {
        if (resetConfirmation.trim().toUpperCase() !== 'RECOMEÇAR') return;
        await tecEnglishService.resetCourse(currentInstitutionId, selectedLanguage);
        if (currentPlacementKey && typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(currentPlacementKey);
            window.localStorage.removeItem(placementAttemptStorageKey(currentPlacementKey));
          } catch {
            // O estado do servidor já foi zerado; cache indisponível não deve bloquear a tela.
          }
          setPlacementFlow(createPlacementFlow(currentPlacementKey, null));
          setPlacementSync({ scopeKey: currentPlacementKey, status: 'synced' });
        }
        pendingAnswer.current = null;
        setSession(null);
        setAnswerResult(null);
        setScreen('map');
        setSettingsOpen(false);
        await refreshMap();
      }
      setResetRequest(null);
      setResetConfirmation('');
    } catch {
      setPageError(resetRequest === 'activity'
        ? 'Não foi possível recomeçar esta atividade. Seu progresso anterior foi mantido.'
        : 'Não foi possível zerar o progresso deste idioma. Seus dados foram mantidos.');
    } finally {
      setSubmitting(false);
    }
  }

  async function persistPlacementRecord(key: string, attemptId: string, record: PlacementRecord): Promise<void> {
    writePlacementAttempt(key, attemptId, record);
    setPlacementFlow((current) => current?.scopeKey === key ? { ...current, attemptId, record } : current);
    setPlacementSync({ scopeKey: key, status: 'saving' });
    if (!currentInstitutionId) {
      setPlacementSync({ scopeKey: key, status: 'local' });
      return;
    }
    try {
      const persisted = await tecEnglishService.savePlacement(
        currentInstitutionId,
        tecLanguagePlacementCourseCode(selectedLanguage),
        attemptId,
        record,
      );
      writePlacementAttempt(key, persisted.attemptId ?? attemptId, persisted.record ?? record);
      setPlacementFlow((current) => current?.scopeKey === key
        ? { ...current, attemptId: persisted.attemptId ?? attemptId, record: persisted.record ?? record }
        : current);
      setPlacementSync({ scopeKey: key, status: 'synced' });
    } catch {
      setPlacementSync({ scopeKey: key, status: 'local' });
    }
  }

  async function retryPlacementSync(): Promise<void> {
    if (!currentPlacementKey || !currentInstitutionId || !placementRecord) return;
    const attemptId = activePlacementFlow?.attemptId ?? readPlacementAttemptId(currentPlacementKey) ?? crypto.randomUUID();
    await persistPlacementRecord(currentPlacementKey, attemptId, placementRecord);
  }

  useEffect(() => {
    if (!profileId || !currentInstitutionId || courseMaps.length === 0 || selectedCourseMaps.length === 0) return;
    writeLanguagePreference(profileId, currentInstitutionId, selectedLanguage);
  }, [courseMaps.length, currentInstitutionId, profileId, selectedCourseMaps.length, selectedLanguage]);

  async function openLesson(lesson: EnglishLessonSummary) {
    if (!currentInstitutionId || lesson.status === 'LOCKED' || lesson.status === 'REVIEW_PENDING') return;
    setPageError('');
    setSubmitting(true);
    try {
      const opened = lesson.course_code
        ? await tecEnglishService.startLesson(currentInstitutionId, lesson.id, lesson.course_code)
        : await tecEnglishService.startLesson(currentInstitutionId, lesson.id);
      setPlacementFlow((current) => current ? { ...current, mode: 'CLOSED', openedManually: false } : current);
      pendingAnswer.current = null;
      setSession({ ...opened, course_code: lesson.course_code ?? opened.course_code });
      setAnswerResult(null);
      setResetToken((value) => value + 1);
      setScreen(opened.current_position > 1 ? 'lesson' : 'intro');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('TEC_ENGLISH_CONTENT_NOT_APPROVED')) {
        setPageError('Esta lição está indisponível no momento. Escolha outra etapa ou tente novamente mais tarde.');
      } else if (message.includes('TEC_ENGLISH_LESSON_LOCKED')) {
        setPageError('Conclua a etapa anterior para desbloquear esta lição.');
      } else {
        setPageError('Não foi possível abrir esta lição. Seu progresso continua salvo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function beginPlacementManually() {
    if (!currentPlacementKey || !placementAssessmentAvailable) return;
    const question = getFirstPlacementQuestion(selectedLanguage);
    setPlacementFlow({
      ...createPlacementFlow(currentPlacementKey, placementRecord, true),
      attemptId: crypto.randomUUID(),
      mode: 'QUESTION',
      questionId: question.id,
    });
  }

  function startFromZero() {
    if (!currentPlacementKey || !continueLesson) return;
    const record: PlacementRecord = {
      version: 1,
      kind: 'START_FROM_ZERO',
      score: 0,
      questionCount: 0,
      highestDifficulty: 1,
      recommendedUnitPosition: 1,
      completedAt: new Date().toISOString(),
    };
    const attemptId = crypto.randomUUID();
    setPlacementFlow((current) => current?.scopeKey === currentPlacementKey
      ? { ...current, attemptId, mode: 'CLOSED', record }
      : current);
    void persistPlacementRecord(currentPlacementKey, attemptId, record);
    void openLesson(continueLesson);
  }

  function beginPlacementAssessment() {
    if (!activePlacementFlow || !placementAssessmentAvailable) return;
    const question = getFirstPlacementQuestion(selectedLanguage);
    setPlacementFlow({
      ...activePlacementFlow,
      attemptId: crypto.randomUUID(),
      mode: 'QUESTION',
      questionId: question.id,
      selectedOption: null,
      answers: [],
      highestDifficulty: 1,
      feedback: null,
    });
  }

  function submitPlacementAnswer() {
    if (!activePlacementFlow || !placementAssessmentAvailable || !currentPlacementQuestion || activePlacementFlow.selectedOption === null) return;
    const isCorrect = activePlacementFlow.selectedOption === currentPlacementQuestion.correctOption;
    const answers = [...activePlacementFlow.answers, {
      questionId: currentPlacementQuestion.id,
      difficulty: currentPlacementQuestion.difficulty,
      isCorrect,
    }];
    const highestDifficulty = Math.max(activePlacementFlow.highestDifficulty, currentPlacementQuestion.difficulty) as PlacementDifficulty;
    const nextQuestion = getNextPlacementQuestion(
      selectedLanguage,
      answers.map((answer) => answer.questionId),
      currentPlacementQuestion.difficulty,
      isCorrect,
    );
    setPlacementFlow({
      ...activePlacementFlow,
      mode: 'FEEDBACK',
      answers,
      highestDifficulty,
      feedback: { question: currentPlacementQuestion, isCorrect, nextQuestionId: nextQuestion?.id ?? null },
    });
  }

  function continuePlacementAssessment() {
    if (!activePlacementFlow?.feedback || !placementAssessmentAvailable) return;
    const nextQuestion = activePlacementFlow.feedback.nextQuestionId
      ? getPlacementQuestion(selectedLanguage, activePlacementFlow.feedback.nextQuestionId)
      : null;
    if (nextQuestion && activePlacementFlow.answers.length < PLACEMENT_QUESTION_LIMIT) {
      setPlacementFlow({
        ...activePlacementFlow,
        mode: 'QUESTION',
        questionId: nextQuestion.id,
        selectedOption: null,
        feedback: null,
      });
      return;
    }

    const score = activePlacementFlow.answers.filter((answer) => answer.isCorrect).length;
    const record: PlacementRecord = {
      version: 1,
      kind: 'ASSESSMENT',
      score,
      questionCount: activePlacementFlow.answers.length,
      highestDifficulty: activePlacementFlow.highestDifficulty,
      recommendedUnitPosition: getRecommendedUnitPosition(
        activePlacementFlow.highestDifficulty,
        score,
        activePlacementFlow.answers.length,
        activeCourse?.units.length ?? 1,
      ),
      completedAt: new Date().toISOString(),
    };
    const attemptId = activePlacementFlow.attemptId ?? crypto.randomUUID();
    setPlacementFlow({ ...activePlacementFlow, attemptId, mode: 'RESULT', record });
    void persistPlacementRecord(activePlacementFlow.scopeKey, attemptId, record);
  }

  function closePlacementPanel() {
    setPlacementFlow((current) => current?.scopeKey === currentPlacementKey
      ? { ...current, mode: 'CLOSED', openedManually: false }
      : current);
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
    setAnswerResult(null);
    await refreshMap();
  }

  const lessonButtonLabel = (lesson: EnglishLessonSummary): string => {
    if (lesson.status === 'IN_PROGRESS') return 'Continuar lição';
    if (lesson.status === 'COMPLETED') return 'Revisar lição';
    if (lesson.status === 'REVIEW_PENDING') return 'Indisponível';
    if (lesson.status === 'LOCKED') return 'Bloqueada';
    return 'Começar lição';
  };

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
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-right text-sm font-bold text-slate-600 dark:text-slate-300">{session.lesson_title}</span>
            {resettableActivity ? (
              <button type="button" aria-label="Resetar atividade" disabled={submitting} onClick={() => setResetRequest('activity')} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Resetar atividade</span><span className="sm:hidden">Resetar</span>
              </button>
            ) : null}
          </div>
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
        {resetRequest === 'activity' ? (
          <ResetConfirmationDialog
            title="Resetar atividade?"
            description="A tentativa atual e as respostas desta lição serão descartadas. O progresso das outras lições continuará salvo."
            confirmLabel="Resetar atividade"
            busy={submitting}
            onCancel={closeResetDialog}
            onConfirm={() => void confirmReset()}
          />
        ) : null}
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

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-1 pb-10">
      <Link to="/student/study" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold text-[#005bbf] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Central de Estudos
      </Link>

      <header className="rounded-3xl bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-800 p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-100">Seu curso</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{activeLanguageName}</h1>
            {activeCourse ? <p className="mt-1 text-sm font-semibold text-blue-50">{completedLessons} de {totalLessons} lições · {totalXp} XP</p> : null}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <LanguageCourseSwitcher
              courses={courseMaps}
              selectedLanguage={selectedLanguage}
              onSelect={setSelectedLanguage}
              loading={loading}
            />
            {activeCourse ? (
              <button type="button" aria-label="Configurações do curso" aria-expanded={settingsOpen} aria-controls="tec-idiomas-course-settings" onClick={() => setSettingsOpen((open) => !open)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Settings2 className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label={`Progresso de ${activeLanguageName}: ${progressPercent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="h-full rounded-full bg-emerald-300 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        {continueLesson && continueLesson.status !== 'REVIEW_PENDING' && !showPlacementPanel || placementAssessmentAvailable && (placementRecord || hasCourseProgress) && !showPlacementPanel ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          {continueLesson && continueLesson.status !== 'REVIEW_PENDING' && !showPlacementPanel ? (
          <button type="button" disabled={submitting} onClick={() => void openLesson(continueLesson)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-extrabold text-sky-900 shadow-sm hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">
            <Play className="h-4 w-4" aria-hidden="true" /> {continueLesson.status === 'IN_PROGRESS' ? 'Continuar' : completedLessons > 0 ? 'Próxima lição' : 'Começar'}
          </button>
        ) : null}
        {placementAssessmentAvailable && (placementRecord || hasCourseProgress) && !showPlacementPanel ? (
          <button type="button" onClick={beginPlacementManually} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/50 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {placementRecord ? 'Refazer diagnóstico' : 'Descobrir meu nível'}
          </button>
        ) : null}
          </div>
        ) : null}
      </header>

      {settingsOpen && activeCourse ? (
        <section id="tec-idiomas-course-settings" aria-label="Configurações do curso" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h2 className="font-extrabold text-slate-950 dark:text-white">Progresso de {activeLanguageName}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Zere somente este idioma para começar novamente.</p>
          </div>
          <button type="button" disabled={submitting} onClick={() => { setResetConfirmation(''); setResetRequest('course'); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-60 dark:border-rose-900 dark:text-rose-200 dark:hover:bg-rose-950/30">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Resetar curso
          </button>
        </section>
      ) : null}

      {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Carregando seus percursos de idiomas…</p> : null}
      {pageError && screen === 'map' ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{pageError}</p> : null}
      {resetRequest === 'course' ? (
        <ResetConfirmationDialog
          title={`Resetar ${activeLanguageName}?`}
          description={`Isso apaga o progresso, o XP deste idioma e o resultado do diagnóstico de ${activeLanguageName}. Os outros idiomas e cursos permanecem intactos. Digite RECOMEÇAR para confirmar.`}
          confirmLabel="Resetar curso"
          confirmation={resetConfirmation}
          onConfirmationChange={setResetConfirmation}
          busy={submitting}
          onCancel={closeResetDialog}
          onConfirm={() => void confirmReset()}
        />
      ) : null}
      {!loading && currentPlacementKey && (activePlacementSyncStatus === 'local' || activePlacementSyncStatus === 'error') ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status" aria-live="polite">
          <span>{placementRecord ? 'Seu resultado está salvo neste dispositivo e aguardando sincronização.' : 'Não foi possível verificar seu resultado inicial agora.'}</span>
          {placementRecord ? <button type="button" onClick={() => void retryPlacementSync()} className="min-h-10 rounded-lg border border-amber-700/40 px-3 font-bold hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:hover:bg-amber-900/40">Tentar sincronizar</button> : null}
        </section>
      ) : null}

      {placementRecord && activePlacementSyncStatus !== 'loading' && !hasCourseProgress && !showPlacementPanel ? (
        <section aria-label="Seu resultado inicial" className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6 text-slate-800 dark:text-slate-100">
            <strong>{placementRecord.kind === 'ASSESSMENT' ? `Diagnóstico: ${placementRecord.score} de ${placementRecord.questionCount} respostas corretas.` : 'Você escolheu começar do zero.'}</strong>
            {placementRecord.kind === 'ASSESSMENT' && recommendationUnit ? <span> Recomendação: Unidade {recommendationUnit.position}, {recommendationUnit.title}.</span> : null}
            <p className="mt-1">{activePlacementSyncStatus === 'synced' ? 'Seu resultado está sincronizado com sua conta e disponível nos seus dispositivos.' : activePlacementSyncStatus === 'saving' ? 'Sincronizando seu resultado…' : 'Resultado disponível neste dispositivo; aguardando conexão para sincronizar.'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {continueLesson?.status === 'AVAILABLE' ? <button type="button" disabled={submitting} onClick={() => void openLesson(continueLesson)} className="min-h-10 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">Começar pela primeira lição</button> : null}
            <button type="button" onClick={beginPlacementManually} className="min-h-10 rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-sky-900 hover:bg-white dark:border-sky-700 dark:text-sky-100 dark:hover:bg-slate-900">Refazer diagnóstico</button>
          </div>
        </section>
      ) : null}

      {showPlacementPanel && activePlacementFlow ? (
        <section aria-labelledby="tec-idiomas-first-use-title" className="rounded-3xl border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-5 shadow-sm dark:border-sky-900 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sky-800 dark:text-sky-200">{activePlacementFlow.mode === 'WELCOME' ? 'Seu primeiro acesso' : 'Diagnóstico de nível'}</p>
              <h2 id="tec-idiomas-first-use-title" className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white sm:text-2xl">
                {activePlacementFlow.mode === 'WELCOME' ? 'Como você quer começar?' : activePlacementFlow.mode === 'RESULT' ? 'Seu ponto de partida recomendado' : 'Vamos descobrir seu nível'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                {activePlacementFlow.mode === 'WELCOME'
                  ? `Escolha se quer começar do básico ou responder algumas perguntas de ${activeLanguageName}. O diagnóstico apenas recomenda por onde estudar.`
                  : 'As perguntas começam simples e mudam de nível conforme suas respostas. Isso não concede XP, não altera seu progresso e não libera lições.'}
              </p>
            </div>
          </div>

          {activePlacementFlow.mode === 'WELCOME' ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button type="button" disabled={submitting || !continueLesson} onClick={startFromZero} className="flex min-h-28 flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                <span className="inline-flex items-center gap-2 text-base font-extrabold text-slate-950 dark:text-white"><BookOpen className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" /> Começar do zero</span>
                <span className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Abrir a primeira lição e seguir a sequência normal.</span>
              </button>
              {placementAssessmentAvailable ? (
                <button type="button" onClick={beginPlacementAssessment} className="flex min-h-28 flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <span className="inline-flex items-center gap-2 text-base font-extrabold text-slate-950 dark:text-white"><Sparkles className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" /> Descobrir meu nível</span>
                  <span className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Responder até cinco perguntas adaptadas ao que você já sabe.</span>
                </button>
              ) : <p className="self-center text-sm text-slate-600 dark:text-slate-300">O diagnóstico ainda não está disponível neste idioma. Você pode começar pela primeira lição.</p>}
            </div>
          ) : null}

          {activePlacementFlow.mode === 'QUESTION' && currentPlacementQuestion ? (
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <span>Pergunta {activePlacementFlow.answers.length + 1} de {PLACEMENT_QUESTION_LIMIT}</span>
                  <span>{currentPlacementQuestion.difficulty === 1 ? 'Começando pelo básico' : currentPlacementQuestion.difficulty === 2 ? 'Um pouco mais' : 'Desafio avançado'}</span>
                </div>
                <div role="progressbar" aria-label="Avanço do diagnóstico" aria-valuemin={0} aria-valuemax={PLACEMENT_QUESTION_LIMIT} aria-valuenow={activePlacementFlow.answers.length + 1} className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${((activePlacementFlow.answers.length + 1) / PLACEMENT_QUESTION_LIMIT) * 100}%` }} />
                </div>
              </div>
              <fieldset>
                <legend className="text-lg font-extrabold text-slate-950 dark:text-white sm:text-xl">{currentPlacementQuestion.prompt}</legend>
                {currentPlacementQuestion.support ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{currentPlacementQuestion.support}</p> : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {currentPlacementQuestion.options.map((option, index) => (
                    <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-sky-600 ${activePlacementFlow.selectedOption === index ? 'border-sky-600 bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50' : 'border-slate-200 bg-white hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900'}`}>
                      <input type="radio" name="tec-idiomas-placement-answer" value={index} checked={activePlacementFlow.selectedOption === index} onChange={() => setPlacementFlow((current) => current?.scopeKey === currentPlacementKey ? { ...current, selectedOption: index } : current)} className="h-4 w-4 accent-sky-700" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={activePlacementFlow.selectedOption === null} onClick={submitPlacementAnswer} className="min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-50">Conferir resposta</button>
                <button type="button" onClick={() => setPlacementFlow((current) => current?.scopeKey === currentPlacementKey ? { ...current, mode: 'WELCOME', questionId: null, selectedOption: null, answers: [], feedback: null } : current)} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-slate-200 dark:hover:bg-slate-800">Voltar</button>
              </div>
            </div>
          ) : null}

          {activePlacementFlow.mode === 'FEEDBACK' && activePlacementFlow.feedback ? (
            <div className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${activePlacementFlow.feedback.isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`} role="status" aria-live="polite">
              <strong>{activePlacementFlow.feedback.isCorrect ? 'Resposta correta.' : `A resposta esperada era “${activePlacementFlow.feedback.question.options[activePlacementFlow.feedback.question.correctOption]}”.`}</strong>
              <p className="mt-1">{activePlacementFlow.feedback.question.explanation}</p>
              <button type="button" onClick={continuePlacementAssessment} className="mt-4 min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 font-extrabold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">{activePlacementFlow.feedback.nextQuestionId && activePlacementFlow.answers.length < PLACEMENT_QUESTION_LIMIT ? 'Próxima pergunta' : 'Ver recomendação'}</button>
            </div>
          ) : null}

          {activePlacementFlow.mode === 'RESULT' && placementRecord ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status" aria-live="polite">
              <p><strong>Você acertou {placementRecord.score} de {placementRecord.questionCount} perguntas.</strong></p>
              {recommendationUnit ? <p className="mt-1"><strong>Recomendação:</strong> comece revisando a Unidade {recommendationUnit.position}, {recommendationUnit.title}.</p> : null}
              <p className="mt-1">A recomendação não pula etapas nem altera XP ou progresso. {activePlacementSyncStatus === 'synced' ? 'Seu resultado está sincronizado com sua conta e disponível nos seus dispositivos.' : activePlacementSyncStatus === 'saving' || activePlacementSyncStatus === 'loading' ? 'Seu resultado está sendo sincronizado com sua conta.' : 'Seu resultado está salvo neste dispositivo e será sincronizado quando a conexão voltar.'}</p>
              {activePlacementSyncStatus === 'local' ? <button type="button" onClick={() => void retryPlacementSync()} className="mt-3 min-h-10 rounded-lg border border-emerald-800/30 px-3 font-bold hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:hover:bg-slate-900">Tentar sincronizar</button> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {!hasCourseProgress && continueLesson?.status === 'AVAILABLE' ? <button type="button" disabled={submitting} onClick={() => void openLesson(continueLesson)} className="min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 font-extrabold text-white hover:bg-sky-800 disabled:opacity-60">Começar pela primeira lição</button> : null}
                <button type="button" onClick={closePlacementPanel} className="min-h-11 rounded-xl border border-emerald-700/30 px-4 py-2.5 font-bold text-emerald-950 hover:bg-white/70 dark:text-emerald-100 dark:hover:bg-slate-900">Ver minha trilha</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && courseMap ? (
        <section aria-labelledby="english-map-title" className="space-y-4">
          <h2 id="english-map-title" className="sr-only">Etapas de {activeLanguageName}</h2>
          {selectedCourseMaps.map((course) => (
            <div key={course.course.code} className="space-y-4">
              {course.units.map((unit) => {
                const unitCompleted = unit.lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
                return (
                  <section key={unit.id} aria-labelledby={`unit-${unit.id}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-sky-700 dark:text-sky-300">Unidade {unit.position}</p>
                        <h3 id={`unit-${unit.id}`} className="mt-0.5 text-lg font-extrabold text-slate-950 dark:text-white sm:text-xl">{unit.title}</h3>
                      </div>
                      <span aria-label={`${unitCompleted} de ${unit.lessons.length} lições concluídas`} className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">{unitCompleted}/{unit.lessons.length}</span>
                    </div>
                    <ol className="relative mt-4 space-y-2.5 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                      {unit.lessons.map((lesson) => {
                        const blocked = lesson.status === 'LOCKED' || lesson.status === 'REVIEW_PENDING';
                        const lessonIcon = lesson.status === 'COMPLETED' ? <Check className="h-5 w-5" aria-hidden="true" />
                          : lesson.status === 'LOCKED' ? <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                            : lesson.status === 'IN_PROGRESS' ? <Clock3 className="h-5 w-5" aria-hidden="true" />
                              : <BookOpen className="h-5 w-5" aria-hidden="true" />;
                        return (
                          <li key={lesson.id} className="relative flex items-center gap-3 sm:gap-4">
                            <span aria-label={statusLabels[lesson.status]} className={`z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm ${lesson.status === 'COMPLETED' ? 'bg-emerald-500 text-white dark:border-slate-900' : lesson.status === 'IN_PROGRESS' ? 'bg-sky-700 text-white dark:border-slate-900' : lesson.status === 'LOCKED' ? 'bg-slate-200 text-slate-500 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-300' : 'bg-sky-100 text-sky-800 dark:border-slate-900 dark:bg-sky-950 dark:text-sky-200'}`}>{lessonIcon}</span>
                            <article data-status={lesson.status} className={`flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4 ${lesson.status === 'IN_PROGRESS' ? 'border-sky-300 bg-sky-50/70 shadow-sm dark:border-sky-800 dark:bg-sky-950/20' : lesson.status === 'AVAILABLE' ? 'border-sky-200 bg-sky-50/35 hover:border-sky-300 dark:border-sky-900 dark:bg-slate-900' : lesson.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-slate-900' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-extrabold text-slate-950 dark:text-white">{lesson.position}. {lesson.title}</h4>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100' : lesson.status === 'REVIEW_PENDING' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100' : lesson.status === 'LOCKED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100'}`}>{statusLabels[lesson.status]}</span>
                                </div>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{lesson.exercise_count} desafios · {lesson.xp_reward} XP</p>
                              </div>
                              <button type="button" disabled={blocked || submitting || loading} onClick={() => void openLesson(lesson)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-700 px-4 py-2 text-sm font-extrabold text-sky-800 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-transparent dark:border-sky-400 dark:text-sky-200 dark:disabled:border-slate-700 dark:disabled:text-slate-500 sm:w-auto">
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

interface ResetConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmation?: string;
  onConfirmationChange?: (value: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ResetConfirmationDialog({
  title,
  description,
  confirmLabel,
  confirmation,
  onConfirmationChange,
  busy,
  onCancel,
  onConfirm,
}: ResetConfirmationDialogProps) {
  const needsTypedConfirmation = onConfirmationChange !== undefined;
  const canConfirm = !needsTypedConfirmation || confirmation?.trim().toUpperCase() === 'RECOMEÇAR';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="tec-idiomas-reset-title" aria-describedby="tec-idiomas-reset-description" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h2 id="tec-idiomas-reset-title" className="text-xl font-extrabold text-slate-950 dark:text-white">{title}</h2>
        <p id="tec-idiomas-reset-description" className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{description}</p>
        {needsTypedConfirmation ? (
          <label className="mt-4 block text-sm font-bold text-slate-800 dark:text-slate-100">
            Confirmação
            <input autoFocus value={confirmation ?? ''} onChange={(event) => onConfirmationChange?.(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" autoComplete="off" />
          </label>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus={!needsTypedConfirmation} disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
          <button type="button" disabled={busy || !canConfirm} onClick={onConfirm} className="min-h-11 rounded-xl bg-rose-700 px-4 py-2 font-extrabold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
