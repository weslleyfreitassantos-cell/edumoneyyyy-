import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261103224726_reenrollment_automatic_v1.sql", import.meta.url),
  "utf8",
);

describe("reenrollment migration safety", () => {
  it("is additive, tenant-scoped, and protected by RLS", () => {
    expect(migration).toContain(
      "create table if not exists public.reenrollment_campaigns",
    );
    expect(migration).toContain(
      "create table if not exists public.reenrollment_requests",
    );
    expect(migration).toContain(
      "alter table public.reenrollment_requests enable row level security",
    );
    expect(migration).toContain("private.reenrollment_user_can_act_on_student");
    expect(migration).toContain("public.can_manage_institution_operations");
  });

  it("never creates a real enrollment or financial charge", () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.enrollments/i);
    expect(migration).not.toMatch(/create_financial_contract_with_invoices/i);
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.(invoices|financial_contracts|payments)/i,
    );
  });

  it("requires the signed contract before confirmation", () => {
    expect(migration).toContain("REENROLLMENT_CONTRACT_NOT_ACCEPTED");
    expect(migration).toContain("CONTRACT_ACCEPTED");
    expect(migration).toContain("REQUEST_CONFIRMED");
  });

  it("uses explicit record targets when reading the source enrollment", () => {
    expect(migration).toContain("select enrollment.*");
    expect(migration).toContain("into source_enrollment");
    expect(migration).toContain("select class_record.*");
    expect(migration).toContain("into source_class");
    expect(migration).not.toMatch(
      /select enrollment, class_record[\s\S]*into source_enrollment, source_class/i,
    );
  });
});
