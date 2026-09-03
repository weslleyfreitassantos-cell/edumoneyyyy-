import { supabase } from '../lib/supabaseClient';

interface StudentSummaryRow {
  id: string;
  active: boolean | null;
}

interface ProfileSummaryRow {
  id: string;
  full_name: string;
}

interface MembershipSummaryRow {
  profile_id: string;
  role: string;
  active: boolean | null;
}

interface AcademicYearSummaryRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface TermSummaryRow {
  id: string;
  name: string;
  academic_year_id: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface ClassSummaryRow {
  id: string;
  name: string;
  active: boolean | null;
}

interface SubjectSummaryRow {
  id: string;
  name: string;
  active: boolean | null;
}

interface EnrollmentSummaryRow {
  id: string;
  student_id: string;
  class_id: string;
  active: boolean | null;
}

interface GuardianshipSummaryRow {
  id: string;
  student_id: string;
  guardian_profile_id: string;
  active: boolean | null;
}

interface CurriculumSummaryRow {
  id: string;
  class_id: string;
  subject_id: string;
  active: boolean | null;
  needs_review: boolean;
}

interface OfferingSummaryRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  active: boolean | null;
}

export interface AdminOverviewWarning {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning';
}

export interface AdminOverviewData {
  metrics: {
    activeStudents: number;
    inactiveStudents: number;
    activeTeachers: number;
    activeGuardians: number;
    activeClasses: number;
    activeSubjects: number;
    activeEnrollments: number;
    activeAssignments: number;
    activeCurriculumItems: number;
    curriculumItemsNeedingReview: number;
  };
  currentAcademicYear: AcademicYearSummaryRow | null;
  currentTerm: TermSummaryRow | null;
  warnings: AdminOverviewWarning[];
}

function isActive(
  value: boolean | null,
): boolean {
  return value !== false;
}

function isWithinDateRange(
  today: string,
  startDate: string,
  endDate: string,
): boolean {
  return startDate <= today && today <= endDate;
}

function pickCurrentAcademicYear(
  years: AcademicYearSummaryRow[],
  today: string,
): AcademicYearSummaryRow | null {
  const activeYears = years.filter((year) =>
    isActive(year.active),
  );

  return (
    activeYears.find((year) =>
      isWithinDateRange(
        today,
        year.start_date,
        year.end_date,
      ),
    ) ??
    activeYears[0] ??
    null
  );
}

function pickCurrentTerm(
  terms: TermSummaryRow[],
  currentAcademicYearId: string | null,
  today: string,
): TermSummaryRow | null {
  if (!currentAcademicYearId) {
    return null;
  }

  const yearTerms = terms.filter(
    (term) =>
      term.academic_year_id === currentAcademicYearId &&
      isActive(term.active),
  );

  return (
    yearTerms.find((term) =>
      isWithinDateRange(
        today,
        term.start_date,
        term.end_date,
      ),
    ) ??
    yearTerms[0] ??
    null
  );
}

function getProfileName(
  membership: MembershipSummaryRow,
  profileNames: Map<string, string>,
): string {
  return profileNames.get(membership.profile_id) ?? 'Professor';
}

