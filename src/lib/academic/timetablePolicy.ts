export interface TimetablePolicySettings {
  schoolDays: number[];
  defaultLessonDurationMinutes: number;
  maxLessonsPerDay: number;
  maxTeacherLessonsPerDay: number;
  maxTeacherLessonsPerWeek: number;
  maxConsecutiveSubjectLessons: number;
  maxSubjectLessonsPerDay: number;
  requireTeacherAvailability: boolean;
  requireRoomForGeneration: boolean;
  allowSharedRooms: boolean;
}

export const DEFAULT_TIMETABLE_POLICY: TimetablePolicySettings = {
  schoolDays: [1, 2, 3, 4, 5],
  defaultLessonDurationMinutes: 50,
  maxLessonsPerDay: 8,
  maxTeacherLessonsPerDay: 8,
  maxTeacherLessonsPerWeek: 40,
  maxConsecutiveSubjectLessons: 2,
  maxSubjectLessonsPerDay: 5,
  requireTeacherAvailability: true,
  requireRoomForGeneration: false,
  allowSharedRooms: true,
};

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function normalizeTimetablePolicy(
  value: Partial<TimetablePolicySettings> | null | undefined,
): TimetablePolicySettings {
  const schoolDays = Array.isArray(value?.schoolDays)
    ? [...new Set(value.schoolDays.filter((day) => Number.isInteger(day) && day >= 1 && day <= 6))].sort((left, right) => left - right)
    : DEFAULT_TIMETABLE_POLICY.schoolDays;

  return {
    schoolDays: schoolDays.length > 0 ? schoolDays : DEFAULT_TIMETABLE_POLICY.schoolDays,
    defaultLessonDurationMinutes: positiveInteger(value?.defaultLessonDurationMinutes, DEFAULT_TIMETABLE_POLICY.defaultLessonDurationMinutes),
    maxLessonsPerDay: positiveInteger(value?.maxLessonsPerDay, DEFAULT_TIMETABLE_POLICY.maxLessonsPerDay),
    maxTeacherLessonsPerDay: positiveInteger(value?.maxTeacherLessonsPerDay, DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerDay),
    maxTeacherLessonsPerWeek: positiveInteger(value?.maxTeacherLessonsPerWeek, DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerWeek),
    maxConsecutiveSubjectLessons: positiveInteger(value?.maxConsecutiveSubjectLessons, DEFAULT_TIMETABLE_POLICY.maxConsecutiveSubjectLessons),
    maxSubjectLessonsPerDay: positiveInteger(value?.maxSubjectLessonsPerDay, DEFAULT_TIMETABLE_POLICY.maxSubjectLessonsPerDay),
    requireTeacherAvailability: value?.requireTeacherAvailability ?? DEFAULT_TIMETABLE_POLICY.requireTeacherAvailability,
    requireRoomForGeneration: value?.requireRoomForGeneration ?? DEFAULT_TIMETABLE_POLICY.requireRoomForGeneration,
    allowSharedRooms: value?.allowSharedRooms ?? DEFAULT_TIMETABLE_POLICY.allowSharedRooms,
  };
}
