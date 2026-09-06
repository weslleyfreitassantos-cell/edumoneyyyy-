import { supabase } from '../lib/supabaseClient';
import {
  normalizeAcademicShift,
  normalizeAcademicShifts,
  toAcademicShift,
} from '../lib/academic/academicShifts';
import { academicShiftSettingsService } from './academicShiftSettingsService';

export const SCHOOL_SETUP_STEP_IDS = [
  'academic-year',
  'terms',
  'subjects',
  'teaching-structure',
  'shifts',
  'classes',
  'class-subjects',
  'timetable',
] as const;

export type SchoolSetupStepId =
  (typeof SCHOOL_SETUP_STEP_IDS)[number];

export interface SchoolSetupStepState {
  id: SchoolSetupStepId;
  label: string;
  complete: boolean;
  href: string;
}

export interface SchoolSetupReview {
  academicYearName: string | null;
  termCount: number;
  subjectCount: number;
  classCount: number;
  curriculumClassCount: number;
  timetableClassCount: number;
}

export interface SchoolReadinessBlocker {
  id: string;
  label: string;
  complete: boolean;
  description: string;
  href: string;
}

export interface OperationalReadiness {
  blockers: SchoolReadinessBlocker[];
  completedCount: number;
  totalCount: number;
  progress: number;
  ready: boolean;
}

export interface SchoolSetupReadiness {
  institutionId: string;
  steps: SchoolSetupStepState[];
  completedCount: number;
  totalCount: number;
  progress: number;
  configured: boolean;
  academicSetupConfigured: boolean;
  academicSetupStatus: 'IN_PROGRESS' | 'CONFIGURED';
  status: 'IN_PROGRESS' | 'CONFIGURED';
  nextStepId: SchoolSetupStepId | null;
  review: SchoolSetupReview;
  publishedVersionId: string | null;
  operationalReadiness: OperationalReadiness;
  optionalSetup: {
    brandingConfigured: boolean;
  };
}

