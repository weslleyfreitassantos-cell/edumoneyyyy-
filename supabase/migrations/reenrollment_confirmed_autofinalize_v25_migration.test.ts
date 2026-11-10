import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261110040000_reenrollment_confirmed_autofinalize_v25.sql", import.meta.url),
  "utf8",
);

describe("reenrollment V2.5 confirmed auto-finalization migration", () => {
  it("requires explicit confirmation before enrollment creation", () => {
    expect(migration).toContain("request_row.confirmed_at is null");
    expect(migration).toContain("REMATRICULA_NAO_CONFIRMADA");
    expect(migration).toContain("insert into public.enrollments");
    expect(migration).toContain("CONTRATO_NAO_ACEITO");
  });

  it("limits finalization to institution managers or the authorized student family", () => {
    expect(migration).toContain("public.can_manage_institution_operations(request_row.institution_id)");
    expect(migration).toContain(
      "private.reenrollment_user_can_act_on_student(\n      request_row.institution_id, request_row.student_id",
    );
    expect(migration).toContain(
      "revoke all on function private.finalize_reenrollment_v25_core(uuid)",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
  });

  it("rechecks prerequisites when confirmation, academic, finance, documents, or capacity changes", () => {
    for (const trigger of [
      "reenrollment_auto_finalize_request_v25",
      "reenrollment_auto_finalize_documents_v25",
      "reenrollment_auto_finalize_finance_link_v25",
      "reenrollment_auto_finalize_academic_result_v25",
      "reenrollment_auto_finalize_contract_acceptance_v25",
      "reenrollment_auto_finalize_invoice_v25",
      "reenrollment_auto_finalize_payment_v25",
      "reenrollment_auto_finalize_document_requirement_v25",
      "reenrollment_auto_finalize_class_v25",
      "reenrollment_auto_finalize_enrollment_v25",
    ]) {
      expect(migration).toContain(`create trigger ${trigger}`);
    }
    expect(migration).toContain("pg_trigger_depth() > 1");
    expect(migration).toContain(
      "current_setting('tecescola.reenrollment_v25_finalizing', true) = 'on'",
    );
    expect(migration).toContain("request.destination_class_id = any(class_ids)");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
