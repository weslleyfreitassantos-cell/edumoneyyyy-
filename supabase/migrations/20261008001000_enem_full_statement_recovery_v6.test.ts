import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('./20261008001000_enem_full_statement_recovery_v6.sql', import.meta.url), 'utf8');

describe('ENEM v6 full statement recovery migration', () => {
  it('promotes only a forward revision and keeps the padaria recovery explicit', () => {
    expect(migration).toContain("select 'structured-text-only-v6'::text");
    expect(migration).toContain("structured.content_revision = 'structured-text-only-v5'");
    expect(migration).toContain('2015:150:matematica:COMMON');
    expect(migration).toContain('R$ 300,00');
    expect(migration).toContain('user_verified_canary_reference');
    expect(migration).toContain("structured-text-only-v5'");
  });

  it('does not delete or update historical revisions', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.learning_(?:enem_structured_content|simulation_attempts|simulation_attempt_questions)/iu);
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('truncate');
  });

  it('uses the v6 semantic gate for the new pool', () => {
    expect(migration).toContain('private.enem_provider_semantic_complete_v6');
    expect(migration).toContain("structured.content_revision = private.current_enem_content_revision()");
    expect(migration).toContain("structured.content_acceptance_status = 'ACCEPTED'");
  });
});
