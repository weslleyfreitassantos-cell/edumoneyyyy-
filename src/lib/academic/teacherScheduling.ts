import { normalizeAcademicLevel } from './academicLevels';
import { normalizeAcademicShift } from './academicShifts';

export const TEACHER_ACTUATION_TYPES = ['REGENTE', 'ESPECIALISTA', 'AMBOS'] as const;
export type TeacherActuationType = (typeof TEACHER_ACTUATION_TYPES)[number];

export const TEACHER_STAGE_VALUES = ['FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'ENSINO_MEDIO'] as const;
export type TeacherStage = (typeof TEACHER_STAGE_VALUES)[number];

export interface TeacherSchedulingProfile {
  institutionId: string;
  teacherProfileId: string;
  academicYearId: string;
  actuationType: TeacherActuationType;
  authorizedShifts: string[];
  authorizedStages: TeacherStage[];
  authorizedGradeLevels: string[];
  authorizedClassIds: string[];
  maxWeeklyLessons: number | null;
  maxDailyLessons: number | null;
  contractualWeeklyMinutes: number | null;
  configurationStatus: 'READY' | 'REVIEW_REQUIRED';
}

export interface TeacherSchedulingClass {
  id: string;
  institutionId: string;
  academicYearId?: string;
  gradeLevel: string | null;
  shift: string | null;
}

function isRegentCoreSubject(subjectName: string | null | undefined): boolean {
  if (!subjectName) return false;
  const normalized = subjectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR');
  return /(PORTUGU|MATEMAT|CIENCI|HIST|GEOGRAF)/.test(normalized);
}

export function getTeacherStage(gradeLevel: string | null | undefined): TeacherStage | null {
  const level = normalizeAcademicLevel(gradeLevel);
  if (!level) return null;
  if (level.endsWith(' EM')) return 'ENSINO_MEDIO';
  const year = Number(level);
  if (year >= 1 && year <= 5) return 'FUNDAMENTAL_I';
  if (year >= 6 && year <= 9) return 'FUNDAMENTAL_II';
  return null;
}

export function isTeacherAuthorizedForClass(
  profile: TeacherSchedulingProfile,
  classRecord: TeacherSchedulingClass,
): boolean {
  const stage = getTeacherStage(classRecord.gradeLevel);
  const level = normalizeAcademicLevel(classRecord.gradeLevel);
  const shift = classRecord.shift ? normalizeAcademicShift(classRecord.shift) : null;
  return profile.configurationStatus === 'READY' &&
    profile.institutionId === classRecord.institutionId &&
    (!classRecord.academicYearId || profile.academicYearId === classRecord.academicYearId) &&
    Boolean(stage && profile.authorizedStages.includes(stage)) &&
    Boolean(level && profile.authorizedGradeLevels.includes(level)) &&
    profile.authorizedClassIds.includes(classRecord.id) &&
    Boolean(shift && profile.authorizedShifts.some((value) => normalizeAcademicShift(value) === shift));
}

export function isTeacherAuthorizedForOffering(input: {
  profile: TeacherSchedulingProfile;
  classRecord: TeacherSchedulingClass;
  subjectId: string;
  subjectName?: string | null;
  authorizedSubjectIds: ReadonlySet<string>;
}): boolean {
  const { profile, classRecord, subjectId, authorizedSubjectIds } = input;
  if (!isTeacherAuthorizedForClass(profile, classRecord)) return false;

  const isRegent =
    (profile.actuationType === 'REGENTE' || profile.actuationType === 'AMBOS') &&
    getTeacherStage(classRecord.gradeLevel) === 'FUNDAMENTAL_I' &&
    isRegentCoreSubject(input.subjectName);
  const isSpecialist =
    (profile.actuationType === 'ESPECIALISTA' || profile.actuationType === 'AMBOS') &&
    authorizedSubjectIds.has(subjectId);

  return isRegent || isSpecialist;
}
