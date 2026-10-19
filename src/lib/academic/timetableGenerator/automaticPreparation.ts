import type {
  GeneratorClass,
  GeneratorCurriculumItem,
  GeneratorOffering,
  GeneratorTeacherSubject,
  GeneratorTeacherSchedulingProfile,
} from './index';
import { normalizeAcademicShift } from '../academicShifts';
import { isTeacherAuthorizedForOffering } from '../teacherScheduling';

export { normalizeAcademicShift } from '../academicShifts';

export interface AutomaticAssignmentPlan {
  classId: string;
  subjectId: string;
  teacherProfileId: string;
}

export interface AutomaticAssignmentPlanResult {
  assignments: AutomaticAssignmentPlan[];
  unassigned: Array<{ classId: string; subjectId: string }>;
}

interface AutomaticAssignmentInput {
  classes: GeneratorClass[];
  curriculumItems: GeneratorCurriculumItem[];
  subjectOfferings: GeneratorOffering[];
  teacherSubjects: GeneratorTeacherSubject[];
  teacherSchedulingProfiles?: GeneratorTeacherSchedulingProfile[];
  subjectLabels?: Record<string, string>;
  requireTeacherSchedulingProfiles?: boolean;
  maxTeacherLessonsPerWeek?: number;
  termIds: string[];
}

export interface AutomaticTimeSlot {
  shift: string;
  day_of_week: number;
  slot_number: number;
  start_time: string;
  end_time: string;
}

const STANDARD_SLOT_TIMES: Record<string, Array<[string, string]>> = {
  MATUTINO: [
    ['07:00', '07:50'],
    ['07:50', '08:40'],
    ['08:50', '09:40'],
    ['09:40', '10:30'],
    ['10:50', '11:40'],
    ['11:40', '12:30'],
  ],
  VESPERTINO: [
    ['13:00', '13:50'],
    ['13:50', '14:40'],
    ['14:50', '15:40'],
    ['15:40', '16:30'],
    ['16:50', '17:40'],
    ['17:40', '18:30'],
    ['18:50', '19:40'],
    ['19:40', '20:30'],
  ],
  NOTURNO: [
    ['18:50', '19:40'],
    ['19:40', '20:30'],
    ['20:40', '21:30'],
    ['21:30', '22:20'],
    ['22:30', '23:20'],
  ],
  INTEGRAL: [
    ['07:00', '07:50'],
    ['07:50', '08:40'],
    ['08:50', '09:40'],
    ['09:40', '10:30'],
    ['10:50', '11:40'],
    ['13:00', '13:50'],
    ['13:50', '14:40'],
    ['14:50', '15:40'],
  ],
};

function countTeacherWeeklyLoad(
  teacherProfileId: string,
  input: AutomaticAssignmentInput,
  planned: AutomaticAssignmentPlan[],
): number {
  const assignedKeys = new Set<string>();
  for (const offering of input.subjectOfferings) {
    if (offering.teacherProfileId === teacherProfileId) {
      assignedKeys.add(`${offering.classId}:${offering.subjectId}`);
    }
  }
  for (const assignment of planned) {
    if (assignment.teacherProfileId === teacherProfileId) {
      assignedKeys.add(`${assignment.classId}:${assignment.subjectId}`);
    }
  }

  return [...assignedKeys].reduce((total, key) => {
    const [classId, subjectId] = key.split(':');
    const curriculum = input.curriculumItems.find(
      (item) => item.classId === classId && item.subjectId === subjectId,
    );
    return total + (curriculum?.weeklyLessons ?? 0);
  }, 0);
}

