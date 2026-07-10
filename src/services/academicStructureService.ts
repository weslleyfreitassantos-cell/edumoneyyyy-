import { supabase } from '../lib/supabaseClient';

import {
  academicYearSchema,
  academicYearUpdateSchema,
  termSchema,
  termUpdateSchema,
  type AcademicYearFormData,
  type AcademicYearUpdateData,
  type TermFormData,
  type TermUpdateData,
} from '../schemas/adminSchemas';

export interface TermRow {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicYearRow {
  id: string;
  institution_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  terms: TermRow[];
}

interface AcademicYearQueryRow {
  id: string;
  institution_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TermQueryRow {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

function normalizeYear(
  row: AcademicYearQueryRow,
  terms: TermRow[],
): AcademicYearRow {
  return {
    id: row.id,
    institution_id: row.institution_id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    active: row.active ?? false,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
    terms,
  };
}

function normalizeTerm(
  row: TermQueryRow,
): TermRow {
  return {
    id: row.id,
    academic_year_id: row.academic_year_id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    active: row.active ?? false,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function assertTermInsideYear(
  year: AcademicYearRow,
  input: {
    start_date: string;
    end_date: string;
  },
): void {
  if (
    input.start_date < year.start_date ||
    input.end_date > year.end_date
  ) {
    throw new Error(
      'O período precisa estar dentro do intervalo do ano letivo.',
    );
  }
}

async function getAcademicYearOrThrow(
  id: string,
  institutionId: string,
): Promise<AcademicYearRow> {
  const { data, error } = await supabase
    .from('academic_years')
    .select(
      'id, institution_id, name, start_date, end_date, active, created_at, updated_at',
    )
    .eq('id', id)
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

  return normalizeYear(
    data as AcademicYearQueryRow,
    [],
  );
}

async function assertUniqueAcademicYearName(
  institutionId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('institution_id', institutionId);

  if (error) {
    throw error;
  }

  const duplicate = (data ?? []).find(
    (year) =>
      year.id !== exceptId &&
      normalizeName(String(year.name)) ===
        normalizeName(name),
  );

  if (duplicate) {
    throw new Error(
      'Já existe um ano letivo com este nome nesta instituição.',
    );
  }
}

async function assertUniqueTermName(
  academicYearId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name')
    .eq('academic_year_id', academicYearId);

  if (error) {
    throw error;
  }

  const duplicate = (data ?? []).find(
    (term) =>
      term.id !== exceptId &&
      normalizeName(String(term.name)) ===
        normalizeName(name),
  );

  if (duplicate) {
    throw new Error(
      'Já existe um período com este nome no ano letivo selecionado.',
    );
  }
}

export const academicStructureService = {
  async listAcademicYears(
    institutionId: string,
  ): Promise<AcademicYearRow[]> {
    const { data: yearData, error: yearError } =
      await supabase
        .from('academic_years')
        .select(
          'id, institution_id, name, start_date, end_date, active, created_at, updated_at',
        )
        .eq('institution_id', institutionId)
        .order('start_date', {
          ascending: false,
        });

    if (yearError) {
      throw yearError;
    }

    const yearRows =
      (yearData ?? []) as AcademicYearQueryRow[];

    const yearIds = yearRows.map((year) => year.id);

    let terms: TermRow[] = [];

    if (yearIds.length > 0) {
      const { data: termData, error: termError } =
        await supabase
          .from('terms')
          .select(
            'id, academic_year_id, name, start_date, end_date, active, created_at, updated_at',
          )
          .in('academic_year_id', yearIds)
          .order('start_date', {
            ascending: true,
          });

      if (termError) {
        throw termError;
      }

      terms = ((termData ?? []) as TermQueryRow[]).map(
        normalizeTerm,
      );
    }

    return yearRows.map((year) =>
      normalizeYear(
        year,
        terms.filter(
          (term) =>
            term.academic_year_id === year.id,
        ),
      ),
    );
  },

  async createAcademicYear(
    input: AcademicYearFormData,
  ): Promise<AcademicYearRow> {
    const data = academicYearSchema.parse(input);

    await assertUniqueAcademicYearName(
      data.institution_id,
      data.name,
    );

    const { data: created, error } = await supabase
      .from('academic_years')
      .insert(data)
      .select(
        'id, institution_id, name, start_date, end_date, active, created_at, updated_at',
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeYear(
      created as AcademicYearQueryRow,
      [],
    );
  },

  async updateAcademicYear(
    id: string,
    institutionId: string,
    input: AcademicYearUpdateData,
  ): Promise<void> {
    const data =
      academicYearUpdateSchema.parse(input);

    await getAcademicYearOrThrow(
      id,
      institutionId,
    );

    await assertUniqueAcademicYearName(
      institutionId,
      data.name,
      id,
    );

    const { error } = await supabase
      .from('academic_years')
      .update(data)
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },

  async setAcademicYearActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('academic_years')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) {
      throw error;
    }
  },

  async createTerm(
    institutionId: string,
    input: TermFormData,
  ): Promise<TermRow> {
    const data = termSchema.parse(input);

    const year = await getAcademicYearOrThrow(
      data.academic_year_id,
      institutionId,
    );

    assertTermInsideYear(year, data);

    await assertUniqueTermName(
      data.academic_year_id,
      data.name,
    );

    const { data: created, error } = await supabase
      .from('terms')
      .insert(data)
      .select(
        'id, academic_year_id, name, start_date, end_date, active, created_at, updated_at',
      )
      .single();

    if (error) {
      throw error;
    }

    return normalizeTerm(
      created as TermQueryRow,
    );
  },

  async updateTerm(
    id: string,
    institutionId: string,
    academicYearId: string,
    input: TermUpdateData,
  ): Promise<void> {
    const data = termUpdateSchema.parse(input);

    const year = await getAcademicYearOrThrow(
      academicYearId,
      institutionId,
    );

    assertTermInsideYear(year, data);

    await assertUniqueTermName(
      academicYearId,
      data.name,
      id,
    );

    const { error } = await supabase
      .from('terms')
      .update(data)
      .eq('id', id)
      .eq('academic_year_id', academicYearId);

    if (error) {
      throw error;
    }
  },

  async setTermActive(
    id: string,
    institutionId: string,
    academicYearId: string,
    active: boolean,
  ): Promise<void> {
    await getAcademicYearOrThrow(
      academicYearId,
      institutionId,
    );

    const { error } = await supabase
      .from('terms')
      .update({ active })
      .eq('id', id)
      .eq('academic_year_id', academicYearId);

    if (error) {
      throw error;
    }
  },
};
