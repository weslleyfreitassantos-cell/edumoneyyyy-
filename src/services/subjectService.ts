import { supabase } from '../lib/supabaseClient';

import {
  subjectSchema,
  subjectUpdateSchema,
  type SubjectFormData,
  type SubjectUpdateData,
} from '../schemas/adminSchemas';

interface SubjectQueryRow {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OfferingCountRow {
  subject_id: string;
  active: boolean | null;
}

export interface SubjectRow {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean;
  active_offerings_count: number;
  created_at?: string;
  updated_at?: string;
}

function normalizeCode(
  value: string | undefined,
): string | null {
  return value?.trim()
    ? value.trim().toUpperCase()
    : null;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

async function assertUniqueSubjectCode(
  institutionId: string,
  code: string | undefined,
  exceptId?: string,
): Promise<void> {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return;
  }

  const { data, error } = await supabase
    .from('subjects')
    .select('id, code')
    .eq('institution_id', institutionId);

  if (error) {
    throw error;
  }

  const duplicate = (data ?? []).find(
    (subject) =>
      subject.id !== exceptId &&
      normalizeCode(
        subject.code ?? undefined,
      ) === normalizedCode,
  );

  if (duplicate) {
    throw new Error(
      'Já existe uma disciplina com este código nesta instituição.',
    );
  }
}

async function assertUniqueSubjectName(
  institutionId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('institution_id', institutionId);

  if (error) {
    throw error;
  }

  const duplicate = (data ?? []).find(
    (subject) =>
      subject.id !== exceptId &&
      normalizeName(String(subject.name)) ===
        normalizeName(name),
  );

  if (duplicate) {
    throw new Error(
      'Já existe uma disciplina com este nome nesta instituição.',
    );
  }
}

function normalizeSubject(
  row: SubjectQueryRow,
  activeOfferingsCount: number,
): SubjectRow {
  return {
    id: row.id,
    institution_id: row.institution_id,
    name: row.name,
    code: row.code,
    workload: row.workload,
    active: row.active ?? false,
    active_offerings_count:
      activeOfferingsCount,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export const subjectService = {
  async list(
    institutionId: string,
  ): Promise<SubjectRow[]> {
    const { data: subjectData, error } =
      await supabase
        .from('subjects')
        .select(
          'id, institution_id, name, code, workload, active, created_at, updated_at',
        )
        .eq('institution_id', institutionId)
        .order('name', {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    const subjects =
      (subjectData ?? []) as SubjectQueryRow[];

    const subjectIds = subjects.map(
      (subject) => subject.id,
    );

    const offeringsBySubject =
      new Map<string, number>();

    if (subjectIds.length > 0) {
      const { data, error: offeringError } =
        await supabase
          .from('subject_offerings')
          .select('subject_id, active')
          .in('subject_id', subjectIds);

      if (offeringError) {
        throw offeringError;
      }

      for (const offering of (data ??
        []) as OfferingCountRow[]) {
        if (offering.active === false) {
          continue;
        }

        offeringsBySubject.set(
          offering.subject_id,
          (offeringsBySubject.get(
            offering.subject_id,
          ) ?? 0) + 1,
        );
      }
    }

    return subjects.map((subject) =>
      normalizeSubject(
        subject,
        offeringsBySubject.get(subject.id) ?? 0,
      ),
    );
  },

  async create(
    input: SubjectFormData,
  ): Promise<SubjectRow> {
    const data = subjectSchema.parse(input);

    await assertUniqueSubjectName(
      data.institution_id,
      data.name,
    );

    await assertUniqueSubjectCode(
      data.institution_id,
      data.code,
    );

    const { data: created, error } = await supabase
      .from('subjects')
      .insert({
        institution_id: data.institution_id,
        name: data.name,
        code: normalizeCode(data.code),
        workload: data.workload ?? null,
        active: data.active,
      })
      .select(
        'id, institution_id, name, code, workload, active, created_at, updated_at',
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeSubject(
      created as SubjectQueryRow,
      0,
    );
  },

  async update(
    id: string,
    institutionId: string,
    input: SubjectUpdateData,
  ): Promise<void> {
    const data = subjectUpdateSchema.parse(input);

    await assertUniqueSubjectName(
      institutionId,
      data.name,
      id,
    );

    await assertUniqueSubjectCode(
      institutionId,
      data.code,
      id,
    );

    const { error } = await supabase
      .from('subjects')
      .update({
        name: data.name,
        code: normalizeCode(data.code),
        workload: data.workload ?? null,
        active: data.active,
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
      .from('subjects')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },
};
