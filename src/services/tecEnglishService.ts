import { supabase } from '../lib/supabaseClient';
import { isPlacementRecord, type PlacementRecord } from '../lib/tecIdiomasPlacement';
import type { TecLanguageLocale } from '../lib/tecLanguage';
export { tecLanguageDisplayName, tecLanguageLocale, tecLanguageName } from '../lib/tecLanguage';

export type EnglishLessonStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' | 'REVIEW_PENDING';
export type EnglishExerciseType = 'MULTIPLE_CHOICE' | 'WORD_ORDER' | 'TRANSLATION' | 'LISTENING' | 'MATCHING' | 'FILL_BLANK' | 'SPEAKING';

export interface EnglishLessonSummary {
  id: string;
  course_code?: string;
  position: number;
  title: string;
  status: EnglishLessonStatus;
  exercise_count: number;
  xp_reward: number;
  active_session_id: string | null;
  completed_at: string | null;
}

export interface EnglishUnitSummary {
  id: string;
  position: number;
  title: string;
  description: string;
  lessons: EnglishLessonSummary[];
}

export interface EnglishCourseMap {
  course: {
    code: string;
    title: string;
    description: string;
    version: number;
    publication_status: 'STAGING' | 'PUBLISHED' | 'ARCHIVED';
    review_status: 'PEDAGOGICAL_REVIEW_PENDING' | 'PEDAGOGICAL_REVIEWED' | 'CHANGES_REQUESTED';
  };
  units: EnglishUnitSummary[];
  stats: {
    xp: number;
    current_streak: number;
    longest_streak: number;
    last_study_date: string | null;
  };
  completed_lessons: number;
  total_lessons: number;
  continue_lesson_id: string | null;
  additional_courses?: EnglishCourseMap[];
  additional_courses_error?: boolean;
}

export interface EnglishExercise {
  id: string;
  position: number;
  type: EnglishExerciseType;
  instruction: string;
  prompt: string;
  options: string[];
  word_bank: string[];
  left_items: string[];
  right_items: string[];
  audio_text: string | null;
  skill_code?: string;
  difficulty_level?: number;
  dialogue_speaker?: string | null;
  dialogue_context?: Array<{ speaker: string; text: string }>;
}

export interface EnglishMasterySkill {
  skill_code: string;
  label: string;
  mastery_score: number;
  difficulty_level: number;
  next_review_at?: string;
}

export interface EnglishLearningHome {
  due_reviews: number;
  due_skills: EnglishMasterySkill[];
  weak_skills: EnglishMasterySkill[];
  stats: EnglishCourseMap['stats'];
}

export interface EnglishSkillReview {
  skill_code: string;
  label: string;
  mastery_score: number;
  difficulty_level: number;
  exercise: EnglishExercise;
}

export interface EnglishSkillReviewResult {
  is_correct: boolean;
  feedback: string;
  explanation: string;
  skill_code: string;
  mastery_score: number;
  difficulty_level: number;
  next_review_at: string;
}

export interface EnglishLessonSession {
  session_id: string;
  lesson_id: string;
  course_code?: string;
  lesson_title: string;
  lesson_intro: string;
  unit_title: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  current_position: number;
  total_exercises: number;
  exercise: EnglishExercise | null;
}

export interface EnglishAnswerResult {
  is_correct: boolean;
  feedback: string;
  explanation: string;
  session_complete: boolean;
  next_position: number;
  total_exercises: number;
  xp_awarded: number;
  total_xp: number;
  current_streak: number;
  next_exercise: EnglishExercise | null;
}

export const TEC_IDIOMAS_V3_COURSES = [
  'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
  'TEC_SPANISH_FOUNDATIONS_V1',
  'TEC_KOREAN_FOUNDATIONS_V1',
] as const;

export const TEC_IDIOMAS_V4_COURSES = [
  'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
  'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
  'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
] as const;

export interface TecLanguagePlacement {
  attemptId: string | null;
  record: PlacementRecord | null;
}

export function tecLanguagePlacementCourseCode(locale: TecLanguageLocale): typeof TEC_IDIOMAS_V4_COURSES[number] {
  switch (locale) {
    case 'es-ES': return 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER';
    case 'ko-KR': return 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER';
    default: return 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER';
  }
}

const TEC_IDIOMAS_RUNTIME_COURSES = [...TEC_IDIOMAS_V4_COURSES, ...TEC_IDIOMAS_V3_COURSES];
const TEC_IDIOMAS_COURSE_PAIRS = [
  ['TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION'],
  ['TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 'TEC_SPANISH_FOUNDATIONS_V1'],
  ['TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 'TEC_KOREAN_FOUNDATIONS_V1'],
] as const;

function unwrap<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) throw new Error(error.message || operation);
  if (data === null) throw new Error(operation);
  return data;
}

export function isMissingTecEnglishRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'PGRST202'
    || (typeof candidate.message === 'string' && candidate.message.includes('Could not find the function'));
}

function isExpectedCourseUnavailable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42501' && error.message?.includes('TEC_ENGLISH_COURSE_NOT_AVAILABLE') === true;
}

