import { supabase } from "../lib/supabaseClient";

export const REENROLLMENT_CAMPAIGN_STATUSES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type ReenrollmentCampaignStatus =
  (typeof REENROLLMENT_CAMPAIGN_STATUSES)[number];

export const REENROLLMENT_ACADEMIC_STATUSES = [
  "NOT_EVALUATED",
  "PENDING",
  "APPROVED",
  "RECOVERY",
  "RETAINED",
  "FAILED",
  "INCOMPLETE",
  "GRADUATING",
  "TRANSFERRED",
  "INELIGIBLE",
] as const;

export type ReenrollmentAcademicStatus =
  (typeof REENROLLMENT_ACADEMIC_STATUSES)[number];

export type ReenrollmentRequestStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "AWAITING_ACADEMIC_RESULT"
  | "AWAITING_PAYMENT"
  | "READY_FOR_ENROLLMENT"
  | "ENROLLED"
  | "CANCELLED"
  | "REJECTED";

export type ReenrollmentFinancialStatus =
  "NOT_REQUIRED" | "PENDING" | "CLEARED" | "BLOCKED" | "WAIVED";

export type ReenrollmentFinanceMode = "NOT_REQUIRED" | "MANUAL" | "AUTO";

export type ReenrollmentAnnualResultStatus = Exclude<
  ReenrollmentAcademicStatus,
  "NOT_EVALUATED" | "PENDING"
>;

export interface ReenrollmentFinanceLink {
  id: string;
  institution_id: string;
  campaign_id: string;
  request_id: string;
  contract_id: string | null;
  primary_invoice_id: string | null;
  status: Exclude<ReenrollmentFinancialStatus, "NOT_REQUIRED">;
  confirmation_origin: "NONE" | "INVOICE_PAID" | "MANUAL_NO_BANK_SETTLEMENT";
  manual_clearance: boolean;
  notes: string | null;
  cleared_at: string | null;
}

