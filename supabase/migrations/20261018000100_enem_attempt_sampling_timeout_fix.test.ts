import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261018000100_enem_attempt_sampling_timeout_fix.sql", import.meta.url),
  "utf8",
);

describe("ENEM attempt sampling timeout migration", () => {
  it("replaces volatile random sorting with a student-scoped stable seed", () => {
    expect(migration).toContain("create or replace function public.start_enem_simulation_attempt_v2");
    expect(migration).toContain("create or replace function public.start_enem_simulation_attempt_v3");
    expect(migration).toContain("hashtextextended");
    expect(migration).toContain("p_student_id::text");
    expect(migration).toContain("current_date::text");
    expect(migration).not.toMatch(/order\s+by\s+random\s*\(\s*\)/i);
  });

  it("keeps the authorization, recent-question exclusion, snapshot and RLS grants", () => {
    expect(migration).toContain("student.profile_id = auth.uid()");
    expect(migration).toContain("previous_attempt.started_at > now() - interval '90 days'");
    expect(migration).toContain("learning_simulation_attempt_questions");
    expect(migration).toContain("revoke all on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) from public, anon");
    expect(migration).toContain("grant execute on function public.start_enem_simulation_attempt_v2(uuid, uuid, uuid, text) to authenticated");
  });
});
