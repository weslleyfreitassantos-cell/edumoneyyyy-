import { supabase } from '../lib/supabaseClient';

export const SCHOOL_SETUP_STEP_IDS = [
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

interface TermRow {
  id: string;
  academic_year_id: string;
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
  active: boolean | null;
}

interface VersionRow {
  id: string;
  published_at: string | null;
}

interface VersionEntryRow {
  class_id: string;
  subject_offering_id?: string;
  active: boolean | null;
}

interface OfferingRow {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  active: boolean | null;
}

function isActive(value: boolean | null | undefined): boolean {
  return value !== false;
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
  academicYear,
  terms,
  subjects,
  policies,
  classes,
  curriculum,
  timeSlots,
  publishedVersion,
  publishedEntries,
  offerings = [],
}: {
  institutionId: string;
  academicYear: AcademicYearRow | null;
  terms: TermRow[];
  subjects: { id: string }[];
  policies: { id: string }[];
  classes: ClassRow[];
  curriculum: CurriculumRow[];
  timeSlots: TimeSlotRow[];
  publishedVersion: VersionRow | null;
  publishedEntries: VersionEntryRow[];
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
  const activeOfferings = offerings.filter((offering) => isActive(offering.active));
  const publishedEntriesByOffering = new Map<string, number>();
  for (const entry of publishedEntries) {
    if (!isActive(entry.active) || !entry.subject_offering_id) continue;
    const current = publishedEntriesByOffering.get(entry.subject_offering_id) ?? 0;
    publishedEntriesByOffering.set(entry.subject_offering_id, current + 1);
  }
  const workloadCompleteClassIds = new Set(
    activeClasses
      .filter((classRecord) => {
        const classCurriculum = activeCurriculum.filter(
          (item) => item.class_id === classRecord.id && item.weekly_lessons > 0,
        );
        return classCurriculum.length > 0 && classCurriculum.every((item) => {
          const itemOfferings = activeOfferings.filter(
            (offering) =>
              offering.class_id === item.class_id &&
              offering.subject_id === item.subject_id,
          );
          return itemOfferings.length > 0 && itemOfferings.every(
            (offering) =>
              (publishedEntriesByOffering.get(offering.id) ?? 0) >= item.weekly_lessons,
          );
        });
      })
      .map((classRecord) => classRecord.id),
  );
  const slotShifts = new Set(
    timeSlots
      .filter((slot) => isActive(slot.active))
      .map((slot) => slot.shift),
  );

  const completed = {
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
      activeClasses.length > 0 &&
      activeClasses.every((classRecord) =>
        slotShifts.has(classRecord.shift?.trim() ?? ''),
      ) &&
      publishedVersion !== null &&
      activeClasses.every((classRecord) => workloadCompleteClassIds.has(classRecord.id)),
  } satisfies Record<SchoolSetupStepId, boolean>;

  const labels: Record<SchoolSetupStepId, string> = {
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
      timetableClassCount: workloadCompleteClassIds.size,
    },
    publishedVersionId: publishedVersion?.id ?? null,
  };
}

export const schoolSetupService = {
  async getReadiness(
    institutionId: string,
  ): Promise<SchoolSetupReadiness> {
    const { data: yearsData, error: yearsError } = await supabase
      .from('academic_years')
      .select('id, name, start_date, end_date, active')
      .eq('institution_id', institutionId)
      .order('start_date', { ascending: false });

    if (yearsError) throw yearsError;

    const academicYear = pickAcademicYear(
      (yearsData ?? []) as AcademicYearRow[],
    );

    if (!academicYear) {
      return buildSchoolSetupReadiness({
        institutionId,
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
        .select('id, academic_year_id, active')
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
        .select('shift, active')
        .eq('institution_id', institutionId),
      supabase
        .from('timetable_versions')
        .select('id, published_at')
        .eq('institution_id', institutionId)
        .eq('academic_year_id', academicYear.id)
        .eq('status', 'PUBLISHED')
        .order('published_at', { ascending: false })
        .limit(1),
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

    const publishedVersion =
      ((versionsResult.data ?? [])[0] as VersionRow | undefined) ?? null;
    let publishedEntries: VersionEntryRow[] = [];

    if (publishedVersion) {
      const entriesResult = await supabase
      .from('timetable_version_entries')
        .select('class_id, subject_offering_id, active')
        .eq('version_id', publishedVersion.id);

      if (entriesResult.error) throw entriesResult.error;
      publishedEntries = (entriesResult.data ?? []) as VersionEntryRow[];
    }

    return buildSchoolSetupReadiness({
      institutionId,
      academicYear,
      terms: (termsResult.data ?? []) as TermRow[],
      subjects: (subjectsResult.data ?? []) as { id: string }[],
      policies: (policiesResult.data ?? []) as { id: string }[],
      classes: (classesResult.data ?? []) as ClassRow[],
      curriculum: (curriculumResult.data ?? []) as CurriculumRow[],
      timeSlots: (slotsResult.data ?? []) as TimeSlotRow[],
      publishedVersion,
      publishedEntries,
      offerings: (offeringsResult.data ?? []) as OfferingRow[],
    });
  },
};