interface AcademicYearRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface InstitutionBrandingRow {
  login_display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface TermRow {
  id: string;
  academic_year_id: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
}

interface ClassRow {
  id: string;
  shift: string | null;
  active: boolean | null;
}

interface CurriculumRow {
  class_id: string;
  subject_id: string;
  weekly_lessons: number;
  active: boolean | null;
}

interface TimeSlotRow {
  shift: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean | null;
}

interface VersionRow {
  id: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_at?: string;
  published_at: string | null;
}

interface VersionEntryRow {
  version_id?: string;
  class_id: string;
  term_id: string;
  subject_offering_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean | null;
}

interface OfferingRow {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  active: boolean | null;
  teacher_profile_id?: string | null;
}

interface TeacherMembershipRow {
  profile_id: string;
  active: boolean | null;
  profiles?: { active: boolean | null } | { active: boolean | null }[] | null;
}

interface TeacherSubjectRow {
  teacher_profile_id: string;
  subject_id: string;
  active: boolean | null;
}

interface TeacherAvailabilityRow {
  teacher_profile_id: string;
  active: boolean | null;
}

interface EnrollmentRow {
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
}

interface TimetableCandidate {
  version: VersionRow;
  entries: VersionEntryRow[];
}

interface TimetableStructuralState {
  complete: boolean;
  completeClassIds: Set<string>;
}

function isActive(value: boolean | null | undefined): boolean {
  return value !== false;
}

function hasLoginBranding(
  branding: InstitutionBrandingRow | null,
): boolean {
  return Boolean(
    branding?.login_display_name?.trim() ||
      branding?.logo_url?.trim() ||
      branding?.favicon_url?.trim() ||
      branding?.primary_color?.trim() ||
      branding?.secondary_color?.trim(),
  );
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function timesOverlap(left: VersionEntryRow, right: VersionEntryRow): boolean {
  return (
    timeToMinutes(left.start_time) < timeToMinutes(right.end_time) &&
    timeToMinutes(right.start_time) < timeToMinutes(left.end_time)
  );
}

function termsOverlap(left: TermRow, right: TermRow): boolean {
  return left.start_date <= right.end_date && right.start_date <= left.end_date;
}

function evaluateTimetableStructure({
  version,
  entries,
  activeClasses,
  activeCurriculum,
  activeTerms,
  offerings,
  timeSlots,
}: {
  version: VersionRow;
  entries: VersionEntryRow[];
  activeClasses: ClassRow[];
  activeCurriculum: CurriculumRow[];
  activeTerms: TermRow[];
  offerings: OfferingRow[];
  timeSlots: TimeSlotRow[];
}): TimetableStructuralState {
  const activeEntries = entries.filter((entry) => isActive(entry.active));
  const activeTermIds = new Set(activeTerms.map((term) => term.id));
  const activeOfferings = offerings.filter(
    (offering) =>
      isActive(offering.active) && activeTermIds.has(offering.term_id),
  );
  const offeringById = new Map(
    activeOfferings.map((offering) => [offering.id, offering]),
  );
  const entriesByOffering = new Map<string, number>();

  for (const entry of activeEntries) {
    entriesByOffering.set(
      entry.subject_offering_id,
      (entriesByOffering.get(entry.subject_offering_id) ?? 0) + 1,
    );
  }

  const completeClassIds = new Set(
    activeClasses
      .filter((classRecord) => {
        const classCurriculum = activeCurriculum.filter(
          (item) =>
            item.class_id === classRecord.id && item.weekly_lessons > 0,
        );
        return (
          classCurriculum.length > 0 &&
          classCurriculum.every((item) => {
            const itemOfferings = activeOfferings.filter(
              (offering) =>
                offering.class_id === item.class_id &&
                offering.subject_id === item.subject_id,
            );
            return (
              itemOfferings.length > 0 &&
              itemOfferings.every(
                (offering) =>
                  (entriesByOffering.get(offering.id) ?? 0) ===
                  item.weekly_lessons,
              )
            );
          })
        );
      })
      .map((classRecord) => classRecord.id),
  );

  const slotShifts = new Set(
    timeSlots
      .filter((slot) => isActive(slot.active))
      .map((slot) => normalizeAcademicShift(slot.shift)),
  );
  const classesHaveSlots = activeClasses.every((classRecord) => {
    const classShift = toAcademicShift(classRecord.shift);
    return Boolean(classShift && slotShifts.has(classShift));
  });
  const termsById = new Map(activeTerms.map((term) => [term.id, term]));
  const classesById = new Map(
    activeClasses.map((classRecord) => [classRecord.id, classRecord]),
  );

  const entriesHaveValidScopeAndSlots = activeEntries.every((entry) => {
    const classRecord = classesById.get(entry.class_id);
    const offering = offeringById.get(entry.subject_offering_id);
    const term = termsById.get(entry.term_id);
    if (
      !classRecord ||
      !offering ||
      !term ||
      offering.class_id !== entry.class_id ||
      offering.term_id !== entry.term_id
    ) {
      return false;
    }

    const classShift = toAcademicShift(classRecord.shift);
    return Boolean(classShift) && timeSlots.some(
      (slot) =>
        isActive(slot.active) &&
        normalizeAcademicShift(slot.shift) === classShift &&
        slot.day_of_week === entry.day_of_week &&
        timeToMinutes(slot.start_time) <= timeToMinutes(entry.start_time) &&
        timeToMinutes(slot.end_time) >= timeToMinutes(entry.end_time),
    );
  });

  let hasClassConflict = false;
  for (let leftIndex = 0; leftIndex < activeEntries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < activeEntries.length;
      rightIndex += 1
    ) {
      const left = activeEntries[leftIndex];
      const right = activeEntries[rightIndex];
      if (
        left.class_id !== right.class_id ||
        left.day_of_week !== right.day_of_week ||
        !timesOverlap(left, right)
      ) {
        continue;
      }
      const leftTerm = termsById.get(left.term_id);
      const rightTerm = termsById.get(right.term_id);
      if (leftTerm && rightTerm && termsOverlap(leftTerm, rightTerm)) {
        hasClassConflict = true;
      }
    }
  }

  return {
    complete:
      version.status === 'PUBLISHED' &&
      version.id.length > 0 &&
      activeClasses.length > 0 &&
      classesHaveSlots &&
      completeClassIds.size === activeClasses.length &&
      entriesHaveValidScopeAndSlots &&
      !hasClassConflict,
    completeClassIds,
  };
}

function pickAcademicYear(
  years: AcademicYearRow[],
): AcademicYearRow | null {
  const activeYears = years.filter((year) => isActive(year.active));
  const today = new Date().toISOString().slice(0, 10);

  return (
    activeYears.find(
      (year) =>
        year.start_date <= today &&
        today <= year.end_date,
    ) ??
    activeYears[0] ??
    null
  );
}

function stepHref(stepId: SchoolSetupStepId): string {
  switch (stepId) {
    case 'academic-year':
    case 'terms':
      return '/admin?module=academic-years';
    case 'subjects':
      return '/admin?module=subjects';
    case 'teaching-structure':
    case 'shifts':
      return '/admin?module=academic-policies';
    case 'classes':
      return '/admin?module=classes';
    case 'class-subjects':
      return '/admin?module=curriculum';
    case 'timetable':
      return '/admin?module=timetable&view=automation';
  }
}

export function buildSchoolSetupReadiness({
  institutionId,
  loginBrandingConfigured,
  academicYear,
  terms,
  subjects,
  policies,
  classes,
  curriculum,
  timeSlots,
  publishedVersion,
  publishedEntries,
  timetableCandidates = [],
  offerings = [],
  enabledShifts,
  teacherProfiles = [],
  teacherSubjects = [],
  teacherAvailability = [],
  enrollments = [],
  requireTeacherAvailability = false,
}: {
  institutionId: string;
  loginBrandingConfigured: boolean;
  academicYear: AcademicYearRow | null;
  terms: TermRow[];
  subjects: { id: string }[];
  policies: { id: string }[];
  classes: ClassRow[];
  curriculum: CurriculumRow[];
  timeSlots: TimeSlotRow[];
  publishedVersion: VersionRow | null;
  publishedEntries: VersionEntryRow[];
  timetableCandidates?: TimetableCandidate[];
  offerings?: OfferingRow[];
  enabledShifts?: readonly string[];
  teacherProfiles?: TeacherMembershipRow[];
  teacherSubjects?: TeacherSubjectRow[];
  teacherAvailability?: TeacherAvailabilityRow[];
  enrollments?: EnrollmentRow[];
  requireTeacherAvailability?: boolean;
}): SchoolSetupReadiness {
  const activeClasses = classes.filter((classRecord) =>
    isActive(classRecord.active),
  );
  const configuredShifts = normalizeAcademicShifts(
    enabledShifts ?? [
      ...activeClasses.map((classRecord) => classRecord.shift),
      ...timeSlots.map((slot) => slot.shift),
    ],
    [],
  );
  const enabledShiftSet = new Set(configuredShifts);
  const activeCurriculum = curriculum.filter((item) =>
    isActive(item.active),
  );
  const curriculumClassIds = new Set(
    activeCurriculum
      .filter((item) => item.weekly_lessons > 0)
      .map((item) => item.class_id),
  );
  const candidates = [
    ...timetableCandidates,
    ...(publishedVersion
      ? [{ version: publishedVersion, entries: publishedEntries }]
      : []),
  ];
  const structuralCandidate = candidates.find((candidate) =>
    evaluateTimetableStructure({
      version: candidate.version,
      entries: candidate.entries,
      activeClasses,
      activeCurriculum,
      activeTerms: terms.filter((term) => isActive(term.active)),
      offerings,
      timeSlots,
    }).complete && candidate.version.status === 'PUBLISHED',
  );
  const timetableState = structuralCandidate
    ? evaluateTimetableStructure({
        version: structuralCandidate.version,
        entries: structuralCandidate.entries,
        activeClasses,
        activeCurriculum,
        activeTerms: terms.filter((term) => isActive(term.active)),
        offerings,
        timeSlots,
      })
    : { complete: false, completeClassIds: new Set<string>() };

  const completed = {
    'academic-year': academicYear !== null,
    terms:
      academicYear !== null &&
      terms.some((term) => isActive(term.active)),
    subjects: subjects.length > 0,
    'teaching-structure': policies.length > 0,
    shifts: configuredShifts.length > 0,
    classes:
      activeClasses.length > 0 &&
      activeClasses.every(
        (classRecord) => {
          const shift = toAcademicShift(classRecord.shift);
          return Boolean(shift && enabledShiftSet.has(shift));
        },
      ),
    'class-subjects':
      activeClasses.length > 0 &&
      activeClasses.every((classRecord) =>
        curriculumClassIds.has(classRecord.id),
      ),
    timetable:
      timetableState.complete,
  } satisfies Record<SchoolSetupStepId, boolean>;

  const labels: Record<SchoolSetupStepId, string> = {
    'academic-year': 'Ano letivo',
    terms: 'Períodos',
    subjects: 'Matérias',
    'teaching-structure': 'Estrutura de ensino',
    shifts: 'Turnos',
    classes: 'Turmas',
    'class-subjects': 'Matérias das turmas',
    timetable: 'Grade horária',
  };

  const steps = SCHOOL_SETUP_STEP_IDS.map((id) => ({
    id,
    label: labels[id],
    complete: completed[id],
    href: stepHref(id),
  }));
  const completedCount = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete);

