import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261007000200_enem_historical_publication_guard.sql', import.meta.url),
  'utf8',
);

describe('ENEM historical publication guard migration', () => {
  it('archives only published official sets whose linked count is incomplete', () => {
    expect(migration).toContain("simulation.status = 'PUBLISHED'");
    expect(migration).toContain("simulation.metadata->>'source_integrity' = 'VERIFIED'");
    expect(migration).toContain("simulation.metadata ? 'enem_import_key'");
    expect(migration).toContain("having count(simulation_question.id) < simulation.question_count");
    expect(migration).toContain("status = 'ARCHIVED'");
    expect(migration).toContain("'INCOMPLETE_OFFICIAL_QUESTION_SET'");
  });

  it('does not archive dynamic templates or fabricate question links', () => {
    expect(migration).toContain("coalesce(simulation.metadata->>'dynamic_pool', 'false') <> 'true'");
    expect(migration).not.toContain('insert into public.learning_simulation_questions');
    expect(migration).not.toContain('insert into public.learning_question_bank');
  });
});
