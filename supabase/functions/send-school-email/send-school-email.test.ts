import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);

describe("send-school-email", () => {
  it("requires a JWT and an active DIRECTOR or SECRETARY membership", () => {
    expect(source).toContain('withSupabase<Database>({ auth: "user" }');
    expect(source).toContain('membership.active === true');
    expect(source).toContain('membership.role === "DIRECTOR"');
    expect(source).toContain('membership.role === "SECRETARY"');
    expect(source).toContain('"INSUFFICIENT_PERMISSION"');
  });

  it("resolves recipients inside the requested institution", () => {
    expect(source).toContain('.eq("institution_id", institutionId)');
    expect(source).toContain('"RECIPIENT_OUTSIDE_INSTITUTION"');
    expect(source).toContain("validateSelectedRecipientIds");
    expect(source).toContain("guardianships");
    expect(source).toContain("students:student_id");
  });

  it("uses the configured Resend secret and bounded sequential batches", () => {
    expect(source).toContain("getResendApiKey");
    expect(source).toContain("RESEND_RATE_LIMITED");
    expect(source).toContain('Deno.env.get("EMAIL_FROM")');
    expect(source).toContain("offset += 100");
    expect(source).toContain('https://api.resend.com/emails/batch');
    expect(source).not.toContain("Promise.all");
  });

  it("returns a semantic failure instead of reporting success after provider errors", () => {
    expect(source).toContain("readResendFailure(response)");
    expect(source).toContain("createResendNetworkFailure(error)");
    expect(source).toContain("providerFailure");
    expect(source).toContain("success: false");
    expect(source).toContain("recipientCount: selectedRecipients.length");
  });

  it("never accepts an arbitrary email list or logs message content", () => {
    expect(source).not.toContain("emails:");
    expect(source).not.toContain("recipientEmails");
    expect(source).toContain("buildInstitutionMessageEmail");
    expect(source).toContain("requestId");
    expect(source).toContain('code: details.code');
  });
});
