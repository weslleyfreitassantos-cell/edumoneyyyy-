import { supabase } from '../lib/supabaseClient';

export const REENROLLMENT_CAMPAIGN_STATUSES = [
  'DRAFT',
  'OPEN',
  'CLOSED',
  'CANCELLED',
  'ARCHIVED',
] as const;

export type ReenrollmentCampaignStatus =
  (typeof REENROLLMENT_CAMPAIGN_STATUSES)[number];

export const REENROLLMENT_ACADEMIC_STATUSES = [
  'NOT_EVALUATED',
  'PENDING',
  'APPROVED',
  'RECOVERY',
  'RETAINED',
  'TRANSFERRED',
  'INELIGIBLE',
] as const;

export type ReenrollmentAcademicStatus =
  (typeof REENROLLMENT_ACADEMIC_STATUSES)[number];

export type ReenrollmentRequestStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'AWAITING_ACADEMIC_RESULT'
  | 'AWAITING_PAYMENT'
  | 'READY_FOR_ENROLLMENT'
  | 'ENROLLED'
  | 'CANCELLED'
  | 'REJECTED';

export type ReenrollmentFinancialStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'CLEARED'
  | 'BLOCKED'
  | 'WAIVED';

export interface ReenrollmentCampaign {
  id: string;
  institution_id: string;
  source_academic_year_id: string;
  destination_academic_year_id: string;
  title: string;
  description: string | null;
  status: ReenrollmentCampaignStatus;
  opens_at: string;
  closes_at: string;
  target_audience: 'ACTIVE_STUDENTS' | 'ACTIVE_GUARDIANS' | 'ALL';
  eligible_grade_levels: string[];
  contract_version: string;
  contract_hash: string;
  contract_body: string;
  require_academic_result: boolean;
  require_financial_clearance: boolean;
  allow_class_choice: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReenrollmentRequest {
  id: string;
  institution_id: string;
  campaign_id: string;
  student_id: string;
  source_enrollment_id: string | null;
  source_class_id: string | null;
  source_grade_level: string | null;
  destination_grade_level: string | null;
  destination_class_id: string | null;
  academic_status: ReenrollmentAcademicStatus;
  request_status: ReenrollmentRequestStatus;
  financial_status: ReenrollmentFinancialStatus;
  protocol: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string | null;
  destination_class_name?: string | null;
}

export interface ReenrollmentCampaignDraft {
  institution_id: string;
  source_academic_year_id: string;
  destination_academic_year_id: string;
  title: string;
  description?: string;
  status?: ReenrollmentCampaignStatus;
  opens_at: string;
  closes_at: string;
  contract_version: string;
  contract_hash: string;
  contract_body: string;
  eligible_grade_levels?: string[];
  require_academic_result?: boolean;
  require_financial_clearance?: boolean;
  allow_class_choice?: boolean;
  created_by: string;
}

export interface ReenrollmentReviewInput {
  requestId: string;
  academicStatus: Exclude<ReenrollmentAcademicStatus, 'NOT_EVALUATED'>;
  financialStatus: ReenrollmentFinancialStatus;
  destinationClassId?: string | null;
  notes?: string | null;
}

const CAMPAIGN_COLUMNS = [
  'id',
  'institution_id',
  'source_academic_year_id',
  'destination_academic_year_id',
  'title',
  'description',
  'status',
  'opens_at',
  'closes_at',
  'target_audience',
  'eligible_grade_levels',
  'contract_version',
  'contract_hash',
  'contract_body',
  'require_academic_result',
  'require_financial_clearance',
  'allow_class_choice',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

const REQUEST_COLUMNS = [
  'id',
  'institution_id',
  'campaign_id',
  'student_id',
  'source_enrollment_id',
  'source_class_id',
  'source_grade_level',
  'destination_grade_level',
  'destination_class_id',
  'academic_status',
  'request_status',
  'financial_status',
  'protocol',
  'confirmed_by',
  'confirmed_at',
  'reviewed_by',
  'reviewed_at',
  'notes',
  'created_at',
  'updated_at',
  'students:student_id(profiles:profile_id(full_name))',
  'classes:destination_class_id(name)',
].join(', ');

function normalizeCampaign(row: unknown): ReenrollmentCampaign {
  return row as ReenrollmentCampaign;
}

function normalizeRequest(row: Record<string, unknown>): ReenrollmentRequest {
  const studentRelation = row.students as { profiles?: { full_name?: string } | Array<{ full_name?: string }> } | null | undefined;
  const classRelation = row.classes as { name?: string } | Array<{ name?: string }> | null | undefined;
  const studentProfile = Array.isArray(studentRelation?.profiles)
    ? studentRelation?.profiles[0]
    : studentRelation?.profiles;
  const destinationClass = Array.isArray(classRelation)
    ? classRelation[0]
    : classRelation;

  return {
    ...(row as unknown as ReenrollmentRequest),
    student_name: studentProfile?.full_name ?? null,
    destination_class_name: destinationClass?.name ?? null,
  };
}

function assertInstitution(institutionId: string): void {
  if (!institutionId.trim()) {
    throw new Error('A instituição é obrigatória para consultar a rematrícula.');
  }
}

function assertCampaignDraft(input: ReenrollmentCampaignDraft): void {
  assertInstitution(input.institution_id);
  if (!input.source_academic_year_id || !input.destination_academic_year_id) {
    throw new Error('Selecione o ano letivo de origem e o ano letivo de destino.');
  }
  if (input.source_academic_year_id === input.destination_academic_year_id) {
    throw new Error('Os anos letivos de origem e destino precisam ser diferentes.');
  }
  if (!input.title.trim()) throw new Error('Informe o título da campanha.');
  if (!input.opens_at || !input.closes_at || input.opens_at >= input.closes_at) {
    throw new Error('Informe um período válido para a campanha.');
  }
  if (
    !input.contract_version.trim()
    || !input.contract_hash.trim()
    || input.contract_hash.trim().toUpperCase().includes('PREENCHER')
    || !input.contract_body.trim()
  ) {
    throw new Error('A versão, a impressão digital e o texto do contrato são obrigatórios.');
  }
}

export const reenrollmentService = {
  async listCampaigns(institutionId: string): Promise<ReenrollmentCampaign[]> {
    assertInstitution(institutionId);
    const { data, error } = await supabase
      .from('reenrollment_campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(normalizeCampaign);
  },

  async createCampaign(input: ReenrollmentCampaignDraft): Promise<ReenrollmentCampaign> {
    assertCampaignDraft(input);
    const { data, error } = await supabase
      .from('reenrollment_campaigns')
      .insert({
        ...input,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: input.status ?? 'DRAFT',
        eligible_grade_levels: input.eligible_grade_levels ?? [],
        require_academic_result: input.require_academic_result ?? true,
        require_financial_clearance: input.require_financial_clearance ?? false,
        allow_class_choice: input.allow_class_choice ?? false,
      })
      .select(CAMPAIGN_COLUMNS)
      .single();

    if (error || !data) throw error ?? new Error('Não foi possível criar a campanha.');
    return normalizeCampaign(data);
  },

  async setCampaignStatus(
    campaignId: string,
    institutionId: string,
    status: ReenrollmentCampaignStatus,
  ): Promise<ReenrollmentCampaign> {
    assertInstitution(institutionId);
    const { data, error } = await supabase
      .from('reenrollment_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('institution_id', institutionId)
      .select(CAMPAIGN_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error('Não foi possível atualizar a campanha.');
    return normalizeCampaign(data);
  },

  async listRequests(institutionId: string, campaignId?: string): Promise<ReenrollmentRequest[]> {
    assertInstitution(institutionId);
    let query = supabase
      .from('reenrollment_requests')
      .select(REQUEST_COLUMNS)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (campaignId) query = query.eq('campaign_id', campaignId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as Record<string, unknown>[] ?? []).map(normalizeRequest);
  },

  async createRequest(campaignId: string, studentId: string): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc('create_reenrollment_request_v1', {
      target_campaign_id: campaignId,
      target_student_id: studentId,
    });
    if (error || !data) throw error ?? new Error('Não foi possível preparar a rematrícula.');
    return data as unknown as ReenrollmentRequest;
  },

  async acceptContract(
    requestId: string,
    contractVersion: string,
    contractHash: string,
  ): Promise<unknown> {
    const { data, error } = await supabase.rpc('accept_reenrollment_contract_v1', {
      target_request_id: requestId,
      accepted_contract_version: contractVersion,
      accepted_contract_hash: contractHash,
    });
    if (error || !data) throw error ?? new Error('Não foi possível registrar o aceite.');
    return data;
  },

  async confirmRequest(requestId: string): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc('confirm_reenrollment_request_v1', {
      target_request_id: requestId,
    });
    if (error || !data) throw error ?? new Error('Não foi possível confirmar a rematrícula.');
    return data as unknown as ReenrollmentRequest;
  },

  async reviewRequest(input: ReenrollmentReviewInput): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc('review_reenrollment_request_v1', {
      target_request_id: input.requestId,
      next_academic_status: input.academicStatus,
      next_financial_status: input.financialStatus,
      next_destination_class_id: input.destinationClassId ?? null,
      review_notes: input.notes?.trim() || null,
    });
    if (error || !data) throw error ?? new Error('Não foi possível revisar a solicitação.');
    return data as unknown as ReenrollmentRequest;
  },
};
