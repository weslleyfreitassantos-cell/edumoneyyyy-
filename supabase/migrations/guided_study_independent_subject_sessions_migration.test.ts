import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261118000100_guided_study_independent_subject_sessions.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('guided study independent subject sessions migration', () => {
  it('removes the V16 cross-subject session gate from both subject RPCs', () => {
    expect(migration).toContain("'public.get_guided_study_subject_overview_v16(uuid,uuid)'::regprocedure");
    expect(migration).toContain("'public.start_guided_study_subject_v16(uuid,uuid)'::regprocedure");
    expect(migration).toContain("'''ACTIVE_SESSION_OTHER_SUBJECT'''");
    expect(migration).toContain('GUIDED_STUDY_V18_CROSS_SUBJECT_GUARD_SHAPE_CHANGED');
  });

  it('preserves subject-scoped planning, authenticated RPC permissions and history', () => {
    expect(migration).toContain("app.guided_study_v16_subject_id");
    expect(migration).toContain('public.start_guided_study_v11(p_institution_id)');
    expect(migration).toContain('grant execute on function public.get_guided_study_subject_overview_v16(uuid, uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.start_guided_study_subject_v16(uuid, uuid) to authenticated');
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.learning_(guided_sessions|guided_steps|skill_evidence|student_skill_state)/i);
    expect(migration).not.toMatch(/drop\s+table|truncate\s+table/i);
  });
});
