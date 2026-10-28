import { supabase } from '../lib/supabaseClient';

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

export function isMissingTecEnglishRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'PGRST202'
    || (typeof candidate.message === 'string' && candidate.message.includes('Could not find the function'));
}

function isExpectedV2CourseUnavailable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42501' && error.message?.includes('TEC_ENGLISH_COURSE_NOT_AVAILABLE') === true;
}

export const tecEnglishService = {
  async getMap(institutionId: string): Promise<EnglishCourseMap> {
    const { data, error } = await supabase.rpc('get_tec_english_map_v1', { p_institution_id: institutionId });
    const base = unwrap(data as EnglishCourseMap | null, error, 'Não foi possível carregar seu caminho de inglês.');
    const primary = { ...base, units: base.units.map((unit) => ({
      ...unit,
      lessons: unit.lessons.map((lesson) => ({ ...lesson, course_code: base.course.code })),
    })) };
    let v2: EnglishCourseMap | null = null;
    let v2LoadError = false;
    for (const courseCode of ['TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_TEST']) {
      try {
        const response = await supabase.rpc('get_tec_english_course_map_v2', {
          p_institution_id: institutionId,
          p_course_code: courseCode,
        });
        if (isExpectedV2CourseUnavailable(response.error)) continue;
        if (response.error) {
          if (isMissingTecEnglishRpc(response.error)) continue;
          v2LoadError = true;
          break;
        }
        if (response.data) {
          v2 = response.data as EnglishCourseMap;
          break;
        }
      } catch {
        v2LoadError = true;
        break;
      }
    }
    if (v2) {
      const v2CourseCode = v2.course.code;
      v2 = { ...v2, units: v2.units.map((unit) => ({
        ...unit,
        lessons: unit.lessons.map((lesson) => ({ ...lesson, course_code: v2CourseCode })),
      })) };
    }
    return { ...primary, additional_courses: v2 ? [v2] : [], additional_courses_error: v2LoadError };
  },

  async startLesson(institutionId: string, lessonId: string, courseCode = 'TEC_ENGLISH_FOUNDATIONS'): Promise<EnglishLessonSession> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isV2
      ? await supabase.rpc('start_tec_english_lesson_v2', { p_institution_id: institutionId, p_course_code: courseCode, p_lesson_id: lessonId })
      : await supabase.rpc('start_tec_english_lesson_v1', { p_institution_id: institutionId, p_lesson_id: lessonId });
    const session = unwrap(data as EnglishLessonSession | null, error, 'Não foi possível abrir esta lição.');
    return { ...session, course_code: courseCode };
  },

  async getSession(institutionId: string, sessionId: string, courseCode = 'TEC_ENGLISH_FOUNDATIONS'): Promise<EnglishLessonSession> {
    const isV2 = courseCode.startsWith('TEC_ENGLISH_FOUNDATIONS_V2');
    const { data, error } = isV2
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
    const { data, error } = isV2
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
