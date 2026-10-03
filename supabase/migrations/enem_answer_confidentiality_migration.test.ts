import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20261003000600_enem_answer_confidentiality.sql'), 'utf8');

describe('ENEM answer confidentiality migration', () => {
  it('removes table-wide authenticated reads and grants content columns only', () => {
    expect(migration).toContain('revoke select on table public.learning_question_bank from authenticated');
    expect(migration).toContain('grant select (');
    expect(migration).not.toMatch(/grant select \([^)]*\bcorrect_answer\b/s);
    expect(migration).toContain('to authenticated');
  });
});
