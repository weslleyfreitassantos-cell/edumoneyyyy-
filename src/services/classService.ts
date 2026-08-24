import { supabase } from '../lib/supabaseClient';

import {
  classSchema,
  classUpdateSchema,
  type ClassFormData,
  type ClassUpdateData,
} from '../schemas/adminSchemas';

interface AcademicYearRelation {
  name: string;
  institution_id?: string;
}

interface ClassQueryRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  capacity: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  academic_years:
    | AcademicYearRelation
    | AcademicYearRelation[]
    | null;
}

interface EnrollmentCountRow {
  class_id: string;
  active: boolean | null;
}

interface OfferingCountRow {
  class_id: string;
  active: boolean | null;
}

interface CurriculumCountRow {
  class_id: string;
  active: boolean | null;
}

export interface ClassRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  academic_year_name: string | null;
  name: string;
  grade_level: string | null;
  shift: string | null;
  capacity: number;
  active: boolean;
  active_enrollments_count: number;
  active_offerings_count: number;
  active_curriculum_items_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClassDeletionImpact {
  enrollmentCount: number;
  offeringCount: number;
  curriculumItemCount: number;
  timetableVersionEntryCount: number;
  totalLinkedRecords: number;
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function buildClassDeletionBlockedMessage(
  impact: ClassDeletionImpact,
): string | null {
  const details: string[] = [];

  if (impact.enrollmentCount > 0) {
    details.push(`${impact.enrollmentCount} matrícula(s) de aluno`);
  }

  if (impact.offeringCount > 0) {
    details.push(`${impact.offeringCount} oferta(s) de disciplina`);
  }

  if (impact.curriculumItemCount > 0) {
    details.push(`${impact.curriculumItemCount} item(ns) de matriz`);
  }

  if (impact.timetableVersionEntryCount > 0) {
    details.push(`${impact.timetableVersionEntryCount} entrada(s) de grade`);
  }

  if (details.length === 0) {
    return null;
  }

  return `Esta turma possui ${details.join(', ')} vinculada(s). A exclusão física está bloqueada para preservar o histórico. Use "Desativar" para mantê-lo.`;
}

async function assertAcademicYearBelongsToInstitution(
  academicYearId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id')
    .eq('id', academicYearId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Ano letivo não encontrado nesta instituição.',
    );
  }
}

async function assertUniqueClassName(
  institutionId: string,
  academicYearId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('academic_year_id', academicYearId);

  if (error) {
    throw error;
  }

  const duplicate = (data ?? []).find(
    (classRecord) =>
      classRecord.id !== exceptId &&
      normalizeName(String(classRecord.name)) ===
        normalizeName(name),
  );

  if (duplicate) {
    throw new Error(
      'Já existe uma turma com este nome no ano letivo selecionado.',
    );
  }
}

