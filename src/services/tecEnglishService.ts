import { supabase } from '../lib/supabaseClient';

export type EnglishLessonStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' | 'REVIEW_PENDING';
export type EnglishExerciseType = 'MULTIPLE_CHOICE' | 'WORD_ORDER' | 'TRANSLATION' | 'LISTENING' | 'MATCHING' | 'FILL_BLANK' | 'SPEAKING';

export interface EnglishLessonSummary {
  id: string;
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
}

export interface EnglishLessonSession {
  session_id: string;
  lesson_id: string;
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

function unwrap<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) throw new Error(error.message || operation);
  if (data === null) throw new Error(operation);
  return data;
}

export const tecEnglishService = {
  async getMap(institutionId: string): Promise<EnglishCourseMap> {
    const { data, error } = await supabase.rpc('get_tec_english_map_v1', { p_institution_id: institutionId });
    return unwrap(data as EnglishCourseMap | null, error, 'Não foi possível carregar seu caminho de inglês.');
  },

  async startLesson(institutionId: string, lessonId: string): Promise<EnglishLessonSession> {
    const { data, error } = await supabase.rpc('start_tec_english_lesson_v1', {
      p_institution_id: institutionId,
      p_lesson_id: lessonId,
    });
    return unwrap(data as EnglishLessonSession | null, error, 'Não foi possível abrir esta lição.');
  },

  async getSession(institutionId: string, sessionId: string): Promise<EnglishLessonSession> {
    const { data, error } = await supabase.rpc('get_tec_english_session_v1', {
      p_institution_id: institutionId,
      p_session_id: sessionId,
    });
    return unwrap(data as EnglishLessonSession | null, error, 'Não foi possível retomar esta lição.');
  },

  async submitAnswer(
    institutionId: string,
    sessionId: string,
    exerciseId: string,
    response: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<EnglishAnswerResult> {
    const { data, error } = await supabase.rpc('submit_tec_english_answer_v1', {
      p_institution_id: institutionId,
      p_session_id: sessionId,
      p_exercise_id: exerciseId,
      p_response: response,
      p_idempotency_key: idempotencyKey,
    });
    return unwrap(data as EnglishAnswerResult | null, error, 'Não foi possível conferir sua resposta.');
  },
};
