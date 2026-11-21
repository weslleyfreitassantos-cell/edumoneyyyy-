import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261121120000_enem_english_legacy_attempt_text_options.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('legacy ENEM English attempts render verified text instead of PDF crops', () => {
  it('resolves current accepted text by canonical question id for older snapshots', () => {
    expect(migration).toContain('structured_row.question_bank_id = attempt_question.question_bank_id');
    expect(migration).toContain('structured_row.content_revision = private.current_enem_content_revision()');
    expect(migration).toContain("structured_row.content_acceptance_status = 'ACCEPTED'");
    expect(migration).toContain("structured_row.render_mode = 'STRUCTURED_TEXT'");
    expect(migration).toContain('private.enem_english_verified_bank_options_v1(question_bank.id)');
  });

  it('never returns visual option or statement crops for English and preserves other subjects', () => {
    expect(migration).toMatch(/when simulation\.metadata->>'enem_subject' = 'INGLES'\s+then coalesce\(/);
    expect(migration).toContain("when simulation.metadata->>'enem_subject' = 'INGLES' or structured.id is not null then '[]'::jsonb");
    expect(migration).toContain("simulation.metadata->>'enem_subject' is distinct from 'INGLES'");
    expect(migration).toContain("option_asset.metadata->>'official_pdf_crop' = 'true'");
    expect(migration).not.toMatch(/update\s+public\.learning_simulation_attempt_questions/i);
    expect(migration).not.toMatch(/update\s+public\.learning_question_bank/i);
  });

  it('keeps the active-student ownership check on the existing read RPC', () => {
    expect(migration).toContain('student.profile_id = auth.uid()');
    expect(migration).toContain('and student.active');
    expect(migration).toContain("raise exception 'ENEM_SIMULATION_ATTEMPT_SCOPE_DENIED'");
    expect(migration).toContain('grant execute on function public.get_enem_simulation_attempt_v2(uuid) to authenticated');
  });
});