  const activeTerms = terms.filter((term) => isActive(term.active));
  const activeOfferings = offerings.filter(
    (offering) => isActive(offering.active) && activeTerms.some((term) => term.id === offering.term_id),
  );
  const curriculumPairs = activeClasses.flatMap((classRecord) =>
    activeCurriculum
      .filter((item) => item.class_id === classRecord.id && item.weekly_lessons > 0)
      .map((item) => `${item.class_id}:${item.subject_id}`),
  );
  const offeringPairs = new Set(
    activeOfferings.map((offering) => `${offering.class_id}:${offering.subject_id}`),
  );
  const missingOfferingCount = curriculumPairs.filter(
    (pair) => !offeringPairs.has(pair),
  ).length;
  const activeTeacherProfiles = teacherProfiles.filter((teacher) => {
    const profileRelation = Array.isArray(teacher.profiles)
      ? teacher.profiles[0]
      : teacher.profiles;
    return isActive(teacher.active) && isActive(profileRelation?.active);
  });
  const activeTeacherIds = new Set(activeTeacherProfiles.map((teacher) => teacher.profile_id));
  const activeTeacherSubjectKeys = new Set(
    teacherSubjects
      .filter((row) => isActive(row.active) && activeTeacherIds.has(row.teacher_profile_id))
      .map((row) => `${row.teacher_profile_id}:${row.subject_id}`),
  );
  const missingAssignmentCount = activeOfferings.filter(
    (offering) =>
      !offering.teacher_profile_id ||
      !activeTeacherIds.has(offering.teacher_profile_id),
  ).length;
  const missingQualificationCount = activeOfferings.filter(
    (offering) =>
      !offering.teacher_profile_id ||
      !activeTeacherSubjectKeys.has(`${offering.teacher_profile_id}:${offering.subject_id}`),
  ).length;
  const assignedTeacherIds = new Set(
    activeOfferings
      .map((offering) => offering.teacher_profile_id)
      .filter((teacherId): teacherId is string => Boolean(teacherId)),
  );
  const teachersWithoutAvailability = [...assignedTeacherIds].filter(
    (teacherId) =>
      !teacherAvailability.some(
        (row) => row.teacher_profile_id === teacherId && isActive(row.active),
      ),
  ).length;
  const activeEnrollmentCount = enrollments.filter(
    (enrollment) =>
      enrollment.academic_year_id === academicYear?.id &&
      activeClasses.some((classRecord) => classRecord.id === enrollment.class_id) &&
      isActive(enrollment.active) &&
      enrollment.status?.trim().toLowerCase() === 'active',
  ).length;
  const operationalBlockers: SchoolReadinessBlocker[] = [
    {
      id: 'academic-setup',
      label: 'Configuração acadêmica',
      complete: completedCount === steps.length,
      description: completedCount === steps.length
        ? 'A estrutura acadêmica está completa.'
        : 'Finalize a estrutura acadêmica antes de operar a escola.',
      href: nextStep?.href ?? '/admin?module=overview',
    },
    {
      id: 'published-timetable',
      label: 'Grade publicada',
      complete: timetableState.complete,
      description: timetableState.complete
        ? 'Existe uma grade publicada e válida.'
        : 'Publique uma grade válida para as turmas ativas.',
      href: '/admin?module=timetable&view=automation',
    },
    {
      id: 'teachers-configured',
      label: 'Professores cadastrados',
      complete: activeTeacherProfiles.length > 0,
      description: activeTeacherProfiles.length > 0
        ? `${activeTeacherProfiles.length} professor(es) ativo(s).`
        : 'Cadastre pelo menos um professor ativo.',
      href: '/admin?module=teachers',
    },
    {
      id: 'subject-offerings',
      label: 'Ofertas das disciplinas',
      complete: missingOfferingCount === 0 && curriculumPairs.length > 0,
      description: missingOfferingCount === 0 && curriculumPairs.length > 0
        ? 'Todas as disciplinas da matriz possuem oferta.'
        : `${missingOfferingCount} disciplina(s) da matriz ainda não possuem oferta.`,
      href: '/admin?module=assignments',
    },
    {
      id: 'teacher-assignments',
      label: 'Professores associados',
      complete: missingAssignmentCount === 0 && activeOfferings.length > 0,
      description: missingAssignmentCount === 0 && activeOfferings.length > 0
        ? 'As ofertas possuem professores ativos.'
        : `${missingAssignmentCount} oferta(s) ainda estão sem professor ativo.`,
      href: '/admin?module=assignments',
    },
    {
      id: 'teacher-qualifications',
      label: 'Habilitações dos professores',
      complete: missingQualificationCount === 0 && activeOfferings.length > 0,
      description: missingQualificationCount === 0 && activeOfferings.length > 0
        ? 'As disciplinas estão associadas às habilitações dos professores.'
        : `${missingQualificationCount} oferta(s) não possui habilitação correspondente.`,
      href: '/admin?module=teachers',
    },
    {
      id: 'teacher-availability',
      label: 'Disponibilidade dos professores',
      complete: !requireTeacherAvailability || (assignedTeacherIds.size > 0 && teachersWithoutAvailability === 0),
      description: !requireTeacherAvailability
        ? 'A política não exige disponibilidade cadastrada.'
        : teachersWithoutAvailability === 0 && assignedTeacherIds.size > 0
          ? 'A disponibilidade está cadastrada para os professores associados.'
          : `${teachersWithoutAvailability} professor(es) associado(s) sem disponibilidade.`,
      href: '/admin?module=teachers',
    },
    {
      id: 'active-enrollments',
      label: 'Matrículas ativas',
      complete: activeEnrollmentCount > 0,
      description: activeEnrollmentCount > 0
        ? `${activeEnrollmentCount} matrícula(s) ativa(s).`
        : 'Matricule pelo menos um aluno para iniciar a operação.',
      href: '/admin?module=students',
    },
  ];
  const operationalCompletedCount = operationalBlockers.filter((blocker) => blocker.complete).length;

