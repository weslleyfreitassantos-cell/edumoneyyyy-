import { describe, expect, it } from 'vitest';

import { buildTimetableVersionDiff, type TimetableVersionEntryRow } from './timetableAutomationService';

function entry(overrides: Partial<TimetableVersionEntryRow> = {}): TimetableVersionEntryRow {
  return {
    id: 'entry', version_id: 'version', institution_id: 'institution', academic_year_id: 'year', term_id: 'term', term_name: 'Term',
    class_id: 'class', class_name: '1º A', class_shift: 'MATUTINO', subject_offering_id: 'offering', subject_name: 'Matemática',
    teacher_profile_id: 'teacher', teacher_name: 'Professor', room_id: 'room-1', day_of_week: 1, start_time: '07:00:00', end_time: '07:50:00', locked: false, active: true,
    ...overrides,
  };
}

describe('buildTimetableVersionDiff', () => {
  it('classifies additions, removals, moves and room changes against the source', () => {
    const source = [
      entry(),
      entry({ id: 'removed', subject_offering_id: 'removed-offering', subject_name: 'História' }),
      entry({ id: 'room', subject_offering_id: 'room-offering', room_id: 'room-1' }),
    ];
    const current = [
      entry({ day_of_week: 2 }),
      entry({ id: 'added', subject_offering_id: 'added-offering', subject_name: 'Arte' }),
      entry({ id: 'room', subject_offering_id: 'room-offering', room_id: 'room-2' }),
    ];
    expect(buildTimetableVersionDiff(current, source)).toMatchObject({
      added: 1,
      removed: 1,
      moved: 1,
      roomChanged: 1,
      unchanged: 0,
      affectedClassNames: ['1º A'],
    });
  });

  it('treats a source-less draft as entirely new', () => {
    const result = buildTimetableVersionDiff([entry(), entry({ id: 'two', day_of_week: 2 })], []);
    expect(result).toMatchObject({ added: 2, removed: 0, moved: 0, roomChanged: 0, unchanged: 0 });
  });
});
