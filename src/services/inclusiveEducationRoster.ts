export type InclusiveProgressEnrollment = {
  student_id: string;
  academic_year_id: string;
  class_academic_year_id: string;
};

export type InclusiveProgressPlan = {
  student_id: string;
  academic_year_id: string | null;
  status: string;
};

export function selectCurrentInclusiveProgressStudentIds(
  currentAcademicYearIds: readonly string[],
  enrollments: readonly InclusiveProgressEnrollment[],
  plans: readonly InclusiveProgressPlan[],
): string[] {
  const currentYearIds = new Set(currentAcademicYearIds);
  const currentlyEnrolledStudentIds = new Set(
    enrollments
      .filter((enrollment) => (
        currentYearIds.has(enrollment.academic_year_id)
        && enrollment.class_academic_year_id === enrollment.academic_year_id
      ))
      .map((enrollment) => enrollment.student_id),
  );
  const includedStudentIds = new Set<string>();

  for (const plan of plans) {
    if (plan.status !== 'DRAFT' && plan.status !== 'ACTIVE') continue;

    const belongsToCurrentYear = plan.academic_year_id !== null
      ? currentYearIds.has(plan.academic_year_id)
      : currentlyEnrolledStudentIds.has(plan.student_id);
    if (belongsToCurrentYear) includedStudentIds.add(plan.student_id);
  }

  return [...includedStudentIds];
}