  return {
    institutionId,
    steps,
    completedCount,
    totalCount: steps.length,
    progress: Math.round((completedCount / steps.length) * 100),
    configured: completedCount === steps.length,
    academicSetupConfigured: completedCount === steps.length,
    academicSetupStatus: completedCount === steps.length ? 'CONFIGURED' : 'IN_PROGRESS',
    status: completedCount === steps.length ? 'CONFIGURED' : 'IN_PROGRESS',
    nextStepId: nextStep?.id ?? null,
    review: {
      academicYearName: academicYear?.name ?? null,
      termCount: terms.filter((term) => isActive(term.active)).length,
      subjectCount: subjects.length,
      classCount: activeClasses.length,
      curriculumClassCount: curriculumClassIds.size,
      timetableClassCount: timetableState.completeClassIds.size,
    },
    publishedVersionId:
      structuralCandidate?.version.id ?? null,
    operationalReadiness: {
      blockers: operationalBlockers,
      completedCount: operationalCompletedCount,
      totalCount: operationalBlockers.length,
      progress: Math.round((operationalCompletedCount / operationalBlockers.length) * 100),
      ready: operationalCompletedCount === operationalBlockers.length,
    },
    optionalSetup: {
      brandingConfigured: loginBrandingConfigured,
    },
  };
}