export const adminOverviewService = {
  async getOverview(
    institutionId: string,
  ): Promise<AdminOverviewData> {
    const [
      studentsResult,
      membershipsResult,
      academicYearsResult,
      classesResult,
      subjectsResult,
      curriculumResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select('id, active')
        .eq('institution_id', institutionId),

      supabase
        .from('memberships')
        .select('profile_id, role, active')
        .eq('institution_id', institutionId)
        .in('role', ['TEACHER', 'GUARDIAN']),

      supabase
        .from('academic_years')
        .select(
          'id, name, start_date, end_date, active',
        )
        .eq('institution_id', institutionId)
        .order('start_date', {
          ascending: false,
        }),

      supabase
        .from('classes')
        .select('id, name, active')
        .eq('institution_id', institutionId),

      supabase
        .from('subjects')
        .select('id, name, active')
        .eq('institution_id', institutionId),

      supabase
        .from('class_curriculum_items')
        .select(
          `
          id,
          class_id,
          subject_id,
          active,
          needs_review
        `,
        )
        .eq('institution_id', institutionId),
    ]);

    const queryErrors = [
      studentsResult.error,
      membershipsResult.error,
      academicYearsResult.error,
      classesResult.error,
      subjectsResult.error,
      curriculumResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      throw queryErrors[0];
    }

    const students =
      (studentsResult.data ??
        []) as StudentSummaryRow[];

    const memberships =
      (membershipsResult.data ??
        []) as unknown as MembershipSummaryRow[];

    const academicYears =
      (academicYearsResult.data ??
        []) as AcademicYearSummaryRow[];

    const classes =
      (classesResult.data ??
        []) as ClassSummaryRow[];

    const subjects =
      (subjectsResult.data ??
        []) as SubjectSummaryRow[];

    const curriculumItems =
      (curriculumResult.data ??
        []) as unknown as CurriculumSummaryRow[];

    const studentIds = new Set(
      students.map((student) => student.id),
    );
    const classIds = new Set(
      classes.map((classRecord) => classRecord.id),
    );
    const subjectIds = new Set(
      subjects.map((subject) => subject.id),
    );
    const academicYearIds = academicYears.map((year) => year.id);
    const profileIds = memberships.map(
      (membership) => membership.profile_id,
    );

    // These tables do not carry institution_id. Resolve the tenant through
    // already-scoped IDs instead of asking PostgREST to build nested joins
    // under the row-level security policies.
    const [
      profilesResult,
      termsResult,
      enrollmentsResult,
      guardianshipsResult,
      offeringsResult,
    ] = await Promise.all([
      profileIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
      academicYearIds.length > 0
        ? supabase
            .from('terms')
            .select('id, name, academic_year_id, start_date, end_date, active')
            .in('academic_year_id', academicYearIds)
            .order('start_date', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      classIds.size > 0 && studentIds.size > 0
        ? supabase
            .from('enrollments')
            .select('id, student_id, class_id, active')
            .in('class_id', Array.from(classIds))
            .in('student_id', Array.from(studentIds))
        : Promise.resolve({ data: [], error: null }),
      studentIds.size > 0
        ? supabase
            .from('guardianships')
            .select('id, guardian_profile_id, active, student_id')
            .in('student_id', Array.from(studentIds))
        : Promise.resolve({ data: [], error: null }),
      classIds.size > 0 && subjectIds.size > 0
        ? supabase
            .from('subject_offerings')
            .select('id, class_id, subject_id, teacher_profile_id, active')
            .in('class_id', Array.from(classIds))
            .in('subject_id', Array.from(subjectIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    const dependentQueryErrors = [
      profilesResult.error,
      termsResult.error,
      enrollmentsResult.error,
      guardianshipsResult.error,
      offeringsResult.error,
    ].filter(Boolean);

    if (dependentQueryErrors.length > 0) {
      throw dependentQueryErrors[0];
    }

    const profiles = (profilesResult.data ?? []) as ProfileSummaryRow[];
    const profileNames = new Map(
      profiles.map((profile) => [profile.id, profile.full_name]),
    );
    const terms = (termsResult.data ?? []) as TermSummaryRow[];
    const enrollments =
      (enrollmentsResult.data ?? []) as EnrollmentSummaryRow[];
    const guardianships =
      (guardianshipsResult.data ?? []) as GuardianshipSummaryRow[];
    const offerings =
      (offeringsResult.data ?? []) as OfferingSummaryRow[];

    const activeEnrollments = enrollments.filter(
      (enrollment) =>
        isActive(enrollment.active) &&
        classIds.has(enrollment.class_id) &&
        studentIds.has(enrollment.student_id),
    );

    const institutionOfferings = offerings.filter(
      (offering) =>
        classIds.has(offering.class_id) &&
        subjectIds.has(offering.subject_id),
    );

    const activeOfferings =
      institutionOfferings.filter((offering) =>
        isActive(offering.active),
      );

    const activeGuardianProfiles = new Set(
      guardianships
        .filter((guardianship) => {
          return (
            isActive(guardianship.active) &&
            studentIds.has(guardianship.student_id)
          );
        })
        .map(
          (guardianship) =>
            guardianship.guardian_profile_id,
        ),
    );

    const activeTeachers =
      memberships.filter(
        (membership) =>
          membership.role === 'TEACHER' &&
          isActive(membership.active),
      );

    const activeStudents = students.filter(
      (student) => isActive(student.active),
    );

    const activeClasses = classes.filter(
      (classRecord) =>
        isActive(classRecord.active),
    );

    const activeSubjects = subjects.filter(
      (subject) => isActive(subject.active),
    );

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const currentAcademicYear =
      pickCurrentAcademicYear(
        academicYears,
        today,
      );

    const currentTerm = pickCurrentTerm(
      terms,
      currentAcademicYear?.id ?? null,
      today,
    );

    const enrollmentStudentIds = new Set(
      activeEnrollments.map(
        (enrollment) => enrollment.student_id,
      ),
    );

    const offeringClassIds = new Set(
      activeOfferings.map(
        (offering) => offering.class_id,
      ),
    );

    const offeringTeacherProfileIds = new Set(
      activeOfferings.map(
        (offering) =>
          offering.teacher_profile_id,
      ),
    );

    const offeringSubjectIds = new Set(
      activeOfferings.map(
        (offering) => offering.subject_id,
      ),
    );

    const warnings: AdminOverviewWarning[] = [];

    if (!currentAcademicYear) {
      warnings.push({
        id: 'no-active-academic-year',
        title: 'Nenhum ano letivo ativo',
        description:
          'Cadastre ou ative um ano letivo para liberar turmas, períodos e matrículas.',
        severity: 'warning',
      });
    }

    if (classes.length === 0) {
      warnings.push({
        id: 'no-classes',
        title: 'Nenhuma turma cadastrada',
        description:
          'As matrículas e atribuições dependem de turmas cadastradas.',
        severity: 'warning',
      });
    }

    for (const classRecord of activeClasses) {
      if (!offeringClassIds.has(classRecord.id)) {
        warnings.push({
          id: `class-without-offering-${classRecord.id}`,
          title: 'Turma sem atribuições',
          description: `${classRecord.name} ainda não possui disciplinas ofertadas.`,
          severity: 'info',
        });
      }
    }

    for (const teacher of activeTeachers) {
      if (
        !offeringTeacherProfileIds.has(
          teacher.profile_id,
        )
      ) {
        warnings.push({
          id: `teacher-without-offering-${teacher.profile_id}`,
          title: 'Professor sem atribuição',
          description: `${getProfileName(teacher, profileNames)} ainda não foi vinculado a uma disciplina/turma.`,
          severity: 'info',
        });
      }
    }

    for (const student of activeStudents) {
      if (!enrollmentStudentIds.has(student.id)) {
        warnings.push({
          id: `student-without-enrollment-${student.id}`,
          title: 'Aluno sem matrícula',
          description:
            'Existe aluno ativo sem matrícula ativa.',
          severity: 'info',
        });
        break;
      }
    }

    for (const subject of activeSubjects) {
      if (!offeringSubjectIds.has(subject.id)) {
        warnings.push({
          id: `subject-without-offering-${subject.id}`,
          title: 'Disciplina sem oferta',
          description: `${subject.name} ainda não foi ofertada em uma turma.`,
          severity: 'info',
        });
      }
    }

    const institutionCurriculumItems = curriculumItems.filter((item) =>
      classIds.has(item.class_id),
    );

    const activeCurriculumItems = institutionCurriculumItems.filter(
      (item) => isActive(item.active),
    );

    const curriculumItemsNeedingReview = institutionCurriculumItems.filter(
      (item) => item.needs_review,
    );

    if (curriculumItemsNeedingReview.length > 0) {
      warnings.push({
        id: 'curriculum-needs-review',
        title: 'Itens da matriz precisam de revisão',
        description: `${curriculumItemsNeedingReview.length} item(ns) da matriz curricular foram criados por backfill da migração e precisam ser revisados.`,
        severity: 'warning',
      });
    }

    const activeCurriculumClassIds = new Set(
      activeCurriculumItems.map((item) => item.class_id),
    );

    for (const classRecord of activeClasses) {
      if (!activeCurriculumClassIds.has(classRecord.id)) {
        warnings.push({
          id: `class-without-curriculum-${classRecord.id}`,
          title: 'Turma sem matriz curricular',
          description: `${classRecord.name} ainda não possui disciplinas na matriz curricular.`,
          severity: 'info',
        });
      }
    }

    return {
      metrics: {
        activeStudents: activeStudents.length,
        inactiveStudents:
          students.length - activeStudents.length,
        activeTeachers: activeTeachers.length,
        activeGuardians:
          activeGuardianProfiles.size,
        activeClasses: activeClasses.length,
        activeSubjects: activeSubjects.length,
        activeEnrollments:
          activeEnrollments.length,
        activeAssignments:
          activeOfferings.length,
        activeCurriculumItems:
          activeCurriculumItems.length,
        curriculumItemsNeedingReview:
          curriculumItemsNeedingReview.length,
      },
      currentAcademicYear,
      currentTerm,
      warnings,
    };
  },
};
