import { describe, expect, it } from 'vitest';

import {
  buildDefaultTimeSlots,
  planAutomaticAssignments,
} from './automaticPreparation';

describe('automatic timetable preparation', () => {
  it('selects a qualified teacher and leaves existing offerings intact', () => {
    const result = planAutomaticAssignments({
      classes: [{ id: 'class-1', institutionId: 'institution-1', academicYearId: 'year-1', name: '1A', shift: 'MATUTINO' }],
      curriculumItems: [{ classId: 'class-1', subjectId: 'math', weeklyLessons: 2, lessonDurationMinutes: 50 }],
      subjectOfferings: [{ id: 'offering-1', institutionId: 'institution-1', classId: 'class-1', subjectId: 'math', teacherProfileId: 'teacher-1', termId: 'term-1' }],
      teacherSubjects: [
        { institutionId: 'institution-1', teacherProfileId: 'teacher-1', subjectId: 'math', active: true },
        { institutionId: 'institution-1', teacherProfileId: 'teacher-2', subjectId: 'math', active: true },
      ],
      termIds: ['term-1', 'term-2'],
    });

    expect(result.assignments).toEqual([{ classId: 'class-1', subjectId: 'math', teacherProfileId: 'teacher-1' }]);
    expect(result.unassigned).toHaveLength(0);
  });

  it('reports curriculum items without any qualified teacher', () => {
    const result = planAutomaticAssignments({
      classes: [{ id: 'class-1', institutionId: 'institution-1', academicYearId: 'year-1', name: '1A', shift: 'MATUTINO' }],
      curriculumItems: [{ classId: 'class-1', subjectId: 'science', weeklyLessons: 2, lessonDurationMinutes: 50 }],
      subjectOfferings: [],
      teacherSubjects: [],
      termIds: ['term-1'],
    });

    expect(result.assignments).toHaveLength(0);
    expect(result.unassigned).toEqual([{ classId: 'class-1', subjectId: 'science' }]);
  });

  it('creates standard slots for custom and integral shifts', () => {
    const slots = buildDefaultTimeSlots(['Integral', 'Noturno']);
    const expandedMorning = buildDefaultTimeSlots(['MATUTINO'], { MATUTINO: 8 });

    expect(slots.filter((slot) => slot.shift === 'Integral')).toHaveLength(40);
    expect(slots.filter((slot) => slot.shift === 'Noturno')).toHaveLength(25);
    expect(slots[0]).toMatchObject({ shift: 'Integral', day_of_week: 1, start_time: '07:00' });
    expect(expandedMorning).toHaveLength(40);
    expect(expandedMorning.at(-1)).toMatchObject({ day_of_week: 5, slot_number: 8, end_time: '14:40' });
  });
});
