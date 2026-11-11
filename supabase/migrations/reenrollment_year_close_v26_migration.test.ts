import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261110050000_reenrollment_year_close_v26.sql", import.meta.url),
  "utf8",
);
const ciWorkflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

describe("reenrollment V2.6 academic year close", () => {
  it("calculates from finalized grades and attendance using the configured arithmetic mean", () => {
    expect(migration).toContain("ARITHMETIC_MEAN_PER_SUBJECT_V1");
    expect(migration).toContain("avg(result.final_grade_percentage)");
    expect(migration).toContain("avg(result.attendance_percentage)");
    expect(migration).toContain("finalized_at is not null");
    expect(migration).toContain("PUBLISHED_RECOVERY_NOT_APPLIED");
    expect(migration).toContain("TRANSFER_HISTORY_REQUIRES_REVIEW");
    expect(migration).toContain("source_grade_level = annual_result.source_grade_level");
    expect(migration).toContain("normalize_reenrollment_grade_level_v26(annual_result.source_grade_level)");
  });

  it("blocks incomplete official inputs and persists immutable, versioned snapshots", () => {
    for (const blocker of [
      "PENDING_TERM_CLOSURES",
      "MISSING_FINAL_RESULTS",
      "DRAFT_RECOVERIES",
      "ACADEMIC_POLICY_MISSING_OR_AMBIGUOUS",
      "DUPLICATE_ACTIVE_ENROLLMENTS",
    ]) {
      expect(migration).toContain(blocker);
    }
    expect(migration).toContain("reenrollment_academic_year_close_runs");
    expect(migration).toContain("student_academic_year_results");
    expect(migration).toContain("source_digest");
    expect(migration).toContain("is_current = false");
    expect(migration).not.toMatch(/delete\s+from\s+public\.student_academic_year_results/i);
  });

  it("uses the existing V25 finalizer and only selects or assigns safe destination classes", () => {
    expect(migration).toContain("private.finalize_reenrollment_v25_core(request_row.id)");
    expect(migration).toContain("candidate_count = 1");
    expect(migration).toContain("REENROLLMENT_DESTINATION_CLASS_FULL");
    expect(migration).toContain("DESTINATION_CLASS_ASSIGNED");
    expect(migration).toContain("REENROLLMENT_CLASS_ASSIGNMENT_JUSTIFICATION_REQUIRED");
    expect(migration).not.toMatch(/delete\s+from\s+public\.enrollments/i);
  });

  it("determines the next grade independently from destination class availability", () => {
    expect(migration).toContain("private.next_reenrollment_grade_label_v26(next_level)");
    expect(migration).toContain("next_grade := coalesce(next_grade, private.next_reenrollment_grade_label_v26(next_level))");
    expect(migration).toContain("if total_class_count = 0 then");
    expect(migration).toContain("pending_reason_value := 'TURMA_DESTINO_NAO_DEFINIDA'");
    expect(migration).toContain("pending_reason_value := 'SEM_VAGA_NA_TURMA'");
  });

  it("removes legacy rule blockers without widening confirmation authorization", () => {
    const createRequest = migration.slice(
      migration.indexOf("create or replace function public.create_reenrollment_request_v2"),
      migration.indexOf("-- Replace V24's rule-required state"),
    );
    const statusWrapper = migration.slice(
      migration.indexOf("create or replace function public.get_my_reenrollment_status_v23"),
      migration.indexOf("create or replace function private.invalidate_reenrollment_year_close_v26"),
    );

    expect(createRequest).toContain("private.create_reenrollment_request_v1");
    expect(createRequest).not.toContain("REENROLLMENT_GRADE_RULE_REQUIRED");
    expect(statusWrapper).toContain("'{eligibility_state}'");
    expect(statusWrapper).not.toContain("'{can_confirm}'");
  });

  it("keeps year-close results institution-scoped and read-only for API users", () => {
    expect(migration).toContain("alter table public.student_academic_year_results enable row level security");
    expect(migration).toContain("private.reenrollment_user_can_act_on_student(institution_id, student_id)");
    expect(migration).toContain("public.can_manage_institution_operations(p_institution_id)");
    expect(migration).toContain("grant select on table public.student_academic_year_results to authenticated");
    expect(migration).toContain("revoke all on function private.calculate_reenrollment_year_results_v26");
  });

  it("records V26 after its focused direct apply instead of applying it twice", () => {
    const directApplyStart = ciWorkflow.indexOf(
      "name: Aplicar e validar rematrícula automática V1, V2, V2.1, V2.3, V2.4, V2.5 e V2.6",
    );
    const migrationUpStart = ciWorkflow.indexOf("name: Aplicar migration V8 após carregar o catálogo canônico");
    const nextStepStart = ciWorkflow.indexOf(
      "name: Provar idempotência da migration de conteúdo V13 em PostgreSQL descartável",
      migrationUpStart,
    );

    expect(directApplyStart).toBeGreaterThanOrEqual(0);
    expect(migrationUpStart).toBeGreaterThan(directApplyStart);
    expect(nextStepStart).toBeGreaterThan(migrationUpStart);

    const directApplyStep = ciWorkflow.slice(directApplyStart, migrationUpStart);
    const migrationUpStep = ciWorkflow.slice(migrationUpStart, nextStepStart);
    const v26Migration = "20261110050000_reenrollment_year_close_v26.sql";
    const deferredArrayStart = migrationUpStep.indexOf("reenrollment_migrations=(");
    const deferredArrayEnd = migrationUpStep.indexOf("\n          )", deferredArrayStart);

    expect(directApplyStep).toContain(v26Migration);
    expect(deferredArrayStart).toBeGreaterThanOrEqual(0);
    expect(deferredArrayEnd).toBeGreaterThan(deferredArrayStart);
    expect(migrationUpStep.slice(deferredArrayStart, deferredArrayEnd)).toContain(v26Migration);
    expect(migrationUpStep).toContain("20261110050000");
    expect(migrationUpStep).toContain("expected_versions");
  });
});
