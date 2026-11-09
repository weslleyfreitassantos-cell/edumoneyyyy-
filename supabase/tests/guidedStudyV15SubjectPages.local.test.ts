import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/20261109222345_guided_study_v11_content_version_v15.sql', import.meta.url),
  'utf8',
);

describe('Guided Study V15 subject-page migration', () => {
  it('changes only the V11 initial diagnostic selector and falls back to the legacy V4 set', () => {
    expect(migration).toContain("to_regprocedure('public.start_guided_study_v11_pre_v12(uuid)')");
    expect(migration).toContain("pg_get_functiondef('public.start_guided_study_v11_pre_v12(uuid)'::regprocedure)");
    expect(migration).toContain("regexp_matches(function_definition, 'question_set[[:space:]]*[.][[:space:]]*version[[:space:]]*=[[:space:]]*4', 'g')");
    expect(migration).toContain('regexp_replace(function_definition');
    expect(migration).toContain("skill.metadata->>''content_version''");
    expect(migration).toContain('question_set.canonical_skill_id), 4)');
    expect(migration).toContain('GUIDED_STUDY_V15_V11_START_SOURCE_SHAPE_CHANGED');
    expect(migration).not.toMatch(/\b(delete|truncate)\s+from\b/i);
    expect(migration).not.toMatch(/\binsert\s+into\s+public\.(learning_guided_sessions|learning_skill_evidence)/i);
    expect(migration).toContain('notify pgrst');
  });
});
