import { describe, expect, it } from 'vitest';

import {
  generateTimetable,
  timetableEntriesConflict,
  type TimetableGeneratorInput,
} from './index';

const baseInput: TimetableGeneratorInput = {
  institutionId: 'institution-a',
  academicYearId: 'year-2027',
  terms: [{ id: 'term-1', academicYearId: 'year-2027', startDate: '2027-02-01', endDate: '2027-04-30' }],
  classes: [{ id: 'class-a', institutionId: 'institution-a', academicYearId: 'year-2027', name: '7A', shift: 'MATUTINO' }],
  curriculumItems: [{ classId: 'class-a', subjectId: 'math', weeklyLessons: 2, lessonDurationMinutes: 50 }],
  subjectOfferings: [{ id: 'offering-math', institutionId: 'institution-a', classId: 'class-a', subjectId: 'math', teacherProfileId: 'teacher-a', termId: 'term-1' }],
  teacherSubjects: [{ institutionId: 'institution-a', teacherProfileId: 'teacher-a', subjectId: 'math', active: true }],
  teacherAvailability: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ institutionId: 'institution-a', teacherProfileId: 'teacher-a', dayOfWeek, startTime: '07:00', endTime: '12:00', active: true })),
  schoolTimeSlots: [1, 2, 3].map((slotNumber) => ({ id: `slot-${slotNumber}`, institutionId: 'institution-a', shift: 'MATUTINO', dayOfWeek: slotNumber, slotNumber, startTime: '07:00', endTime: '07:50', active: true })),
  rooms: [{ id: 'room-a', institutionId: 'institution-a', active: true }],
  seed: 'test-seed',
};

