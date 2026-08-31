import { describe, expect, it } from 'vitest';

import { generateTimetable } from './index';

const subjectPools: Record<string, number> = {
  LP: 5, MAT: 5, CIE: 3, HIS: 3, GEO: 3, ART: 2, EDF: 3, ING: 3,
  BIO: 2, QUI: 2, FIS: 2, FIL: 2, SOC: 2, LEI: 3, REF: 3, PROJ: 3,
  TEC: 3, EDC: 3, OFI: 3, EST: 3,
};

const fundamentalOne = {
  LP: 5, MAT: 5, CIE: 2, HIS: 2, GEO: 2, ART: 2, EDF: 2, ING: 2,
  LEI: 3, REF: 3, PROJ: 3, TEC: 2, EDC: 2, OFI: 3, EST: 2,
};

const fundamentalTwo = {
  LP: 4, MAT: 4, CIE: 3, HIS: 2, GEO: 2, ART: 1, EDF: 2, ING: 2,
  LEI: 3, REF: 3, PROJ: 3, TEC: 3, EDC: 2, OFI: 3, EST: 3,
};

const highSchool = {
  LP: 3, MAT: 4, BIO: 2, QUI: 2, FIS: 2, HIS: 2, GEO: 2, ING: 2,
  FIL: 1, SOC: 1, LEI: 3, REF: 3, PROJ: 3, TEC: 3, EDC: 2, OFI: 3, EST: 2,
};

describe('Escola TV generator reproduction', () => {
  it('schedules the official 24-class synthetic fixture', () => {
    const institutionId = 'institution-tv';
    const academicYearId = 'year-tv';
    const terms = [1, 2, 3, 4].map((term) => ({
      id: `term-${term}`,
      academicYearId,
      startDate: `2026-${String((term - 1) * 3 + 1).padStart(2, '0')}-01`,
      endDate: `2026-${String(term * 3).padStart(2, '0')}-28`,
    }));
    const classes = Array.from({ length: 24 }, (_, index) => {
      const grade = index < 18 ? Math.floor(index / 2) + 1 : Math.floor((index - 18) / 2) + 1;
      const name = index < 18
        ? `${grade}º ano ${index % 2 === 0 ? 'A' : 'B'}`
        : `${grade}ª série EM ${index % 2 === 0 ? 'A' : 'B'}`;
      return { id: `class-${index}`, institutionId, academicYearId, name, shift: 'Integral' };
    });
    const curriculum = classes.flatMap((classRecord, index) => {
      const plan = index < 10 ? fundamentalOne : index < 18 ? fundamentalTwo : highSchool;
      return Object.entries(plan).map(([subjectId, weeklyLessons]) => ({
        classId: classRecord.id,
        subjectId,
        weeklyLessons,
        lessonDurationMinutes: 50,
      }));
    });
    const teacherSubjects = Object.entries(subjectPools).flatMap(([subjectId, count]) =>
      Array.from({ length: count }, (_, index) => ({
        institutionId,
        teacherProfileId: `teacher-${subjectId}-${index}`,
        subjectId,
        active: true,
      })),
    );
    const teacherAvailability = teacherSubjects.flatMap((teacher) =>
      [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        institutionId,
        teacherProfileId: teacher.teacherProfileId,
        dayOfWeek,
        startTime: '07:00',
        endTime: '15:40',
        active: true,
      })),
    );
    const subjectOfferings = classes.flatMap((classRecord, classIndex) => {
      const plan = curriculum.filter((item) => item.classId === classRecord.id);
      return plan.flatMap((item) => Array.from({ length: 4 }, (_, termIndex) => ({
        id: `offering-${classRecord.id}-${item.subjectId}-${termIndex}`,
        institutionId,
        classId: classRecord.id,
        subjectId: item.subjectId,
        teacherProfileId: `teacher-${item.subjectId}-${classIndex % subjectPools[item.subjectId]}`,
        termId: `term-${termIndex + 1}`,
      })));
    });
    const slotTimes = [
      ['07:00', '07:50'], ['07:50', '08:40'], ['08:50', '09:40'], ['09:40', '10:30'],
      ['10:50', '11:40'], ['13:00', '13:50'], ['13:50', '14:40'], ['14:50', '15:40'],
    ];
    const schoolTimeSlots = [1, 2, 3, 4, 5].flatMap((dayOfWeek) =>
      slotTimes.map(([startTime, endTime], index) => ({
        id: `slot-${dayOfWeek}-${index + 1}`,
        institutionId,
        shift: 'Integral',
        dayOfWeek,
        slotNumber: index + 1,
        startTime,
        endTime,
        active: true,
      })),
    );
    const rooms = classes.map((classRecord) => ({
      id: `room-${classRecord.id}`,
      institutionId,
      classId: classRecord.id,
      active: true,
    }));

    const baseInput = {
      institutionId,
      academicYearId,
      terms: terms.slice(0, 2),
      classes,
      curriculumItems: curriculum,
      subjectOfferings,
      teacherSubjects,
      teacherAvailability,
      schoolTimeSlots,
      rooms,
      requireWeekdayCoverage: true,
      schoolDays: [1, 2, 3, 4, 5],
      maxLessonsPerDay: 8,
      maxTeacherLessonsPerDay: 8,
      maxTeacherLessonsPerWeek: 40,
      maxConsecutiveSubjectLessons: 2,
      maxSubjectLessonsPerDay: 5,
      requireTeacherAvailability: true,
      requireRoomForGeneration: true,
      allowSharedRooms: true,
      seed: 'school-tv-repro',
    };

    const result = generateTimetable(baseInput);

    expect(result.valid).toBe(true);
    expect(result.entries).toHaveLength(24 * 40 * 2);
  }, 60_000);
});
