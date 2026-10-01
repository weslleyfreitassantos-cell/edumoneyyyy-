import { describe, expect, it } from "vitest";

import { postgresUuidSchema } from "./postgres-uuid";

describe("postgresUuidSchema", () => {
  it("accepts the deterministic Aurora UUID and a conventional UUID", () => {
    expect(postgresUuidSchema.parse("37282104-6ccf-3a9b-d719-7f9fc1a4d40e")).toBe(
      "37282104-6ccf-3a9b-d719-7f9fc1a4d40e",
    );
    expect(postgresUuidSchema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects non-canonical, non-hexadecimal, and arbitrary strings", () => {
    const invalidIds = [
      "not-a-uuid",
      "372821046ccf3a9bd7197f9fc1a4d40e",
      "37282104-6ccf-3a9b-d719-7f9fc1a4d40g",
      " 37282104-6ccf-3a9b-d719-7f9fc1a4d40e",
      "37282104-6ccf-3a9b-d719-7f9fc1a4d40e ",
      "37282104-6ccf-3a9b-d719-7f9fc1a4d40e\n",
      "",
      "https://example.com/uuid",
      "' OR 1=1 --",
    ];

    for (const accountId of invalidIds) {
      expect(postgresUuidSchema.safeParse(accountId).success).toBe(false);
    }
  });
});
