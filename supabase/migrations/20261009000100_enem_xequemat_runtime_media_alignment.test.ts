import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('./20261009000100_enem_xequemat_runtime_media_alignment.sql', import.meta.url),
  'utf8',
);

describe('ENEM Xequemat runtime media alignment migration', () => {
  it('uses the validated v1 pool as the current snapshot gate', () => {
    expect(migration).toContain('private.enem_ready_provider_text_questions(null, null, null)');
    expect(migration).toContain("ready.structured_content_id = new.structured_content_id");
    expect(migration).toContain("raise exception 'ENEM_ATTEMPT_SNAPSHOT_STRUCTURED_CONTENT_MISMATCH'");
    expect(migration).not.toContain("structured.render_mode = 'STRUCTURED_TEXT'");
    expect(migration).not.toContain('not structured.required_media_present');
  });

  it('keeps historical snapshot validation and synchronizes template metadata', () => {
    expect(migration).toContain("structured.content_revision = attempt_revision");
    expect(migration).toContain("'content_revision', private.current_enem_content_revision()");
    expect(migration).toContain("metadata->>'dynamic_pool' = 'true'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_(?:enem_structured_content|simulation_attempts|simulation_attempt_questions)/iu);
  });
});
