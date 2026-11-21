import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261121024554_enem_language_snapshot_media_revision_fix.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('ENEM language snapshot and official media revision fix', () => {
  it('validates Spanish against the exact accepted Spanish pool entry', () => {
    const spanishBranch = migration.slice(
      migration.indexOf("if attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'ESPANHOL' then"),
      migration.indexOf("elsif attempt_enem_mode = 'SUBJECT' and attempt_enem_subject = 'INGLES' then"),
    );

    expect(spanishBranch).toContain("private.enem_ready_provider_text_questions(null, 'ESPANHOL', 'SPANISH')");
    expect(spanishBranch).toContain('ready.question_id = new.question_bank_id');
    expect(spanishBranch).toContain('ready.structured_content_id = new.structured_content_id');
    expect(spanishBranch).toContain("ready.source_kind = 'STRUCTURED_PROVIDER'");
    expect(spanishBranch).toContain("ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH");
    expect(migration).toContain('student.profile_id = auth.uid()');
  });

  it('uses source revision for legacy media without relaxing official crop checks', () => {
    expect(migration.match(/metadata->>'revision' = coalesce\(nullif\(question_bank\.metadata->>'content_revision', ''\), attempt_row\.content_revision\)/g)).toHaveLength(3);
    expect(migration.match(/metadata->>'official_pdf_crop' = 'true'/g)).toHaveLength(3);
    expect(migration.match(/metadata->>'render_ready' = 'true'/g)).toHaveLength(4);
    expect(migration).toContain("coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'");
    expect(migration).toContain("option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)");
    expect(migration).toContain('grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated');
  });
});
