import { supabase } from '../lib/supabaseClient';

export type CentralStudiesReviewDecision = 'APPROVED_FOR_INTEGRATION' | 'CHANGES_REQUESTED';
export type CentralStudiesReviewCriterion =
  | 'officialAlignment'
  | 'pedagogicalAccuracy'
  | 'ageAndGradeSuitability'
  | 'clarityAndAccessibility'
  | 'answerQuality'
  | 'culturalAndContextualSuitability';

export interface CentralStudiesReviewQueueItem {
  journey_code: string;
  content_version: string;
  subject_area: 'MATHEMATICS' | 'PORTUGUESE' | 'SCIENCE';
  grade_level: number;
  official_skill_code: string;
  title: string;
  snapshot_fingerprint: string;
  review_status: 'PEDAGOGICAL_REVIEW_PENDING' | 'PEDAGOGICAL_REVIEWED' | 'CHANGES_REQUESTED';
  publication_status: 'STAGING' | 'PUBLISHED';
  reviewer_name: string | null;
  reviewer_email: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  updated_at: string;
}

export interface CentralStudiesReviewPreview extends CentralStudiesReviewQueueItem {
  payload: {
    journeyCode: string;
    journeyTitle: string;
    subject: string;
    grade: number;
    officialSkillCode: string;
    version: string;
    unitTitle: string;
    lesson: {
      title: string;
      estimatedMinutes: number;
      introduction: string;
      explanation: string;
      workedExample: { prompt: string; steps: string[]; answer: string };
      guidedPractice: Array<{ prompt: string; scaffold: string }>;
      application: Array<{ context: string; prompt: string }>;
      review: string[];
    };
    questions: Array<{
      id: string;
      purpose: string;
      difficulty: string;
      statement: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      misconception: string;
    }>;
  };
}

export interface CentralStudiesReviewReceipt {
  review_event_id: string;
  journey_code: string;
  content_version: string;
  decision: CentralStudiesReviewDecision;
  publication_status: 'STAGING';
  reviewer_name: string;
  reviewer_email: string;
  reviewed_at: string;
  snapshot_fingerprint: string;
}

function unwrap<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) throw new Error(error.message || operation);
  if (data === null) throw new Error(operation);
  return data;
}

export const centralStudiesContentReviewService = {
  async getQueue(): Promise<CentralStudiesReviewQueueItem[]> {
    const { data, error } = await supabase.rpc('get_central_studies_v2_review_queue_v1');
    return unwrap(data as CentralStudiesReviewQueueItem[] | null, error, 'Não foi possível carregar a fila de revisão.');
  },

  async getPreview(journeyCode: string, contentVersion: string): Promise<CentralStudiesReviewPreview> {
    const { data, error } = await supabase.rpc('get_central_studies_v2_review_preview_v1', {
      p_journey_code: journeyCode,
      p_content_version: contentVersion,
    });
    return unwrap(data as CentralStudiesReviewPreview | null, error, 'Não foi possível abrir a aula para revisão.');
  },

  async review(input: {
    journeyCode: string;
    contentVersion: string;
    decision: CentralStudiesReviewDecision;
    notes: string;
    expectedFingerprint: string;
    checklist: Partial<Record<CentralStudiesReviewCriterion, boolean>>;
  }): Promise<CentralStudiesReviewReceipt> {
    const { data, error } = await supabase.rpc('review_central_studies_v2_candidate_v1', {
      p_journey_code: input.journeyCode,
      p_content_version: input.contentVersion,
      p_decision: input.decision,
      p_notes: input.notes,
      p_expected_fingerprint: input.expectedFingerprint,
      p_checklist: input.checklist,
    });
    return unwrap(data as CentralStudiesReviewReceipt | null, error, 'Não foi possível registrar a revisão humana.');
  },
};