export interface ReenrollmentCampaign {
  id: string;
  institution_id: string;
  academic_calendar_event_id: string | null;
  source_academic_year_id: string;
  destination_academic_year_id: string;
  title: string;
  description: string | null;
  status: ReenrollmentCampaignStatus;
  opens_at: string;
  closes_at: string;
  target_audience: "ACTIVE_STUDENTS" | "ACTIVE_GUARDIANS" | "ALL";
  eligible_grade_levels: string[];
  contract_version: string;
  contract_hash: string;
  contract_body: string;
  require_academic_result: boolean;
  require_financial_clearance: boolean;
  allow_class_choice: boolean;
  finance_mode: ReenrollmentFinanceMode;
  finance_monthly_amount_cents: number | null;
  finance_enrollment_fee_cents: number;
  finance_installment_count: number | null;
  finance_first_due_date: string | null;
  finance_due_day: number | null;
  finance_scholarship_per_installment_cents: number;
  finance_discount_per_installment_cents: number;
  finance_punctuality_discount_cents: number;
  finance_fine_rate_bps: number;
  finance_monthly_interest_rate_bps: number;
  finance_grace_days: number;
  finance_allow_manual_clearance: boolean;
  show_future_notice: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type MyReenrollmentState =
  | 'AVAILABLE'
  | 'CAMPAIGN_UPCOMING'
  | 'NO_AUTHORIZED_STUDENTS'
  | 'GUARDIANSHIP_INVALID'
  | 'SOURCE_ENROLLMENT_MISSING'
  | 'CAMPAIGN_ENDED'
  | 'STUDENT_INELIGIBLE'
  | 'NO_CAMPAIGN';

export interface MyReenrollmentCampaign {
  campaign: ReenrollmentCampaign;
  state: 'OPEN' | 'UPCOMING' | 'CLOSED';
  eligible_students: Array<{
    student_id: string;
    can_confirm: boolean;
    eligibility_state:
      | 'ELIGIBLE'
      | 'REQUEST_EXISTS'
      | 'SOURCE_ENROLLMENT_MISSING'
      | 'STUDENT_INELIGIBLE'
      | 'GRADE_RULE_REQUIRED';
    current_grade_level: string | null;
  }>;
}

export interface MyReenrollmentStatus {
  state: MyReenrollmentState;
  campaigns: MyReenrollmentCampaign[];
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
  destination_stage?: string | null;
  pending_reason?: string | null;
  final_enrollment_id?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
  receipt_code?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string | null;
  destination_class_name?: string | null;
}

export interface ReenrollmentReviewInput {
  requestId: string;
  academicStatus: Exclude<ReenrollmentAcademicStatus, "NOT_EVALUATED">;
  financialStatus: ReenrollmentFinancialStatus;
  destinationClassId?: string | null;
  notes?: string | null;
}

export interface ReenrollmentAnnualResultInput {
  requestId: string;
  resultStatus: ReenrollmentAnnualResultStatus;
  recoveryPending?: boolean;
  averagePercentage?: number | null;
  attendancePercentage?: number | null;
  decisionOrigin?: "ACADEMIC_TEAM" | "CLASS_COUNCIL" | "MANUAL_REVIEW";
  destinationGradeLevel?: string | null;
  destinationStage?: string | null;
  notes?: string | null;
}

export interface ReenrollmentDashboard {
  rows: Array<ReenrollmentRequest & { destination_class_name?: string | null }>;
  total_count: number;
  page: number;
  page_size: number;
  counts_by_status: Record<string, number>;
}

export type ReenrollmentPromotionPolicy =
  | "PROMOTE"
  | "RETAIN"
  | "GRADUATE"
  | "MANUAL";

export interface ReenrollmentGradeRule {
  id: string;
  institution_id: string;
  source_grade_level: string;
  destination_grade_level: string | null;
  destination_stage: string | null;
  promotion_policy: ReenrollmentPromotionPolicy;
  active: boolean;
}

const CAMPAIGN_COLUMNS = [
  "id",
  "institution_id",
  "academic_calendar_event_id",
  "source_academic_year_id",
  "destination_academic_year_id",
  "title",
  "description",
  "status",
  "opens_at",
  "closes_at",
  "target_audience",
  "eligible_grade_levels",
  "contract_version",
  "contract_hash",
  "contract_body",
  "require_academic_result",
  "require_financial_clearance",
  "allow_class_choice",
  "finance_mode",
  "finance_monthly_amount_cents",
  "finance_enrollment_fee_cents",
  "finance_installment_count",
  "finance_first_due_date",
  "finance_due_day",
  "finance_scholarship_per_installment_cents",
  "finance_discount_per_installment_cents",
  "finance_punctuality_discount_cents",
  "finance_fine_rate_bps",
  "finance_monthly_interest_rate_bps",
  "finance_grace_days",
  "finance_allow_manual_clearance",
  "show_future_notice",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

const REQUEST_COLUMNS = [
  "id",
  "institution_id",
  "campaign_id",
  "student_id",
  "source_enrollment_id",
  "source_class_id",
  "source_grade_level",
  "destination_grade_level",
  "destination_class_id",
  "academic_status",
  "request_status",
  "financial_status",
  "destination_stage",
  "pending_reason",
  "final_enrollment_id",
  "finalized_by",
  "finalized_at",
  "receipt_code",
  "protocol",
  "confirmed_by",
  "confirmed_at",
  "reviewed_by",
  "reviewed_at",
  "notes",
  "created_at",
  "updated_at",
  "students:student_id(profiles:profile_id(full_name))",
  "classes:destination_class_id(name)",
].join(", ");

function normalizeCampaign(row: unknown): ReenrollmentCampaign {
  return row as ReenrollmentCampaign;
}

function normalizeRequest(row: Record<string, unknown>): ReenrollmentRequest {
  const studentRelation = row.students as
    | { profiles?: { full_name?: string } | Array<{ full_name?: string }> }
    | null
    | undefined;
  const classRelation = row.classes as
    { name?: string } | Array<{ name?: string }> | null | undefined;
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
    throw new Error(
      "A instituição é obrigatória para consultar a rematrícula.",
    );
  }
}

export const reenrollmentService = {
  async getMyStatus(institutionId: string): Promise<MyReenrollmentStatus> {
    assertInstitution(institutionId);
    const { data, error } = await supabase.rpc('get_my_reenrollment_status_v23', {
      p_institution_id: institutionId,
    });
    if (error || !data) {
      throw error ?? new Error('Não foi possível consultar a rematrícula.');
    }
    return data as MyReenrollmentStatus;
  },

  async listCampaigns(institutionId: string): Promise<ReenrollmentCampaign[]> {
    assertInstitution(institutionId);
    const { data, error } = await supabase
      .from("reenrollment_campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(normalizeCampaign);
  },

  async listGradeRules(institutionId: string): Promise<ReenrollmentGradeRule[]> {
    assertInstitution(institutionId);
    const { data, error } = await supabase
      .from("reenrollment_grade_rules")
      .select("id, institution_id, source_grade_level, destination_grade_level, destination_stage, promotion_policy, active")
      .eq("institution_id", institutionId)
      .order("source_grade_level", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ReenrollmentGradeRule[];
  },

  async saveGradeRule(input: {
    institutionId: string;
    sourceGradeLevel: string;
    destinationGradeLevel: string | null;
    destinationStage: string | null;
    promotionPolicy: ReenrollmentPromotionPolicy;
  }): Promise<ReenrollmentGradeRule> {
    assertInstitution(input.institutionId);
    const { data, error } = await supabase.rpc("save_reenrollment_grade_rule_v24", {
      p_institution_id: input.institutionId,
      p_source_grade_level: input.sourceGradeLevel,
      p_destination_grade_level: input.destinationGradeLevel,
      p_destination_stage: input.destinationStage,
      p_promotion_policy: input.promotionPolicy,
    });
    if (error || !data) {
      throw error ?? new Error("Não foi possível salvar a regra de progressão.");
    }
    return data as ReenrollmentGradeRule;
  },

  async listRequests(
    institutionId: string,
    campaignId?: string,
  ): Promise<ReenrollmentRequest[]> {
    assertInstitution(institutionId);
    let query = supabase
      .from("reenrollment_requests")
      .select(REQUEST_COLUMNS)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown as Record<string, unknown>[]) ?? []).map(
      normalizeRequest,
    );
  },

  async createRequest(
    campaignId: string,
    studentId: string,
  ): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc(
      "create_reenrollment_request_v2",
      {
        target_campaign_id: campaignId,
        target_student_id: studentId,
      },
    );
    if (error || !data)
      throw error ?? new Error("Não foi possível preparar a rematrícula.");
    return data as unknown as ReenrollmentRequest;
  },

