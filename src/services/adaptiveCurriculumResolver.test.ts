import { describe, expect, it } from 'vitest';

import { resolveAdaptiveCurriculumTarget, resolveAdaptiveCurriculumTargets } from './adaptiveCurriculumResolver';

const target = (overrides: Partial<{
  canonicalSkillId: string;
  stage: string;
  gradeLevel: number;
  subjectArea: string;
  priority: number;
  sortOrder: number;
}> = {}) => ({
  canonicalSkillId: 'linear-function',
  stage: 'ENSINO_MEDIO',
  gradeLevel: 1,
  subjectArea: 'MATEMATICA',
  priority: 0,
  sortOrder: 0,
  ...overrides,
});

describe('adaptive curriculum resolver', () => {
  it('resolves the configured first-year high-school mathematics target', () => {
    const result = resolveAdaptiveCurriculumTarget([
      {
        classId: 'class-1',
        gradeLevel: '1ª série EM',
        institutionSkillId: 'skill-function',
        canonicalSkillId: 'linear-function',
        subjectArea: 'MATEMATICA',
        target: target(),
      },
    ]);

    expect(result?.canonicalSkillId).toBe('linear-function');
  });

  it('does not use an arbitrary activity when no curricular target exists', () => {
    const result = resolveAdaptiveCurriculumTarget([
      {
        classId: 'class-1',
        gradeLevel: '1º EM',
        institutionSkillId: 'skill-unconfigured',
        canonicalSkillId: 'unconfigured',
        subjectArea: 'MATEMATICA',
        target: target({ canonicalSkillId: 'another-skill' }),
      },
    ]);

    expect(result).toBeNull();
  });

  it('uses explicit priority and sort order rather than input/activity order', () => {
    const result = resolveAdaptiveCurriculumTarget([
      {
        classId: 'class-z',
        gradeLevel: '1 EM',
        institutionSkillId: 'skill-z',
        canonicalSkillId: 'linear-function',
        subjectArea: 'MATEMATICA',
        target: target({ priority: 2 }),
      },
      {
        classId: 'class-a',
        gradeLevel: '1 EM',
        institutionSkillId: 'skill-a',
        canonicalSkillId: 'linear-function',
        subjectArea: 'MATEMATICA',
        target: target({ priority: 1 }),
      },
    ]);

    expect(result?.institutionSkillId).toBe('skill-a');
  });

  it('resolves one deterministic target per class and subject area', () => {
    const result = resolveAdaptiveCurriculumTargets([
      { classId: 'class-1', gradeLevel: '1 EM', institutionSkillId: 'math', canonicalSkillId: 'linear-function', subjectArea: 'MATEMATICA', target: target() },
      { classId: 'class-1', gradeLevel: '1 EM', institutionSkillId: 'portuguese', canonicalSkillId: 'reading', subjectArea: 'LINGUAGENS', target: target({ canonicalSkillId: 'reading', subjectArea: 'LINGUAGENS' }) },
      { classId: 'class-1', gradeLevel: '1 EM', institutionSkillId: 'math-later', canonicalSkillId: 'equations', subjectArea: 'MATEMATICA', target: target({ canonicalSkillId: 'equations', priority: 3 }) },
    ]);
    expect(result.map((item) => item.subjectArea)).toEqual(['LINGUAGENS', 'MATEMATICA']);
    expect(result.find((item) => item.subjectArea === 'MATEMATICA')?.institutionSkillId).toBe('math');
  });
});
