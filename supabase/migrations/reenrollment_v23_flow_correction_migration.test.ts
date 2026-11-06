import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261106001430_reenrollment_v23_flow_correction.sql", import.meta.url),
  "utf8",
);

describe("reenrollment V2.3 flow migration safety", () => {
  it("returns status only to authenticated users with institutional access", () => {
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("public.can_access_institution(p_institution_id)");
    expect(migration).toContain("student.institution_id = p_institution_id");
    expect(migration).toContain("student.profile_id = auth.uid()");
    expect(migration).toContain("guardianship.guardian_profile_id = auth.uid()");
    expect(migration).toContain("guardianship.active is true");
    expect(migration).toContain("revoke all on function public.get_my_reenrollment_status_v23(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.get_my_reenrollment_status_v23(uuid) to authenticated");
  });

  it("exposes eligibility per authorized dependent and preserves adult-student rules", () => {
    expect(migration).toContain("'eligibility_state'");
    expect(migration).toContain("'current_grade_level'");
    expect(migration).toContain("'SOURCE_ENROLLMENT_MISSING'");
    expect(migration).toContain("'STUDENT_INELIGIBLE'");
    expect(migration).toContain("'REQUEST_EXISTS'");
    expect(migration).toContain("student.birth_date <= (current_date - interval '18 years')::date");
    expect(migration).toContain("campaign.eligible_grade_levels");
  });

  it("distinguishes upcoming and ended campaigns without changing RLS or deleting history", () => {
    expect(migration).toContain("'CAMPAIGN_UPCOMING'");
    expect(migration).toContain("'CAMPAIGN_ENDED'");
    expect(migration).toContain("campaign.show_future_notice is true");
    expect(migration).not.toMatch(/create\s+policy|alter\s+policy|drop\s+policy/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.(reenrollment_campaigns|reenrollment_requests|academic_calendar_events)/i);
  });
});
