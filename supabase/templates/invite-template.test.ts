import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync(
  new URL("./invite.html", import.meta.url),
  "utf8",
);
const config = readFileSync(
  new URL("../config.toml", import.meta.url),
  "utf8",
);

describe("invite email template", () => {
  it("uses Supabase ConfirmationURL so redirectTo is preserved", () => {
    expect(template).toContain("{{ .ConfirmationURL }}");
    expect(template).not.toContain("{{ .SiteURL }}");
  });

  it("registers the template in the local Supabase Auth config", () => {
    expect(config).toContain("[auth.email.template.invite]");
    expect(config).toContain('content_path = "./supabase/templates/invite.html"');
  });
});
