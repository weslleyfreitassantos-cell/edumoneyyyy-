import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const v1 = readFileSync(
  new URL("./20261103224726_reenrollment_automatic_v1.sql", import.meta.url),
  "utf8",
);
const v2 = readFileSync(
  new URL("./20261104003628_reenrollment_automatic_v2.sql", import.meta.url),
  "utf8",
);

describe("reenrollment V2 migration safety", () => {
  it("requires a verified adult student or an active guardianship", () => {
    expect(v1).toContain(
      "student.birth_date <= (current_date - interval '18 years')::date",
    );
    expect(v1).toContain("guardianship.active is true");
    expect(v1).not.toMatch(
      /student\.profile_id\s*=\s*auth\.uid\(\)\s*\n\s*or\s+exists/i,
    );
  });

  it("keeps V2 tenant-scoped and protected by RLS", () => {
    for (const table of [
      "reenrollment_academic_closures",
      "reenrollment_grade_rules",
      "reenrollment_document_requirements",
      "reenrollment_finance_links",
      "reenrollment_completion_records",
    ]) {
      expect(v2).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(v2).toContain("public.can_manage_institution_operations");
    expect(v2).toContain("request.institution_id = p_institution_id");
    expect(v2).toContain(
      "request_row.student_id::text || ':' || campaign.destination_academic_year_id::text",
    );
  });

  it("keeps configuration writes RLS-bound and does not invent a payment gateway", () => {
    expect(v2).toContain(
      "grant select, insert, update, delete on table public.reenrollment_grade_rules to authenticated",
    );
    expect(v2).toContain(
      "grant select, insert, update, delete on table public.reenrollment_document_requirements to authenticated",
    );
    expect(v2).toContain(
      "grant all on table public.reenrollment_grade_rules to service_role",
    );
    expect(v2).not.toMatch(
      /grant\s+(insert|update|delete).*reenrollment.*\s+to\s+(public|anon)/i,
    );
    expect(v2).toContain("public.finance_create_contract_v2");
    expect(v2).toContain("MANUAL_NO_BANK_SETTLEMENT");
    expect(v2).not.toContain("payment_provider_accounts");
  });

  it("requires the full finalization gate and preserves history", () => {
    for (const blocker of [
      "CONTRATO_NAO_ACEITO",
      "RESULTADO_NAO_HOMOLOGADO",
      "SERIE_DESTINO_NAO_DEFINIDA",
      "TURMA_DESTINO_NAO_DEFINIDA",
      "DOCUMENTOS_PENDENTES",
      "PAGAMENTO_NAO_LIQUIDADO",
      "MATRICULA_ATIVA_DUPLICADA",
    ]) {
      expect(v2).toContain(blocker);
    }
    expect(v2).toContain("insert into public.enrollments");
    expect(v2).toContain(
      "academic_year_id = campaign.destination_academic_year_id",
    );
    expect(v2).not.toMatch(/delete\s+from\s+public\.enrollments/i);
    expect(v2).toContain("request_status = 'ENROLLED'");
    expect(v2).toContain("pg_advisory_xact_lock");
  });

  it("supports annual results without guessing grade from a class label", () => {
    expect(v2).toContain("reenrollment_grade_rules");
    expect(v2).toContain("REENROLLMENT_ACADEMIC_YEAR_NOT_CLOSED");
    expect(v2).toContain("REENROLLMENT_DESTINATION_GRADE_REQUIRED");
    expect(v2).toContain("CONCLUIDOR_TRATAMENTO_PROPRIO");
    expect(v2).not.toMatch(/split_part\([^\n]*class[^\n]*name/i);
    expect(v2).toContain("promotion_policy = 'MANUAL'");
    expect(v2).toContain("result_row.result_status, '') <> 'GRADUATING'");
  });

  it("makes finance constraints safe to reapply", () => {
    expect(v2).toContain("pg_catalog.pg_constraint");
    expect(v2).toContain("reenrollment_campaign_finance_mode_check");
    expect(v2).toContain("reenrollment_campaign_finance_due_day_check");
  });
});