export function planAutomaticAssignments(input: AutomaticAssignmentInput): AutomaticAssignmentPlanResult {
  const activeTerms = new Set(input.termIds);
  const activeClasses = new Map(input.classes.map((classRecord) => [classRecord.id, classRecord]));
  const activeSkills = input.teacherSubjects.filter((skill) => skill.active);
  const assignments: AutomaticAssignmentPlan[] = [];
  const unassigned: Array<{ classId: string; subjectId: string }> = [];

  for (const curriculum of input.curriculumItems.filter((item) => item.weeklyLessons > 0)) {
    if (!activeClasses.has(curriculum.classId)) continue;

    const offerings = input.subjectOfferings.filter(
      (offering) =>
        offering.classId === curriculum.classId &&
        offering.subjectId === curriculum.subjectId &&
        activeTerms.has(offering.termId) &&
        offering.teacherProfileId,
    );
    const coveredTerms = new Set(offerings.map((offering) => offering.termId));
    if (input.termIds.every((termId) => coveredTerms.has(termId))) continue;

    const qualifiedTeacherIds = [...new Set(
      activeSkills
        .filter((skill) => skill.subjectId === curriculum.subjectId)
        .map((skill) => skill.teacherProfileId),
    )];
    const schedulingProfiles = input.teacherSchedulingProfiles ?? [];
    const skillIdsByTeacher = new Map<string, Set<string>>();
    for (const skill of activeSkills) {
      const ids = skillIdsByTeacher.get(skill.teacherProfileId) ?? new Set<string>();
      ids.add(skill.subjectId);
      skillIdsByTeacher.set(skill.teacherProfileId, ids);
    }
    const classRecord = activeClasses.get(curriculum.classId);
    const candidateIds = input.requireTeacherSchedulingProfiles
      ? schedulingProfiles.map((profile) => profile.teacherProfileId)
      : qualifiedTeacherIds;
    const eligibleTeacherIds = candidateIds.filter((teacherProfileId) => {
      const profile = schedulingProfiles.find((item) => item.teacherProfileId === teacherProfileId);
      if (input.requireTeacherSchedulingProfiles && !profile) return false;
      if (profile) {
        const allowed = isTeacherAuthorizedForOffering({
          profile,
          classRecord: {
            id: classRecord?.id ?? '',
            institutionId: classRecord?.institutionId ?? '',
            academicYearId: classRecord?.academicYearId,
            gradeLevel: classRecord?.gradeLevel,
            shift: classRecord?.shift,
          },
          subjectId: curriculum.subjectId,
          subjectName: input.subjectLabels?.[curriculum.subjectId],
          authorizedSubjectIds: skillIdsByTeacher.get(teacherProfileId) ?? new Set<string>(),
        });
        if (!allowed) return false;
        const weeklyLimit = Math.min(
          input.maxTeacherLessonsPerWeek ?? Number.MAX_SAFE_INTEGER,
          profile.maxWeeklyLessons ?? input.maxTeacherLessonsPerWeek ?? Number.MAX_SAFE_INTEGER,
        );
        if (countTeacherWeeklyLoad(teacherProfileId, input, assignments) + curriculum.weeklyLessons > weeklyLimit) return false;
        return true;
      }
      return !input.requireTeacherSchedulingProfiles &&
        (qualifiedTeacherIds.length === 0 || qualifiedTeacherIds.includes(teacherProfileId));
    });
    const existingTeacherId = offerings.find((offering) =>
      eligibleTeacherIds.includes(offering.teacherProfileId),
    )?.teacherProfileId;
    const teacherProfileId = existingTeacherId ?? eligibleTeacherIds.sort((left, right) =>
      countTeacherWeeklyLoad(left, input, assignments) -
      countTeacherWeeklyLoad(right, input, assignments) ||
      left.localeCompare(right),
    )[0];

    if (!teacherProfileId) {
      unassigned.push({ classId: curriculum.classId, subjectId: curriculum.subjectId });
      continue;
    }

    assignments.push({
      classId: curriculum.classId,
      subjectId: curriculum.subjectId,
      teacherProfileId,
    });
  }

  return { assignments, unassigned };
}

export function buildDefaultTimeSlots(
  shifts: string[],
  slotsPerDayByShift: Record<string, number> = {},
  schoolDays: number[] = [1, 2, 3, 4, 5],
): AutomaticTimeSlot[] {
  const uniqueShifts = [...new Set(shifts.map((shift) => shift.trim()).filter(Boolean))];
  const effectiveShifts = uniqueShifts.length > 0 ? uniqueShifts : ['MATUTINO'];
  const slots: AutomaticTimeSlot[] = [];

  for (const shift of effectiveShifts) {
    const normalizedShift = normalizeAcademicShift(shift);
    const times = STANDARD_SLOT_TIMES[normalizedShift] ?? STANDARD_SLOT_TIMES.MATUTINO;
    const requestedSlots = slotsPerDayByShift[normalizedShift] ??
      slotsPerDayByShift[shift] ??
      times.length;
    for (const day of schoolDays) {
      times.slice(0, requestedSlots).forEach(([start_time, end_time], index) => {
        slots.push({
          shift,
          day_of_week: day,
          slot_number: index + 1,
          start_time,
          end_time,
        });
      });
    }
  }

  return slots;
}
