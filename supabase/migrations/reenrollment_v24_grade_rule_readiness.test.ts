import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261110020000_reenrollment_v24_grade_rule_readiness.sql", import.meta.url),
  "utf8",
);

describe("reenrollment V2.4 grade-rule readiness", () => {
  it("preserves the V2.3 visibility implementation and authenticates its public wrapper", () => {
    expect(migration).toContain("get_my_reenrollment_status_core_v23(uuid)");
    expect(migration).toContain("public.get_my_reenrollment_status_core_v23(p_institution_id)");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to current_user");
    expect(migration).toContain("revoke all on function public.get_my_reenrollment_status_v23(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.get_my_reenrollment_status_v23(uuid) to authenticated");
  });

  it("matches the request RPC's campaign and institution progression rules", () => {
    expect(migration).toContain("mapping.promotion_policy <> 'NOT_ELIGIBLE'");
    expect(migration).toContain("mapping.promotion_policy = 'NOT_ELIGIBLE'");
    expect(migration).toContain("mapping.destination_grade_level");
    expect(migration).toContain("rule.institution_id = p_institution_id");
    expect(migration).toContain("'STUDENT_INELIGIBLE'::text");
    expect(migration).toContain("'GRADE_RULE_REQUIRED'::text");
  });

  it("saves rules atomically without bypassing staff RLS", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("public.can_manage_institution_operations(p_institution_id)");
    expect(migration).toContain("on conflict (institution_id, (lower(trim(source_grade_level))))");
    expect(migration).toContain("grant execute on function public.save_reenrollment_grade_rule_v24");
    expect(migration).not.toMatch(/drop\s+table|delete\s+from\s+public\.(students|enrollments|reenrollment_requests)/i);
  });
});
