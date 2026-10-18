import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./20261018000700_enem_snapshot_validation_timeout_fix.sql", import.meta.url),
  "utf8",
);

describe("ENEM snapshot validation timeout migration", () => {
  it("validates the snapshot through indexed source ids", () => {
    expect(migration).toContain("create or replace function private.validate_enem_attempt_question_snapshot()");
    expect(migration).toContain("structured.id = new.structured_content_id");
    expect(migration).toContain("structured.question_bank_id = new.question_bank_id");
    expect(migration).not.toContain("from private.enem_ready_provider_text_questions(null, null, null)");
    expect(migration).not.toContain("from private.enem_ready_english_practice_questions_v1() ready");
  });

  it("keeps current revision, source, readiness and legacy validation guards", () => {
    expect(migration).toContain("private.current_enem_content_revision()");
    expect(migration).toContain("ENEM_ATTEMPT_SNAPSHOT_SOURCE_REQUIRED");
    expect(migration).toContain("ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH");
    expect(migration).toContain("private.enem_provider_statement_complete_v4");
    expect(migration).toContain("ENEM_ATTEMPT_SNAPSHOT_SOURCE_MISMATCH");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