function normalizeClass(
  row: ClassQueryRow,
  activeEnrollmentsCount: number,
  activeOfferingsCount: number,
  activeCurriculumItemsCount: number,
): ClassRow {
  const academicYear = normalizeRelation(
    row.academic_years,
  );

  return {
    id: row.id,
    institution_id: row.institution_id,
    academic_year_id: row.academic_year_id,
    academic_year_name:
      academicYear?.name ?? null,
    name: row.name,
    grade_level: row.grade_level,
    shift: row.shift,
    capacity: row.capacity ?? 0,
    active: row.active ?? false,
    active_enrollments_count:
      activeEnrollmentsCount,
    active_offerings_count:
      activeOfferingsCount,
    active_curriculum_items_count:
      activeCurriculumItemsCount,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export const classService = {
  async list(
    institutionId: string,
  ): Promise<ClassRow[]> {
    const { data: classData, error } =
      await supabase
        .from('classes')
        .select(
          `
          id,
          institution_id,
          academic_year_id,
          name,
          grade_level,
          shift,
          capacity,
          active,
          created_at,
          updated_at,
          academic_years:academic_year_id (
            name
          )
        `,
        )
        .eq('institution_id', institutionId)
        .order('name', {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    const classRows =
      (classData ?? []) as unknown as ClassQueryRow[];

    const classIds = classRows.map(
      (classRecord) => classRecord.id,
    );

    const activeEnrollmentsByClass =
      new Map<string, number>();

    const activeOfferingsByClass =
      new Map<string, number>();

    const activeCurriculumItemsByClass =
      new Map<string, number>();

    if (classIds.length > 0) {
      const [
        enrollmentsResult,
        offeringsResult,
        curriculumResult,
      ] = await Promise.all([
        supabase
          .from('enrollments')
          .select('class_id, active')
          .in('class_id', classIds),

        supabase
          .from('subject_offerings')
          .select('class_id, active')
          .in('class_id', classIds),

        supabase
          .from('class_curriculum_items')
          .select('class_id, active')
          .in('class_id', classIds),
      ]);

      if (enrollmentsResult.error) {
        throw enrollmentsResult.error;
      }

      if (offeringsResult.error) {
        throw offeringsResult.error;
      }

      if (curriculumResult.error) {
        throw curriculumResult.error;
      }

      for (const enrollment of (enrollmentsResult.data ??
        []) as EnrollmentCountRow[]) {
        if (enrollment.active === false) {
          continue;
        }

        activeEnrollmentsByClass.set(
          enrollment.class_id,
          (activeEnrollmentsByClass.get(
            enrollment.class_id,
          ) ?? 0) + 1,
        );
      }

      for (const offering of (offeringsResult.data ??
        []) as OfferingCountRow[]) {
        if (offering.active === false) {
          continue;
        }

        activeOfferingsByClass.set(
          offering.class_id,
          (activeOfferingsByClass.get(
            offering.class_id,
          ) ?? 0) + 1,
        );
      }

      for (const item of (curriculumResult.data ??
        []) as CurriculumCountRow[]) {
        if (item.active === false) {
          continue;
        }

        activeCurriculumItemsByClass.set(
          item.class_id,
          (activeCurriculumItemsByClass.get(
            item.class_id,
          ) ?? 0) + 1,
        );
      }
    }

    return classRows.map((classRecord) =>
      normalizeClass(
        classRecord,
        activeEnrollmentsByClass.get(
          classRecord.id,
        ) ?? 0,
        activeOfferingsByClass.get(
          classRecord.id,
        ) ?? 0,
        activeCurriculumItemsByClass.get(
          classRecord.id,
        ) ?? 0,
      ),
    );
  },

  async create(
    input: ClassFormData,
  ): Promise<ClassRow> {
    const data = classSchema.parse(input);

    await assertAcademicYearBelongsToInstitution(
      data.academic_year_id,
      data.institution_id,
    );

    await assertUniqueClassName(
      data.institution_id,
      data.academic_year_id,
      data.name,
    );

    const { data: created, error } = await supabase
      .from('classes')
      .insert({
        ...data,
        grade_level: data.grade_level ?? null,
        shift: data.shift ?? null,
      })
      .select(
        `
        id,
        institution_id,
        academic_year_id,
        name,
        grade_level,
        shift,
        capacity,
        active,
        created_at,
        updated_at,
        academic_years:academic_year_id (
          name
        )
      `,
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeClass(
      created as unknown as ClassQueryRow,
      0,
      0,
      0,
    );
  },

  async update(
    id: string,
    institutionId: string,
    input: ClassUpdateData,
  ): Promise<void> {
    const data = classUpdateSchema.parse(input);

    await assertAcademicYearBelongsToInstitution(
      data.academic_year_id,
      institutionId,
    );

    await assertUniqueClassName(
      institutionId,
      data.academic_year_id,
      data.name,
      id,
    );

    const { error } = await supabase
      .from('classes')
      .update({
        ...data,
        grade_level: data.grade_level ?? null,
        shift: data.shift ?? null,
      })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('classes')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },

  async getDeletionImpact(
    classId: string,
    institutionId: string,
  ): Promise<ClassDeletionImpact> {
    const [enrollmentsResult, offeringsResult, curriculumResult, timetableVersionEntriesResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId),
      supabase
        .from('subject_offerings')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId),
      supabase
        .from('class_curriculum_items')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('institution_id', institutionId),
      supabase
        .from('timetable_version_entries')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('institution_id', institutionId),
    ]);

    const error = enrollmentsResult.error ??
      offeringsResult.error ??
      curriculumResult.error ??
      timetableVersionEntriesResult.error;

    if (error) {
      throw error;
    }

    const impact: ClassDeletionImpact = {
      enrollmentCount: enrollmentsResult.count ?? 0,
      offeringCount: offeringsResult.count ?? 0,
      curriculumItemCount: curriculumResult.count ?? 0,
      timetableVersionEntryCount: timetableVersionEntriesResult.count ?? 0,
      totalLinkedRecords: 0,
    };

    impact.totalLinkedRecords = impact.enrollmentCount +
      impact.offeringCount +
      impact.curriculumItemCount +
      impact.timetableVersionEntryCount;

    return impact;
  },

  async delete(
    classId: string,
    institutionId: string,
  ): Promise<void> {
    const impact = await this.getDeletionImpact(classId, institutionId);
    const blockedMessage = buildClassDeletionBlockedMessage(impact);

    if (blockedMessage) {
      throw new Error(blockedMessage);
    }

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId)
      .eq('institution_id', institutionId);

    if (error) {
      if (error.code === '23503') {
        throw new Error(
          'Esta turma possui dados vinculados. Desative-a para preservar o histórico.',
        );
      }

      throw error;
    }
  },
};
