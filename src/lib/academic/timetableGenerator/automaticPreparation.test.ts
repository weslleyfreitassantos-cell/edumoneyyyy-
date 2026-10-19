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

  it('assigns a scoped F1 regent for core subjects but not as a general specialist', () => {
    const profile = {
      institutionId: 'institution-1',
      teacherProfileId: 'teacher-regent',
      academicYearId: 'year-1',
      actuationType: 'REGENTE' as const,
      authorizedShifts: ['MATUTINO'],
      authorizedStages: ['FUNDAMENTAL_I' as const],
      authorizedGradeLevels: ['1'],
      authorizedClassIds: ['class-1'],
      maxWeeklyLessons: null,
      maxDailyLessons: null,
      contractualWeeklyMinutes: null,
      configurationStatus: 'READY' as const,
    };
    const shared = {
      classes: [{ id: 'class-1', institutionId: 'institution-1', academicYearId: 'year-1', name: '1A', shift: 'MATUTINO', gradeLevel: '1º ano' }],
      curriculumItems: [{ classId: 'class-1', subjectId: 'portuguese', weeklyLessons: 3, lessonDurationMinutes: 50 }],
      subjectOfferings: [],
      teacherSubjects: [],
      teacherSchedulingProfiles: [profile],
      requireTeacherSchedulingProfiles: true,
      subjectLabels: { portuguese: 'Língua Portuguesa', english: 'Inglês' },
      termIds: ['term-1'],
    };

    expect(planAutomaticAssignments(shared).assignments).toEqual([
      { classId: 'class-1', subjectId: 'portuguese', teacherProfileId: 'teacher-regent' },
    ]);
    expect(planAutomaticAssignments({
      ...shared,
      curriculumItems: [{ classId: 'class-1', subjectId: 'english', weeklyLessons: 2, lessonDurationMinutes: 50 }],
    }).unassigned).toEqual([{ classId: 'class-1', subjectId: 'english' }]);
  });

  it('distributes new assignments by weekly workload instead of link count', () => {
    const result = planAutomaticAssignments({
      classes: [
        { id: 'class-heavy', institutionId: 'institution-1', academicYearId: 'year-1', name: '1A', shift: 'INTEGRAL' },
        { id: 'class-light', institutionId: 'institution-1', academicYearId: 'year-1', name: '2A', shift: 'INTEGRAL' },
      ],
      curriculumItems: [
        { classId: 'class-heavy', subjectId: 'math', weeklyLessons: 5, lessonDurationMinutes: 50 },
        { classId: 'class-light', subjectId: 'math', weeklyLessons: 2, lessonDurationMinutes: 50 },
      ],
      subjectOfferings: [{
        id: 'offering-light',
        institutionId: 'institution-1',
        classId: 'class-light',
        subjectId: 'math',
        teacherProfileId: 'teacher-1',
        termId: 'term-1',
      }],
      teacherSubjects: [
        { institutionId: 'institution-1', teacherProfileId: 'teacher-1', subjectId: 'math', active: true },
        { institutionId: 'institution-1', teacherProfileId: 'teacher-2', subjectId: 'math', active: true },
      ],
      termIds: ['term-1'],
    });

    expect(result.assignments).toEqual([{ classId: 'class-heavy', subjectId: 'math', teacherProfileId: 'teacher-2' }]);
  });

  it('keeps the morning shift inside its boundary and builds separate evening periods', () => {
    const slots = buildDefaultTimeSlots(['Integral', 'Noturno']);
    const expandedMorning = buildDefaultTimeSlots(['MATUTINO'], { MATUTINO: 8 });
    const afternoon = buildDefaultTimeSlots(['VESPERTINO']);

    expect(slots.filter((slot) => slot.shift === 'Integral')).toHaveLength(40);
    expect(slots.filter((slot) => slot.shift === 'Noturno')).toHaveLength(25);
    expect(slots[0]).toMatchObject({ shift: 'Integral', day_of_week: 1, start_time: '07:00' });
    expect(expandedMorning).toHaveLength(30);
    expect(expandedMorning.at(-1)).toMatchObject({ day_of_week: 5, slot_number: 6, end_time: '12:30' });
    expect(afternoon.every((slot) => slot.start_time >= '13:00')).toBe(true);
    expect(slots.filter((slot) => slot.shift === 'Noturno').every((slot) => slot.start_time >= '18:50')).toBe(true);
  });
});
