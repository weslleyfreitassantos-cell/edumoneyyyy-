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
  created_at?: string;
  updated_at?: string;
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

    if (classIds.length > 0) {
      const [
        enrollmentsResult,
        offeringsResult,
      ] = await Promise.all([
        supabase
          .from('enrollments')
          .select('class_id, active')
          .in('class_id', classIds),

        supabase
          .from('subject_offerings')
          .select('class_id, active')
          .in('class_id', classIds),
      ]);

      if (enrollmentsResult.error) {
        throw enrollmentsResult.error;
      }

      if (offeringsResult.error) {
        throw offeringsResult.error;
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
};
