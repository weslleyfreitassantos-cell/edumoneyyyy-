import { supabase } from '../lib/supabaseClient';

export interface GuidedStudyValidationContentRow {
  source_type: 'BNCC_SKILL' | 'CENTRAL_STUDIES_V2' | 'ADAPTIVE_CONTENT_PACK';
  source_id: string;
  content_version: string;
  validation_status: 'VALIDATION_FAILED' | 'READY' | 'PUBLISHED' | 'DISABLED';
  errors: string[];
  checks: Record<string, unknown>;
  validated_at: string;
}

export interface GuidedStudyValidationCoverageRow {
  stage: string;
  grade_level: number;
  mapped_skill_count: number;
  technical_ready_count: number;
  published_skill_count: number;
  eligible_skill_count: number;
}

export interface GuidedStudyValidationSummary {
  validator_version: string;
  content: GuidedStudyValidationContentRow[];
  coverage: GuidedStudyValidationCoverageRow[];
  counts: { published: number; ready: number; failed: number; disabled: number };
}

export async function getGuidedStudyValidationSummary(): Promise<GuidedStudyValidationSummary> {
  const { data, error } = await supabase.rpc('get_guided_study_v12_validation_summary');
  if (error) throw new Error(error.message || 'Não foi possível consultar a validação do conteúdo.');
  if (!data) throw new Error('O servidor não retornou a situação da validação.');
  return data as GuidedStudyValidationSummary;
}