describe('timetable generator', () => {
  it('allocates the exact weekly workload deterministically', () => {
    const first = generateTimetable(baseInput);
    const second = generateTimetable(baseInput);

    expect(first.valid).toBe(true);
    expect(first.entries).toHaveLength(2);
    expect(first.entries).toEqual(second.entries);
  });

  it('covers Monday through Friday when weekday coverage is required', () => {
    const result = generateTimetable({
      ...baseInput,
      requireWeekdayCoverage: true,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      teacherAvailability: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.teacherAvailability[0],
        dayOfWeek,
      })),
      schoolTimeSlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.schoolTimeSlots[0],
        id: `weekday-slot-${dayOfWeek}`,
        dayOfWeek,
      })),
    });

    expect(result.valid).toBe(true);
    expect(result.entries.map((entry) => entry.dayOfWeek).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('identifies missing school slots when weekday coverage is incomplete', () => {
    const result = generateTimetable({
      ...baseInput,
      requireWeekdayCoverage: true,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      schoolTimeSlots: [1, 2, 3].map((dayOfWeek) => ({
        ...baseInput.schoolTimeSlots[0],
        id: `limited-slot-${dayOfWeek}`,
        dayOfWeek,
      })),
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'WEEKDAY_SCHOOL_SLOT_REQUIRED')).toBe(true);
  });

  it('identifies teacher availability when school slots exist but days are unavailable', () => {
    const result = generateTimetable({
      ...baseInput,
      requireWeekdayCoverage: true,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      teacherAvailability: [{ ...baseInput.teacherAvailability[0], dayOfWeek: 1 }],
      schoolTimeSlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.schoolTimeSlots[0],
        id: `available-slot-${dayOfWeek}`,
        dayOfWeek,
      })),
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'WEEKDAY_TEACHER_AVAILABILITY_REQUIRED')).toBe(true);
  });

  it('identifies insufficient weekly workload for five-day coverage', () => {
    const result = generateTimetable({
      ...baseInput,
      requireWeekdayCoverage: true,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 4 }],
      teacherAvailability: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.teacherAvailability[0],
        dayOfWeek,
      })),
      schoolTimeSlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.schoolTimeSlots[0],
        id: `capacity-slot-${dayOfWeek}`,
        dayOfWeek,
      })),
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'WEEKDAY_COVERAGE_CAPACITY_INSUFFICIENT')).toBe(true);
  });

  it('returns an explanation instead of a partial valid result when availability is insufficient', () => {
    const result = generateTimetable({
      ...baseInput,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      teacherAvailability: [{ ...baseInput.teacherAvailability[0], dayOfWeek: 1 }],
      schoolTimeSlots: [{ ...baseInput.schoolTimeSlots[0], dayOfWeek: 1 }],
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics[0]?.suggestions).toContain('Expand teacher availability.');
    expect(result.entries.length).toBeLessThan(5);
  });

  it('does not schedule more than two consecutive lessons of the same subject', () => {
    const result = generateTimetable({
      ...baseInput,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 3 }],
      schoolTimeSlots: [
        { dayOfWeek: 1, slotNumber: 1 },
        { dayOfWeek: 1, slotNumber: 2 },
        { dayOfWeek: 1, slotNumber: 3 },
        { dayOfWeek: 2, slotNumber: 1 },
      ].map(({ dayOfWeek, slotNumber }) => ({
        id: `slot-${dayOfWeek}-${slotNumber}`,
        institutionId: 'institution-a',
        shift: 'MATUTINO',
        dayOfWeek,
        slotNumber,
        startTime: `${String(6 + slotNumber).padStart(2, '0')}:00`,
        endTime: `${String(6 + slotNumber).padStart(2, '0')}:50`,
        active: true,
      })),
    });

    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(3);
    expect(result.entries.filter((entry) => entry.dayOfWeek === 1)).toHaveLength(2);
    expect(result.entries.some((entry) => entry.dayOfWeek !== 1)).toBe(true);
  });

  it('distributes a sufficient weekly workload across Monday to Friday', () => {
    const result = generateTimetable({
      ...baseInput,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      schoolTimeSlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        id: `slot-${dayOfWeek}`,
        institutionId: 'institution-a',
        shift: 'MATUTINO',
        dayOfWeek,
        slotNumber: 1,
        startTime: '07:00',
        endTime: '07:50',
        active: true,
      })),
    });

    expect(result.valid).toBe(true);
    expect(new Set(result.entries.map((entry) => entry.dayOfWeek))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('reports when the consecutive subject limit makes the workload impossible', () => {
    const result = generateTimetable({
      ...baseInput,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 3 }],
      schoolTimeSlots: [1, 2, 3].map((slotNumber) => ({
        id: `slot-${slotNumber}`,
        institutionId: 'institution-a',
        shift: 'MATUTINO',
        dayOfWeek: 1,
        slotNumber,
        startTime: `${String(6 + slotNumber).padStart(2, '0')}:00`,
        endTime: `${String(6 + slotNumber).padStart(2, '0')}:50`,
        active: true,
      })),
      teacherAvailability: [{ ...baseInput.teacherAvailability[0], dayOfWeek: 1 }],
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.entries).toHaveLength(2);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('two lessons consecutively'))).toBe(true);
  });

  it('preserves locked entries and prevents teacher/class/room collisions', () => {
    const locked = { ...baseInput, curriculumItems: [], subjectOfferings: [], lockedEntries: [{ institutionId: 'institution-a', academicYearId: 'year-2027', termId: 'term-1', classId: 'class-a', subjectOfferingId: 'offering-math', teacherProfileId: 'teacher-a', subjectId: 'math', roomId: 'room-a', dayOfWeek: 1, startTime: '07:00', endTime: '07:50', locked: true }] };
    const result = generateTimetable(locked);
    expect(result.entries[0]?.locked).toBe(true);
    expect(timetableEntriesConflict(result.entries[0]!, { ...result.entries[0]!, dayOfWeek: 2 }, new Map(baseInput.terms.map((term) => [term.id, term])))).toBe(false);
  });

  it('does not duplicate workload during regeneration', () => {
    const locked = {
      ...baseInput,
      lockedEntries: [{
        institutionId: 'institution-a',
        academicYearId: 'year-2027',
        termId: 'term-1',
        classId: 'class-a',
        subjectOfferingId: 'offering-math',
        teacherProfileId: 'teacher-a',
        subjectId: 'math',
        roomId: 'room-a',
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '07:50',
        locked: true,
      }],
    };

    const result = generateTimetable(locked);

    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(new Set(result.entries.map((entry) => `${entry.subjectOfferingId}:${entry.dayOfWeek}:${entry.startTime}`)).size).toBe(2);
    expect(result.entries.some((entry) => entry.locked && entry.dayOfWeek === 1)).toBe(true);
  });

  it('does not treat equal weekly times in non-overlapping terms as a conflict', () => {
    const terms = new Map([
      ['term-1', { id: 'term-1', academicYearId: 'year-2027', startDate: '2027-02-01', endDate: '2027-04-30' }],
      ['term-2', { id: 'term-2', academicYearId: 'year-2027', startDate: '2027-05-01', endDate: '2027-07-31' }],
    ]);
    const left = { institutionId: 'institution-a', academicYearId: 'year-2027', termId: 'term-1', classId: 'class-a', subjectOfferingId: 'offering-math', teacherProfileId: 'teacher-a', subjectId: 'math', roomId: 'room-a', dayOfWeek: 1, startTime: '07:00', endTime: '07:50', locked: true };
    const right = { ...left, termId: 'term-2', subjectOfferingId: 'offering-math-2' };
    expect(timetableEntriesConflict(left, right, terms)).toBe(false);
  });

  it('reports an overlapping teacher conflict for fixed entries', () => {
    const terms = new Map(baseInput.terms.map((term) => [term.id, term]));
    const left = { institutionId: 'institution-a', academicYearId: 'year-2027', termId: 'term-1', classId: 'class-a', subjectOfferingId: 'offering-math', teacherProfileId: 'teacher-a', subjectId: 'math', roomId: 'room-a', dayOfWeek: 1, startTime: '07:00', endTime: '07:50', locked: true };
    const right = { ...left, subjectOfferingId: 'offering-other' };
    expect(timetableEntriesConflict(left, right, terms)).toBe(true);
  });

  it('marks an internal conflict between fixed entries as INVALID', () => {
    const result = generateTimetable({
      ...baseInput,
      curriculumItems: [],
      subjectOfferings: [],
      lockedEntries: [
        {
          institutionId: 'institution-a',
          academicYearId: 'year-2027',
          termId: 'term-1',
          classId: 'class-a',
          subjectOfferingId: 'offering-math',
          teacherProfileId: 'teacher-a',
          subjectId: 'math',
          roomId: 'room-a',
          dayOfWeek: 1,
          startTime: '07:00',
          endTime: '07:50',
          locked: true,
        },
        {
          institutionId: 'institution-a',
          academicYearId: 'year-2027',
          termId: 'term-1',
          classId: 'class-a',
          subjectOfferingId: 'offering-other',
          teacherProfileId: 'teacher-b',
          subjectId: 'portuguese',
          roomId: 'room-a',
          dayOfWeek: 1,
          startTime: '07:00',
          endTime: '07:50',
          locked: true,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'LOCKED_ENTRY_CONFLICT')).toBe(true);
  });

  it('does not block the structural draft before teacher skills are configured', () => {
    const result = generateTimetable({ ...baseInput, teacherSubjects: [] });
    expect(result.status).toBe('VALID');
    expect(result.entries).toHaveLength(2);
  });

  it('blocks an explicitly configured teacher without the requested subject skill', () => {
    const result = generateTimetable({
      ...baseInput,
      teacherSubjects: [{
        institutionId: 'institution-a',
        teacherProfileId: 'teacher-a',
        subjectId: 'portuguese',
        active: true,
      }],
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics[0]?.code).toBe('TEACHER_SUBJECT_NOT_AUTHORIZED');
  });

  it('prioritizes the room explicitly assigned to the class', () => {
    const result = generateTimetable({
      ...baseInput,
      rooms: [
        { id: 'shared-room', institutionId: 'institution-a', active: true },
        { id: 'class-room', institutionId: 'institution-a', classId: 'class-a', active: true },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.entries.every((entry) => entry.roomId === 'class-room')).toBe(true);
  });

  it('matches equivalent shift labels such as Manhã and MATUTINO', () => {
    const result = generateTimetable({
      ...baseInput,
      classes: [{ ...baseInput.classes[0], shift: 'Manhã' }],
    });

    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(2);
  });

  it('prioritizes slots that use the exact shift label of the class', () => {
    const result = generateTimetable({
      ...baseInput,
      classes: [{ ...baseInput.classes[0], shift: 'Manhã' }],
      schoolTimeSlots: [
        { ...baseInput.schoolTimeSlots[0], dayOfWeek: 1, shift: 'MATUTINO' },
        { ...baseInput.schoolTimeSlots[1], dayOfWeek: 2, shift: 'MATUTINO' },
        { ...baseInput.schoolTimeSlots[0], id: 'raw-slot-1', dayOfWeek: 1, shift: 'Manhã' },
        { ...baseInput.schoolTimeSlots[1], id: 'raw-slot-2', dayOfWeek: 2, shift: 'Manhã' },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.entries.map((entry) => entry.dayOfWeek)).toEqual([1, 2]);
  });

  it('does not allocate lessons inside a configured recess', () => {
    const result = generateTimetable({
      ...baseInput,
      schoolScheduleBreaks: [{
        institutionId: 'institution-a',
        shift: 'MATUTINO',
        dayOfWeek: 1,
        name: 'Intervalo',
        startTime: '07:00',
        endTime: '07:50',
        active: true,
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((entry) => entry.dayOfWeek !== 1)).toBe(true);
  });

  it('explains when weekday coverage is blocked by configured breaks', () => {
    const result = generateTimetable({
      ...baseInput,
      requireWeekdayCoverage: true,
      curriculumItems: [{ ...baseInput.curriculumItems[0], weeklyLessons: 5 }],
      schoolTimeSlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        ...baseInput.schoolTimeSlots[0],
        id: `blocked-slot-${dayOfWeek}`,
        dayOfWeek,
      })),
      schoolScheduleBreaks: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        institutionId: 'institution-a',
        shift: 'MATUTINO',
        dayOfWeek,
        name: 'Intervalo',
        startTime: '07:00',
        endTime: '07:50',
        active: true,
      })),
    });

    expect(result.status).toBe('UNSATISFIED');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'WEEKDAY_SCHEDULE_BREAK_REQUIRED')).toBe(true);
  });
});
