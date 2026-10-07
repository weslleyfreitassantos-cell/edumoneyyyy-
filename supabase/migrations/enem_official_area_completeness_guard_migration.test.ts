import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261007000300_enem_official_area_completeness_guard.sql', import.meta.url),
  'utf8',
);

describe('ENEM official area completeness guard migration', () => {
  it('uses the official 45-question area requirement instead of a reduced declared count', () => {
    expect(migration).toContain("simulation.simulation_type = 'AREA'");
    expect(migration).toContain('45 as official_question_count');
    expect(migration).toContain('having count(simulation_question.id) < 45');
    expect(migration).toContain("'official_question_count', incomplete.official_question_count");
    expect(migration).toContain("status = 'ARCHIVED'");
  });

  it('does not touch dynamic templates or create replacement questions', () => {
    expect(migration).toContain("coalesce(simulation.metadata->>'dynamic_pool', 'false') <> 'true'");
    expect(migration).not.toContain('insert into public.learning_simulation_questions');
    expect(migration).not.toContain('insert into public.learning_question_bank');
  });
});