function attachCourseCode(course: EnglishCourseMap): EnglishCourseMap {
  const courseCode = course.course.code;
  return {
    ...course,
    units: course.units.map((unit) => ({
      ...unit,
      lessons: unit.lessons.map((lesson) => ({ ...lesson, course_code: courseCode })),
    })),
  };
}

function isTecIdiomasRuntimeCourse(courseCode: string): boolean {
  return (TEC_IDIOMAS_RUNTIME_COURSES as readonly string[]).includes(courseCode);
}

function hasCourseActivity(course: EnglishCourseMap): boolean {
  return course.completed_lessons > 0 || course.stats.xp > 0
    || course.units.some((unit) => unit.lessons.some((lesson) => Boolean(lesson.active_session_id)));
}

function lockUnstartedLegacyCourse(course: EnglishCourseMap): EnglishCourseMap {
  return {
    ...course,
    units: course.units.map((unit) => ({
      ...unit,
      lessons: unit.lessons.map((lesson) => lesson.status === 'AVAILABLE' || lesson.status === 'IN_PROGRESS'
        ? { ...lesson, status: 'LOCKED' }
        : lesson),
    })),
    continue_lesson_id: null,
  };
}

export function orderTecLanguageCourses(courses: EnglishCourseMap[]): EnglishCourseMap[] {
  const byCode = new Map(courses.map((course) => [course.course.code, course]));
  const ordered: EnglishCourseMap[] = [];
  const pairedCodes = new Set<string>(TEC_IDIOMAS_COURSE_PAIRS.flat());
  for (const [beginnerCode, legacyCode] of TEC_IDIOMAS_COURSE_PAIRS) {
    const beginner = byCode.get(beginnerCode);
    const legacy = byCode.get(legacyCode);
    if (!beginner && legacy) { ordered.push(legacy); continue; }
    if (!legacy && beginner) { ordered.push(beginner); continue; }
    if (!beginner || !legacy) continue;
    if (hasCourseActivity(legacy)) {
      ordered.push(legacy, beginner);
      continue;
    }
    ordered.push(beginner);
    const beginnerComplete = beginner.total_lessons > 0 && beginner.completed_lessons >= beginner.total_lessons;
    ordered.push(beginnerComplete ? legacy : lockUnstartedLegacyCourse(legacy));
  }
  for (const course of courses) if (!pairedCodes.has(course.course.code)) ordered.push(course);
  return ordered;
}

