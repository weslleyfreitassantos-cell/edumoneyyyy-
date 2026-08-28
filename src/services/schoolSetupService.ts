import { supabase } from '../lib/supabaseClient';

export const SCHOOL_SETUP_STEP_IDS = [
  'login-branding',
  'academic-year',
  'terms',
  'subjects',
  'teaching-structure',
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

export interface SchoolSetupReadiness {
  institutionId: string;
  steps: SchoolSetupStepState[];
  completedCount: number;
  totalCount: number;
  progress: number;
  configured: boolean;
  status: 'IN_PROGRESS' | 'CONFIGURED';
  nextStepId: SchoolSetupStepId | null;
  review: SchoolSetupReview;
  publishedVersionId: string | null;
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
      .map((slot) => slot.shift.trim()),
  );
  const classesHaveSlots = activeClasses.every((classRecord) =>
    slotShifts.has(classRecord.shift?.trim() ?? ''),
  );
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

    return timeSlots.some(
      (slot) =>
        isActive(slot.active) &&
        slot.shift.trim() === (classRecord.shift?.trim() ?? '') &&
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
    case 'login-branding':
      return '/personalizar-login';
    case 'academic-year':
    case 'terms':
      return '/admin?module=academic-years';
    case 'subjects':
      return '/admin?module=subjects';
    case 'teaching-structure':
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
}): SchoolSetupReadiness {
  const activeClasses = classes.filter((classRecord) =>
    isActive(classRecord.active),
  );
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
    }).complete,
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
    'login-branding': loginBrandingConfigured,
    'academic-year': academicYear !== null,
    terms:
      academicYear !== null &&
      terms.some((term) => isActive(term.active)),
    subjects: subjects.length > 0,
    'teaching-structure': policies.length > 0,
    classes:
      activeClasses.length > 0 &&
      activeClasses.every(
        (classRecord) => Boolean(classRecord.shift?.trim()),
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
    'login-branding': 'Personalizar login',
    'academic-year': 'Ano letivo',
    terms: 'Períodos',
    subjects: 'Matérias',
    'teaching-structure': 'Estrutura de ensino',
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

  return {
    institutionId,
    steps,
    completedCount,
    totalCount: steps.length,
    progress: Math.round((completedCount / steps.length) * 100),
    configured: completedCount === steps.length,
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
      candidates.find((candidate) => candidate.version.status === 'PUBLISHED')
        ?.version.id ?? publishedVersion?.id ?? null,
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
        .select('id')
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
        .in('status', ['DRAFT', 'PUBLISHED'])
        .order('created_at', { ascending: false }),
      supabase
        .from('subject_offerings')
        .select('id, class_id, subject_id, term_id, active, classes!inner(institution_id, academic_year_id)')
        .eq('classes.institution_id', institutionId)
        .eq('classes.academic_year_id', academicYear.id),
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
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const versions = (versionsResult.data ?? []) as VersionRow[];
    const timetableCandidates = await Promise.all(
      versions.map(async (version) => {
        const entriesResult = await supabase
          .from('timetable_version_entries')
          .select(
            'class_id, term_id, subject_offering_id, day_of_week, start_time, end_time, active',
          )
          .eq('version_id', version.id);
        if (entriesResult.error) throw entriesResult.error;
        return {
          version,
          entries: (entriesResult.data ?? []) as VersionEntryRow[],
        };
      }),
    );
    const publishedCandidate = timetableCandidates.find(
      (candidate) => candidate.version.status === 'PUBLISHED',
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
    });
  },
};