  async acceptContract(
    requestId: string,
    contractVersion: string,
    contractHash: string,
  ): Promise<unknown> {
    const { data, error } = await supabase.rpc(
      "accept_reenrollment_contract_v1",
      {
        target_request_id: requestId,
        accepted_contract_version: contractVersion,
        accepted_contract_hash: contractHash,
      },
    );
    if (error || !data)
      throw error ?? new Error("Não foi possível registrar o aceite.");
    return data;
  },

  async confirmRequest(requestId: string): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc(
      "confirm_reenrollment_request_v1",
      {
        target_request_id: requestId,
      },
    );
    if (error || !data)
      throw error ?? new Error("Não foi possível confirmar a rematrícula.");
    return data as unknown as ReenrollmentRequest;
  },

  async reviewRequest(
    input: ReenrollmentReviewInput,
  ): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc(
      "review_reenrollment_request_v1",
      {
        target_request_id: input.requestId,
        next_academic_status: input.academicStatus,
        next_financial_status: input.financialStatus,
        next_destination_class_id: input.destinationClassId ?? null,
        review_notes: input.notes?.trim() || null,
      },
    );
    if (error || !data)
      throw error ?? new Error("Não foi possível revisar a solicitação.");
    return data as unknown as ReenrollmentRequest;
  },

  async closeAcademicYear(
    institutionId: string,
    academicYearId: string,
    notes?: string | null,
  ): Promise<unknown> {
    assertInstitution(institutionId);
    const { data, error } = await supabase.rpc(
      "close_reenrollment_academic_year_v2",
      {
        p_institution_id: institutionId,
        p_academic_year_id: academicYearId,
        p_notes: notes?.trim() || null,
      },
    );
    if (error || !data)
      throw (
        error ?? new Error("Não foi possível fechar o ano para a rematrícula.")
      );
    return data;
  },

  async homologateAnnualResult(
    input: ReenrollmentAnnualResultInput,
  ): Promise<ReenrollmentRequest> {
    const { data, error } = await supabase.rpc(
      "homologate_reenrollment_result_v2",
      {
        p_request_id: input.requestId,
        p_result_status: input.resultStatus,
        p_recovery_pending:
          input.recoveryPending ?? input.resultStatus === "RECOVERY",
        p_average_percentage: input.averagePercentage ?? null,
        p_attendance_percentage: input.attendancePercentage ?? null,
        p_decision_origin: input.decisionOrigin ?? "MANUAL_REVIEW",
        p_destination_grade_level: input.destinationGradeLevel?.trim() || null,
        p_destination_stage: input.destinationStage?.trim() || null,
        p_notes: input.notes?.trim() || null,
      },
    );
    if (error || !data)
      throw error ?? new Error("Não foi possível homologar o resultado anual.");
    return (data as { request: ReenrollmentRequest }).request;
  },

  async ensureFinance(requestId: string): Promise<unknown> {
    const { data, error } = await supabase.rpc(
      "ensure_reenrollment_finance_v2",
      {
        p_request_id: requestId,
      },
    );
    if (error || !data)
      throw (
        error ??
        new Error("Não foi possível preparar a cobrança da rematrícula.")
      );
    return data;
  },

  async clearFinance(
    requestId: string,
    status: "CLEARED" | "BLOCKED" | "WAIVED",
    notes?: string | null,
  ): Promise<unknown> {
    const { data, error } = await supabase.rpc(
      "clear_reenrollment_finance_v2",
      {
        p_request_id: requestId,
        p_status: status,
        p_notes: notes?.trim() || null,
      },
    );
    if (error || !data)
      throw (
        error ?? new Error("Não foi possível registrar a decisão financeira.")
      );
    return data;
  },

  async finalizeRequest(requestId: string): Promise<unknown> {
    const { data, error } = await supabase.rpc("finalize_reenrollment_v2", {
      p_request_id: requestId,
    });
    if (error || !data)
      throw (
        error ??
        new Error("Não foi possível verificar a efetivação da rematrícula.")
      );
    return data;
  },

  async getDashboard(
    institutionId: string,
    campaignId?: string,
    page = 1,
    pageSize = 25,
  ): Promise<ReenrollmentDashboard> {
    assertInstitution(institutionId);
    const { data, error } = await supabase.rpc("reenrollment_dashboard_v2", {
      p_institution_id: institutionId,
      p_campaign_id: campaignId ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error || !data)
      throw (
        error ?? new Error("Não foi possível carregar o painel da rematrícula.")
      );
    return data as unknown as ReenrollmentDashboard;
  },
};