export const tecEnglishService = {
  async getPlacement(institutionId: string, courseCode: string): Promise<TecLanguagePlacement> {
    const { data, error } = await supabase.rpc('get_tec_language_placement_v1', {
      p_institution_id: institutionId,
      p_course_code: courseCode,
    });
    const payload = unwrap(data as { attemptId?: unknown; record?: unknown } | null, error, 'Não foi possível recuperar seu resultado inicial.');
    if (payload.record === null || payload.record === undefined) return { attemptId: null, record: null };
    if (typeof payload.attemptId !== 'string' || !isPlacementRecord(payload.record)) {
      throw new Error('TEC_IDIOMAS_PLACEMENT_INVALID_RESPONSE');
    }
    return { attemptId: payload.attemptId, record: payload.record };
  },

  async savePlacement(institutionId: string, courseCode: string, attemptId: string, record: PlacementRecord): Promise<TecLanguagePlacement> {
    const { data, error } = await supabase.rpc('save_tec_language_placement_v1', {
      p_institution_id: institutionId,
      p_course_code: courseCode,
      p_attempt_id: attemptId,
      p_record: record,
    });
    const payload = unwrap(data as { attemptId?: unknown; record?: unknown } | null, error, 'Não foi possível sincronizar seu resultado inicial.');
    if (typeof payload.attemptId !== 'string' || !isPlacementRecord(payload.record)) {
      throw new Error('TEC_IDIOMAS_PLACEMENT_INVALID_RESPONSE');
    }
    return { attemptId: payload.attemptId, record: payload.record };
  },

  async getLegacyMap(institutionId: string): Promise<EnglishCourseMap> {
    const { data, error } = await supabase.rpc('get_tec_english_map_v1', { p_institution_id: institutionId });
    const base = attachCourseCode(unwrap(data as EnglishCourseMap | null, error, 'Não foi possível carregar seu caminho de inglês.'));
    let v2: EnglishCourseMap | null = null;
    let additionalCoursesError = false;
    for (const courseCode of ['TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_TEST']) {
      try {
        const response = await supabase.rpc('get_tec_english_course_map_v2', {
          p_institution_id: institutionId,
          p_course_code: courseCode,
        });
        if (isExpectedCourseUnavailable(response.error)) continue;
        if (response.error) {
          if (!isMissingTecEnglishRpc(response.error)) additionalCoursesError = true;
          break;
        }
        if (response.data) {
          v2 = attachCourseCode(response.data as EnglishCourseMap);
          break;
        }
      } catch {
        additionalCoursesError = true;
        break;
      }
    }
    return { ...base, additional_courses: v2 ? [v2] : [], additional_courses_error: additionalCoursesError };
  },

  async getMap(institutionId: string): Promise<EnglishCourseMap> {
    const courses: EnglishCourseMap[] = [];
    let courseLoadError = false;
    let runtimeMissing = false;
    for (const courseCode of TEC_IDIOMAS_RUNTIME_COURSES) {
      try {
        const response = await supabase.rpc('get_tec_language_course_map_v1', {
          p_institution_id: institutionId,
          p_course_code: courseCode,
        });
        if (response.error) {
          if (isMissingTecEnglishRpc(response.error)) {
            runtimeMissing = true;
            continue;
          }
          if (isExpectedCourseUnavailable(response.error)) continue;
          courseLoadError = true;
          continue;
        }
        if (response.data) courses.push(attachCourseCode(response.data as EnglishCourseMap));
      } catch {
        courseLoadError = true;
      }
    }
    const [primary, ...additionalCourses] = orderTecLanguageCourses(courses);
    if (!primary) {
      throw new Error(runtimeMissing
        ? 'O percurso Tec Idiomas ainda não está instalado no serviço da escola.'
        : courseLoadError
        ? 'Não foi possível carregar os percursos de idiomas. Tente novamente.'
        : 'Os percursos de idiomas não estão disponíveis para esta instituição no momento.');
    }
    return { ...primary, additional_courses: additionalCourses, additional_courses_error: courseLoadError || runtimeMissing };
  },

  async startLesson(institutionId: string, lessonId: string, courseCode = 'TEC_ENGLISH_FOUNDATIONS'): Promise<EnglishLessonSession> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isTecIdiomasRuntimeCourse(courseCode)
      ? await supabase.rpc('start_tec_language_lesson_v1', { p_institution_id: institutionId, p_course_code: courseCode, p_lesson_id: lessonId })
      : isV2
        ? await supabase.rpc('start_tec_english_lesson_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_lesson_id: lessonId })
        : await supabase.rpc('start_tec_english_lesson_v1', { p_institution_id: institutionId, p_lesson_id: lessonId });
    const session = unwrap(data as EnglishLessonSession | null, error, 'Não foi possível abrir esta lição.');
    return { ...session, course_code: courseCode };
  },

  async getSession(institutionId: string, sessionId: string, courseCode = 'TEC_ENGLISH_FOUNDATIONS'): Promise<EnglishLessonSession> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isTecIdiomasRuntimeCourse(courseCode)
      ? await supabase.rpc('get_tec_language_session_v1', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId })
      : isV2
        ? await supabase.rpc('get_tec_english_session_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId })
        : await supabase.rpc('get_tec_english_session_v1', { p_institution_id: institutionId, p_session_id: sessionId });
    const session = unwrap(data as EnglishLessonSession | null, error, 'Não foi possível retomar esta lição.');
    return { ...session, course_code: courseCode };
  },

  async submitAnswer(
    institutionId: string,
    sessionId: string,
    exerciseId: string,
    response: Record<string, unknown>,
    idempotencyKey: string,
    courseCode = 'TEC_ENGLISH_FOUNDATIONS',
  ): Promise<EnglishAnswerResult> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isTecIdiomasRuntimeCourse(courseCode)
      ? await supabase.rpc('submit_tec_language_answer_v1', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey })
      : isV2
        ? await supabase.rpc('submit_tec_english_answer_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey })
        : await supabase.rpc('submit_tec_english_answer_v1', { p_institution_id: institutionId, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey });
    return unwrap(data as EnglishAnswerResult | null, error, 'Não foi possível conferir sua resposta.');
  },

  async getLearningHome(institutionId: string): Promise<EnglishLearningHome> {
    const { data, error } = await supabase.rpc('get_tec_english_learning_home_v2', { p_institution_id: institutionId });
    return unwrap(data as EnglishLearningHome | null, error, 'Não foi possível carregar seu resumo de aprendizagem.');
  },

  async getSkillReviewQueue(institutionId: string): Promise<EnglishMasterySkill[]> {
    const { data, error } = await supabase.rpc('get_tec_english_skill_review_queue_v2', { p_institution_id: institutionId });
    return unwrap(data as EnglishMasterySkill[] | null, error, 'Não foi possível carregar suas revisões.');
  },

  async startSkillReview(institutionId: string, skillCode: string): Promise<EnglishSkillReview> {
    const { data, error } = await supabase.rpc('start_tec_english_skill_review_v2', { p_institution_id: institutionId, p_skill_code: skillCode });
    return unwrap(data as EnglishSkillReview | null, error, 'Não foi possível iniciar esta revisão.');
  },

  async submitSkillReview(institutionId: string, skillCode: string, response: Record<string, unknown>, idempotencyKey: string): Promise<EnglishSkillReviewResult> {
    const { data, error } = await supabase.rpc('submit_tec_english_skill_review_v2', {
      p_institution_id: institutionId, p_skill_code: skillCode, p_response: response, p_idempotency_key: idempotencyKey,
    });
    return unwrap(data as EnglishSkillReviewResult | null, error, 'Não foi possível conferir esta revisão.');
  },

};
