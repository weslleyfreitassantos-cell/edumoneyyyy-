import { describe, expect, it } from 'vitest';

import { buildClassDeletionBlockedMessage } from './classService';

describe('buildClassDeletionBlockedMessage', () => {
  it('não bloqueia uma turma sem vínculos', () => {
    expect(buildClassDeletionBlockedMessage({
      enrollmentCount: 0,
      offeringCount: 0,
      curriculumItemCount: 0,
      timetableVersionEntryCount: 0,
      totalLinkedRecords: 0,
    })).toBeNull();
  });

  it('informa os vínculos que impedem a exclusão física', () => {
    const message = buildClassDeletionBlockedMessage({
      enrollmentCount: 3,
      offeringCount: 8,
      curriculumItemCount: 8,
      timetableVersionEntryCount: 2,
      totalLinkedRecords: 21,
    });

    expect(message).toContain('3 matrícula(s) de aluno');
    expect(message).toContain('preservar o histórico');
  });
});
