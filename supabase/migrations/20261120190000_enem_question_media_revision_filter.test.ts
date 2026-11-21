import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261120190000_enem_question_media_revision_filter.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('ENEM attempt media revision filter', () => {
  it('returns only ready official crops from the attempt revision for both statement and alternatives', () => {
    expect(migration.match(/metadata->>'official_pdf_crop' = 'true'/g)).toHaveLength(3);
    expect(migration.match(/metadata->>'render_ready' = 'true'/g)).toHaveLength(3);
    expect(migration.match(/metadata->>'revision' = attempt_row\.content_revision/g)).toHaveLength(3);
    expect(migration).toContain("coalesce(statement_asset.metadata->>'asset_role', 'STATEMENT') = 'STATEMENT'");
    expect(migration).toContain("option_asset.metadata->>'asset_role' = 'OPTION_' || chr(64 + option_item.ordinality::integer)");
  });

  it('preserves student ownership and authenticated-only RPC execution', () => {
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain("raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'");
    expect(migration).toContain('revoke all on function public.get_enem_simulation_attempt_v2(uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated');
  });
});
