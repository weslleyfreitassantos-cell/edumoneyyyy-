import { describe, expect, it } from 'vitest';

import {
  getTeacherStage,
  isTeacherAuthorizedForClass,
  isTeacherAuthorizedForOffering,
  type TeacherSchedulingProfile,
} from './teacherScheduling';

const profile: TeacherSchedulingProfile = {
  institutionId: 'school-1',
  teacherProfileId: 'teacher-1',
  academicYearId: 'year-2027',
  actuationType: 'REGENTE',
  authorizedShifts: ['MATUTINO'],
  authorizedStages: ['FUNDAMENTAL_I'],
  authorizedGradeLevels: ['1'],
  authorizedClassIds: ['class-1'],
  maxWeeklyLessons: 20,
  maxDailyLessons: 6,
  contractualWeeklyMinutes: null,
  configurationStatus: 'READY',
};

const firstGradeClass = {
  id: 'class-1',
  institutionId: 'school-1',
  academicYearId: 'year-2027',
  gradeLevel: '1º ano',
  shift: 'Manhã',
};

describe('teacher scheduling scope', () => {
  it('classifies grade bands and keeps academic year, class, stage, grade and shift explicit', () => {
    expect(getTeacherStage('5º ano')).toBe('FUNDAMENTAL_I');
    expect(getTeacherStage('6º ano')).toBe('FUNDAMENTAL_II');
    expect(getTeacherStage('1ª série do Ensino Médio')).toBe('ENSINO_MEDIO');
    expect(isTeacherAuthorizedForClass(profile, firstGradeClass)).toBe(true);
    expect(isTeacherAuthorizedForClass(profile, { ...firstGradeClass, academicYearId: 'year-2028' })).toBe(false);
    expect(isTeacherAuthorizedForClass(profile, { ...firstGradeClass, shift: 'VESPERTINO' })).toBe(false);
    expect(isTeacherAuthorizedForClass(profile, { ...firstGradeClass, id: 'another-class' })).toBe(false);
  });

  it('permits only core F1 subjects for regents, not an institution-wide specialist credential', () => {
    const base = {
      profile,
      classRecord: firstGradeClass,
      authorizedSubjectIds: new Set<string>(),
    };
    expect(isTeacherAuthorizedForOffering({ ...base, subjectId: 'portuguese', subjectName: 'Língua Portuguesa' })).toBe(true);
    expect(isTeacherAuthorizedForOffering({ ...base, subjectId: 'science', subjectName: 'Ciências' })).toBe(true);
    expect(isTeacherAuthorizedForOffering({ ...base, subjectId: 'english', subjectName: 'Inglês' })).toBe(false);
  });

  it('requires an active specialist qualification in addition to the class scope', () => {
    const specialist = { ...profile, actuationType: 'ESPECIALISTA' as const };
    expect(isTeacherAuthorizedForOffering({
      profile: specialist,
      classRecord: firstGradeClass,
      subjectId: 'math',
      subjectName: 'Matemática',
      authorizedSubjectIds: new Set(),
    })).toBe(false);
    expect(isTeacherAuthorizedForOffering({
      profile: specialist,
      classRecord: firstGradeClass,
      subjectId: 'math',
      subjectName: 'Matemática',
      authorizedSubjectIds: new Set(['math']),
    })).toBe(true);
  });
});
