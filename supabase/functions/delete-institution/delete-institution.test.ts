import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('delete-institution coverage', () => {
  it('covers adaptive and timetable records before deleting the institution', () => {
    for (const table of [
      'learning_attempts',
      'learning_guided_sessions',
      'learning_simulation_attempts',
      'learning_question_bank',
      'learning_student_skill_state',
      'timetable_version_entries',
      'timetable_versions',
      'teacher_availability',
    ]) {
      expect(source).toContain(`"${table}"`);
    }
  });

  it('keeps deletion limited to an explicit institution id', () => {
    expect(source).toContain('.eq("id", institution.id)');
    expect(source).toContain('.eq("institution_id", institutionId)');
  });
});
