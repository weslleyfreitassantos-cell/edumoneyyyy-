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

export interface EnglishReviewQueueItem {
  course_code: string;
  content_version: number;
  title: string;
  description: string;
  author: string;
  publication_status: string;
  review_status: string;
  snapshot_fingerprint: string;
  unit_count: number;
  lesson_count: number;
  exercise_count: number;
  latest_decision: 'APPROVED' | 'CHANGES_REQUESTED' | null;
  latest_reviewer: string | null;
  latest_reviewed_at: string | null;
}

export interface EnglishReviewExercise {
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
  accepted_answers: string[];
  answer_key: Record<string, unknown>;
  explanation: string;
  content_version: number;
  author: string;
}

export interface EnglishReviewPreview {
  course: { course_code: string; content_version: number; title: string; description: string; author: string; xp_per_lesson: number };
  units: Array<{
    id: string;
    position: number;
    title: string;
    description: string;
    content_version: number;
    author: string;
    lessons: Array<{
      id: string;
      position: number;
      title: string;
      introduction: string;
      xp_reward: number;
      content_version: number;
      author: string;
      exercises: EnglishReviewExercise[];
    }>;
  }>;
  snapshot_fingerprint: string;
  audio_mode: string;
}

export interface EnglishReviewReceipt {
  review_id: string;
  course_code: string;
  content_version: number;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  reviewer_name: string;
  reviewer_email: string;
  reviewed_at: string;
  snapshot_fingerprint: string;
}

export interface EnglishReviewHistoryEntry {
  course_code: string;
  course_title: string | null;
  content_version: number;
  snapshot_fingerprint: string;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  notes: string;
  reviewer_profile_id: string;
  reviewer_name: string;
  reviewer_email: string;
  reviewed_at: string;
}

export interface EnglishReleaseTarget {
  institution_id: string;
  institution_name: string;
  enabled: boolean;
}

export interface EnglishReleaseReceipt {
  course_code: string;
  content_version: number;
  institution_id: string;
  enabled: boolean;
  actor_name: string;
  actor_email: string;
  updated_at: string;
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

  async getReviewQueue(): Promise<EnglishReviewQueueItem[]> {
    const { data, error } = await supabase.rpc('get_tec_english_review_queue_v1');
    return unwrap(data as EnglishReviewQueueItem[] | null, error, 'Não foi possível carregar a fila de revisão.');
  },

  async getReviewHistory(): Promise<EnglishReviewHistoryEntry[]> {
    const { data, error } = await supabase.rpc('get_tec_english_review_history_v1');
    return unwrap(data as EnglishReviewHistoryEntry[] | null, error, 'Não foi possível carregar o histórico de revisão.');
  },

  async getReviewPreview(courseCode: string, contentVersion: number): Promise<EnglishReviewPreview> {
    const { data, error } = await supabase.rpc('get_tec_english_review_preview_v1', {
      p_course_code: courseCode,
      p_content_version: contentVersion,
    });
    return unwrap(data as EnglishReviewPreview | null, error, 'Não foi possível abrir esta versão para revisão.');
  },

  async getReleaseTargets(courseCode: string, contentVersion: number, search = ''): Promise<EnglishReleaseTarget[]> {
    const { data, error } = await supabase.rpc('get_tec_english_release_targets_v1', {
      p_course_code: courseCode,
      p_content_version: contentVersion,
      p_search: search || null,
    });
    return unwrap(data as EnglishReleaseTarget[] | null, error, 'Não foi possível carregar as instituições disponíveis.');
  },

  async setInstitutionRelease(input: { courseCode: string; contentVersion: number; institutionId: string; enabled: boolean }): Promise<EnglishReleaseReceipt> {
    const { data, error } = await supabase.rpc('set_tec_english_institution_release_v1', {
      p_course_code: input.courseCode,
      p_content_version: input.contentVersion,
      p_institution_id: input.institutionId,
      p_enabled: input.enabled,
    });
    return unwrap(data as EnglishReleaseReceipt | null, error, 'Não foi possível atualizar a liberação da instituição.');
  },

  async reviewCourse(input: {
    courseCode: string;
    contentVersion: number;
    decision: 'APPROVED' | 'CHANGES_REQUESTED';
    notes: string;
    expectedFingerprint: string;
    checklist: Record<string, boolean>;
  }): Promise<EnglishReviewReceipt> {
    const { data, error } = await supabase.rpc('review_tec_english_course_v1', {
      p_course_code: input.courseCode,
      p_content_version: input.contentVersion,
      p_decision: input.decision,
      p_notes: input.notes,
      p_expected_fingerprint: input.expectedFingerprint,
      p_checklist: input.checklist,
    });
    return unwrap(data as EnglishReviewReceipt | null, error, 'Não foi possível registrar a revisão pedagógica.');
  },
};
