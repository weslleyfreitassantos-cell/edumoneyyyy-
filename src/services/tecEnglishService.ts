import { supabase } from '../lib/supabaseClient';
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

function isTecIdiomasV3Course(courseCode: string): boolean {
  return (TEC_IDIOMAS_V3_COURSES as readonly string[]).includes(courseCode);
}

export const tecEnglishService = {
  async getMap(institutionId: string): Promise<EnglishCourseMap> {
    const courses: EnglishCourseMap[] = [];
    let courseLoadError = false;
    let runtimeMissing = false;
    for (const courseCode of TEC_IDIOMAS_V3_COURSES) {
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
    const [primary, ...additionalCourses] = courses;
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
    const { data, error } = isTecIdiomasV3Course(courseCode)
      ? await supabase.rpc('start_tec_language_lesson_v1', { p_institution_id: institutionId, p_course_code: courseCode, p_lesson_id: lessonId })
      : isV2
        ? await supabase.rpc('start_tec_english_lesson_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_lesson_id: lessonId })
        : await supabase.rpc('start_tec_english_lesson_v1', { p_institution_id: institutionId, p_lesson_id: lessonId });
    const session = unwrap(data as EnglishLessonSession | null, error, 'Não foi possível abrir esta lição.');
    return { ...session, course_code: courseCode };
  },

  async getSession(institutionId: string, sessionId: string, courseCode = 'TEC_ENGLISH_FOUNDATIONS'): Promise<EnglishLessonSession> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isTecIdiomasV3Course(courseCode)
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
    const { data, error } = isTecIdiomasV3Course(courseCode)
      ? await supabase.rpc('submit_tec_language_answer_v1', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey })
      : isV2
        ? await supabase.rpc('submit_tec_english_answer_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey })
        : await supabase.rpc('submit_tec_english_answer_v1', { p_institution_id: institutionId, p_session_id: sessionId, p_exercise_id: exerciseId, p_response: response, p_idempotency_key: idempotencyKey });
    return unwrap(data as EnglishAnswerResult | null, error, 'Não foi possível conferir sua resposta.');
  },

};
