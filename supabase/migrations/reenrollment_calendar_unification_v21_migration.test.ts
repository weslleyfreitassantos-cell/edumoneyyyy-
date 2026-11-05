import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261105013857_reenrollment_calendar_unification_v21.sql", import.meta.url),
  "utf8",
);

describe("reenrollment V2.1 calendar migration safety", () => {
  it("links campaigns to calendar events without deleting existing history", () => {
    expect(migration).toContain(
      "add column if not exists academic_calendar_event_id uuid",
    );
    expect(migration).toContain("on delete set null");
    expect(migration).toContain(
      "create unique index if not exists reenrollment_campaign_calendar_event_uidx",
    );
    expect(migration).not.toMatch(/delete\s+from\s+public\.(reenrollment_campaigns|reenrollment_requests)/i);
    expect(migration).not.toMatch(/on delete cascade/i);
  });

  it("publishes atomically, tenant-scoped, and computes the contract hash server-side", () => {
    expect(migration).toContain("public.publish_reenrollment_calendar_event_v21");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_institution_id::text, 217))");
    expect(migration).toContain("year_record.institution_id = p_institution_id");
    expect(migration).toContain("extensions.digest(convert_to(contract_body_value, 'UTF8'), 'sha256')");
    expect(migration).toContain("REENROLLMENT_CAMPAIGN_ALREADY_LINKED");
    expect(migration).toContain("REENROLLMENT_CONFIGURATION_LOCKED_AFTER_REQUESTS");
    expect(migration).toContain("REENROLLMENT_CONTRACT_LOCKED_AFTER_ACCEPTANCE");
    expect(migration).not.toMatch(/finance_create_contract|invoice_create|create_invoice/i);
  });

  it("keeps publication and lifecycle writes on the calendar RPC path", () => {
    expect(migration).toContain("event_type <> 'RE_ENROLLMENT'::public.academic_calendar_event_type");
    expect(migration).toContain("revoke insert, update, delete on table public.reenrollment_campaigns from authenticated");
    expect(migration).toContain("public.set_academic_calendar_event_active_v21");
    expect(migration).toContain("private.sync_reenrollment_campaign_from_calendar_event_v21");
    expect(migration).toContain("private.sync_calendar_event_from_reenrollment_campaign_v21");
    expect(migration).toContain("public.get_my_reenrollment_status_v21");
    expect(migration).toContain("grant execute on function private.accept_reenrollment_contract_v1(uuid, text, text) to authenticated");
    expect(migration).toContain("grant execute on function private.confirm_reenrollment_request_v1(uuid) to authenticated");
    expect(migration).toContain("student.birth_date <= (current_date - interval '18 years')::date");
    expect(migration).toContain("guardianship.guardian_profile_id = auth.uid()");
  });
});