export const schoolSetupService = {
  async getReadiness(
    institutionId: string,
  ): Promise<SchoolSetupReadiness> {
    const [yearsResult, brandingResult] = await Promise.all([
      supabase
        .from('academic_years')
        .select('id, name, start_date, end_date, active')
        .eq('institution_id', institutionId)
        .order('start_date', { ascending: false }),
      supabase
        .from('institutions')
        .select('login_display_name, logo_url, favicon_url, primary_color, secondary_color')
        .eq('id', institutionId)
        .maybeSingle(),
    ]);

    const { data: yearsData, error: yearsError } = yearsResult;
    const { data: brandingData, error: brandingError } = brandingResult;

    if (yearsError) throw yearsError;
    if (brandingError) throw brandingError;

    const loginBrandingConfigured = hasLoginBranding(
      (brandingData ?? null) as InstitutionBrandingRow | null,
    );

    const academicYear = pickAcademicYear(
      (yearsData ?? []) as AcademicYearRow[],
    );

    if (!academicYear) {
      return buildSchoolSetupReadiness({
        institutionId,
        loginBrandingConfigured,
        academicYear: null,
        terms: [],
        subjects: [],
        policies: [],
        classes: [],
        curriculum: [],
        timeSlots: [],
        publishedVersion: null,
        publishedEntries: [],
        offerings: [],
      });
    }

    const [
      termsResult,
      subjectsResult,
      policiesResult,
      classesResult,
      curriculumResult,
      slotsResult,
      versionsResult,
      offeringsResult,
      teachersResult,
      teacherSubjectsResult,
      teacherAvailabilityResult,
      enrollmentsResult,
    ] = await Promise.all([
      supabase
      .from('terms')
        .select('id, academic_year_id, start_date, end_date, active')
        .eq('academic_year_id', academicYear.id),
      supabase
        .from('subjects')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('active', true),
      supabase
        .from('academic_policies')
        .select('id, require_teacher_availability')
        .eq('institution_id', institutionId)
        .eq('academic_year_id', academicYear.id)
        .eq('active', true),
      supabase
        .from('classes')
        .select('id, shift, active')
        .eq('institution_id', institutionId)
        .eq('academic_year_id', academicYear.id),
      supabase
        .from('class_curriculum_items')
        .select('class_id, subject_id, weekly_lessons, active')
        .eq('institution_id', institutionId),
      supabase
        .from('school_time_slots')
        .select('shift, day_of_week, start_time, end_time, active')
        .eq('institution_id', institutionId),
      supabase
        .from('timetable_versions')
        .select('id, status, created_at, published_at')
        .eq('institution_id', institutionId)
        .eq('academic_year_id', academicYear.id)
        .in('status', ['DRAFT', 'PUBLISHED', 'ARCHIVED'])
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_offerings')
        .select('id, class_id, subject_id, teacher_profile_id, term_id, active, classes!inner(institution_id, academic_year_id)')
        .eq('classes.institution_id', institutionId)
        .eq('classes.academic_year_id', academicYear.id),
      supabase
        .from('memberships')
        .select('profile_id, active, profiles:profile_id(active)')
        .eq('institution_id', institutionId)
        .eq('role', 'TEACHER'),
      supabase
        .from('teacher_subjects')
        .select('teacher_profile_id, subject_id, active')
        .eq('institution_id', institutionId),
      supabase
        .from('teacher_availability')
        .select('teacher_profile_id, active')
        .eq('institution_id', institutionId),
      supabase
        .from('enrollments')
        .select('class_id, academic_year_id, status, active')
        .eq('academic_year_id', academicYear.id),
    ]);

    const results = [
      termsResult,
      subjectsResult,
      policiesResult,
      classesResult,
      curriculumResult,
      slotsResult,
      versionsResult,
      offeringsResult,
      teachersResult,
      teacherSubjectsResult,
      teacherAvailabilityResult,
      enrollmentsResult,
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const versions = (versionsResult.data ?? []) as VersionRow[];
    const versionIds = versions.map((version) => version.id);
    let entriesData: VersionEntryRow[] = [];
    if (versionIds.length > 0) {
      const entriesResult = await supabase
        .from('timetable_version_entries')
        .select(
          'version_id, class_id, term_id, subject_offering_id, day_of_week, start_time, end_time, active',
        )
        .in('version_id', versionIds);
      if (entriesResult.error) throw entriesResult.error;
      entriesData = (entriesResult.data ?? []) as VersionEntryRow[];
    }
    const entriesByVersion = new Map<string, VersionEntryRow[]>();
    for (const entry of entriesData) {
      if (!entry.version_id) continue;
      const entries = entriesByVersion.get(entry.version_id) ?? [];
      entries.push(entry);
      entriesByVersion.set(entry.version_id, entries);
    }
    const timetableCandidates = versions.map((version) => ({
      version,
      entries: entriesByVersion.get(version.id) ?? [],
    }));
    const publishedCandidate = timetableCandidates.find(
      (candidate) => candidate.version.status === 'PUBLISHED',
    );
    const enabledShifts = await academicShiftSettingsService.getEnabledShifts(
      institutionId,
    );

    return buildSchoolSetupReadiness({
      institutionId,
      loginBrandingConfigured,
      academicYear,
      terms: (termsResult.data ?? []) as TermRow[],
      subjects: (subjectsResult.data ?? []) as { id: string }[],
      policies: (policiesResult.data ?? []) as { id: string }[],
      classes: (classesResult.data ?? []) as ClassRow[],
      curriculum: (curriculumResult.data ?? []) as CurriculumRow[],
      timeSlots: (slotsResult.data ?? []) as TimeSlotRow[],
      publishedVersion: publishedCandidate?.version ?? null,
      publishedEntries: publishedCandidate?.entries ?? [],
      timetableCandidates,
      offerings: (offeringsResult.data ?? []) as OfferingRow[],
      enabledShifts,
      teacherProfiles: (teachersResult.data ?? []) as TeacherMembershipRow[],
      teacherSubjects: (teacherSubjectsResult.data ?? []) as TeacherSubjectRow[],
      teacherAvailability: (teacherAvailabilityResult.data ?? []) as TeacherAvailabilityRow[],
      enrollments: (enrollmentsResult.data ?? []) as EnrollmentRow[],
      requireTeacherAvailability: ((policiesResult.data ?? []) as { require_teacher_availability?: boolean | null }[])
        .some((policy) => policy.require_teacher_availability === true),
    });
  },
};
