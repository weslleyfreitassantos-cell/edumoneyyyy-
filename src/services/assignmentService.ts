import { supabase } from '../lib/supabaseClient';

import {
  subjectOfferingSchema,
  subjectOfferingUpdateSchema,
  type SubjectOfferingFormData,
  type SubjectOfferingUpdateData,
} from '../schemas/adminSchemas';

interface ClassRelation {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  active: boolean | null;
}

interface SubjectRelation {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  active: boolean | null;
}

interface TeacherProfileRelation {
  full_name: string;
  email: string;
  active: boolean | null;
}

interface TermRelation {
  id: string;
  academic_year_id: string;
  name: string;
  active: boolean | null;
}

interface OfferingQueryRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  classes:
    | ClassRelation
    | ClassRelation[]
    | null;
  subjects:
    | SubjectRelation
    | SubjectRelation[]
    | null;
  profiles:
    | TeacherProfileRelation
    | TeacherProfileRelation[]
    | null;
  terms:
    | TermRelation
    | TermRelation[]
    | null;
}

interface ClassLookupRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  active: boolean | null;
}

interface SubjectLookupRow {
  id: string;
  institution_id: string;
  active: boolean | null;
}

interface TermLookupRow {
  id: string;
  academic_year_id: string;
  active: boolean | null;
  academic_years:
    | {
        institution_id: string;
        active: boolean | null;
      }
    | {
        institution_id: string;
        active: boolean | null;
      }[]
    | null;
}

interface OfferingLookupRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean | null;
  classes:
    | {
        institution_id: string;
        academic_year_id: string;
      }
    | {
        institution_id: string;
        academic_year_id: string;
      }[]
    | null;
  subjects:
    | { institution_id: string }
    | { institution_id: string }[]
    | null;
  terms:
    | { academic_year_id: string }
    | { academic_year_id: string }[]
    | null;
}

interface DuplicateOfferingRow {
  id: string;
}

export interface AssignmentRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  class_name: string;
  class_grade_level: string | null;
  class_shift: string | null;
  subject_name: string;
  subject_code: string | null;
  teacher_name: string;
  teacher_email: string;
  term_name: string;
  academic_year_id: string;
}

const offeringSelect = `
  id,
  class_id,
  subject_id,
  teacher_profile_id,
  term_id,
  active,
  created_at,
  updated_at,
  classes:class_id (
    id,
    institution_id,
    academic_year_id,
    name,
    grade_level,
    shift,
    active
  ),
  subjects:subject_id (
    id,
    institution_id,
    name,
    code,
    active
  ),
  profiles:teacher_profile_id (
    full_name,
    email,
    active
  ),
  terms:term_id (
    id,
    academic_year_id,
    name,
    active
  )
`;

const OFFERINGS_PAGE_SIZE = 1000;

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function isActive(
  value: boolean | null | undefined,
): boolean {
  return value !== false;
}

function normalizeOffering(
  row: OfferingQueryRow,
  institutionId: string,
): AssignmentRow | null {
  const classRecord = normalizeRelation(
    row.classes,
  );
  const subject = normalizeRelation(
    row.subjects,
  );
  const teacher = normalizeRelation(
    row.profiles,
  );
  const term = normalizeRelation(row.terms);

  if (
    !classRecord ||
    !subject ||
    !teacher ||
    !term ||
    classRecord.institution_id !==
      institutionId ||
    subject.institution_id !== institutionId ||
    term.academic_year_id !==
      classRecord.academic_year_id
  ) {
    return null;
  }

  return {
    id: row.id,
    class_id: row.class_id,
    subject_id: row.subject_id,
    teacher_profile_id:
      row.teacher_profile_id,
    term_id: row.term_id,
    active: isActive(row.active),
    created_at:
      row.created_at ?? undefined,
    updated_at:
      row.updated_at ?? undefined,
    class_name: classRecord.name,
    class_grade_level:
      classRecord.grade_level,
    class_shift: classRecord.shift,
    subject_name: subject.name,
    subject_code: subject.code,
    teacher_name: teacher.full_name,
    teacher_email: teacher.email,
    term_name: term.name,
    academic_year_id:
      classRecord.academic_year_id,
  };
}

async function getClassForInstitution(
  classId: string,
  institutionId: string,
): Promise<ClassLookupRow> {
  const { data, error } = await supabase
    .from('classes')
    .select(
      'id, institution_id, academic_year_id, active',
    )
    .eq('id', classId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Turma não encontrada nesta instituição.',
    );
  }

  const classRecord =
    data as ClassLookupRow;

  if (!isActive(classRecord.active)) {
    throw new Error(
      'A turma selecionada está inativa.',
    );
  }

  return classRecord;
}

async function getSubjectForInstitution(
  subjectId: string,
  institutionId: string,
): Promise<SubjectLookupRow> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, institution_id, active')
    .eq('id', subjectId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Disciplina não encontrada nesta instituição.',
    );
  }

  const subject = data as SubjectLookupRow;

  if (!isActive(subject.active)) {
    throw new Error(
      'A disciplina selecionada está inativa.',
    );
  }

  return subject;
}

async function getTermForInstitution(
  termId: string,
  institutionId: string,
): Promise<TermLookupRow> {
  const { data, error } = await supabase
    .from('terms')
    .select(
      `
      id,
      academic_year_id,
      active,
      academic_years:academic_year_id (
        institution_id,
        active
      )
    `,
    )
    .eq('id', termId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Período não encontrado.',
    );
  }

  const term =
    data as unknown as TermLookupRow;

  const academicYear = normalizeRelation(
    term.academic_years,
  );

  if (
    !academicYear ||
    academicYear.institution_id !==
      institutionId
  ) {
    throw new Error(
      'Período não encontrado nesta instituição.',
    );
  }

  if (
    !isActive(term.active) ||
    !isActive(academicYear.active)
  ) {
    throw new Error(
      'O período selecionado está inativo.',
    );
  }

  return term;
}

async function assertTeacherForInstitution(
  teacherProfileId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      `
      id,
      active,
      profiles:profile_id (
        active
      )
    `,
    )
    .eq('profile_id', teacherProfileId)
    .eq('institution_id', institutionId)
    .eq('role', 'TEACHER')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.active === false) {
    throw new Error(
      'Professor não encontrado ou inativo nesta instituição.',
    );
  }

  const profile = normalizeRelation(
    (
      data as unknown as {
        profiles:
          | { active: boolean | null }
          | { active: boolean | null }[]
          | null;
      }
    ).profiles,
  );

  if (!isActive(profile?.active)) {
    throw new Error(
      'O perfil do professor está inativo.',
    );
  }
}

async function assertTeacherSubjectAuthorized(
  teacherProfileId: string,
  subjectId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('teacher_profile_id', teacherProfileId)
    .eq('subject_id', subjectId)
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('TEACHER_SUBJECT_NOT_AUTHORIZED');
  }
}

async function assertNoDuplicateActiveOffering(
  input: {
    class_id: string;
    subject_id: string;
    term_id: string;
  },
  exceptId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('subject_offerings')
    .select('id')
    .eq('class_id', input.class_id)
    .eq('subject_id', input.subject_id)
    .eq('term_id', input.term_id)
    .eq('active', true);

  if (error) {
    throw error;
  }

  const duplicate = (
    (data ?? []) as DuplicateOfferingRow[]
  ).find((row) => row.id !== exceptId);

  if (duplicate) {
    throw new Error(
      'Já existe uma atribuição ativa para esta turma, disciplina e período.',
    );
  }
}

async function getOfferingForInstitution(
  offeringId: string,
  institutionId: string,
): Promise<OfferingLookupRow> {
  const { data, error } = await supabase
    .from('subject_offerings')
    .select(
      `
      id,
      class_id,
      subject_id,
      teacher_profile_id,
      term_id,
      active,
      classes:class_id (
        institution_id,
        academic_year_id
      ),
      subjects:subject_id (
        institution_id
      ),
      terms:term_id (
        academic_year_id
      )
    `,
    )
    .eq('id', offeringId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Atribuição não encontrada.',
    );
  }

  const row =
    data as unknown as OfferingLookupRow;

  const classRecord = normalizeRelation(
    row.classes,
  );
  const subject = normalizeRelation(
    row.subjects,
  );
  const term = normalizeRelation(row.terms);

  if (
    !classRecord ||
    !subject ||
    !term ||
    classRecord.institution_id !==
      institutionId ||
    subject.institution_id !==
      institutionId ||
    term.academic_year_id !==
      classRecord.academic_year_id
  ) {
    throw new Error(
      'Atribuição não encontrada nesta instituição.',
    );
  }

  return row;
}

async function validateOfferingInput(
  institutionId: string,
  input: SubjectOfferingUpdateData,
  exceptId?: string,
): Promise<void> {
  const [
    classRecord,
    _subject,
    term,
  ] = await Promise.all([
    getClassForInstitution(
      input.class_id,
      institutionId,
    ),
    getSubjectForInstitution(
      input.subject_id,
      institutionId,
    ),
    getTermForInstitution(
      input.term_id,
      institutionId,
    ),
    assertTeacherForInstitution(
      input.teacher_profile_id,
      institutionId,
    ),
    assertTeacherSubjectAuthorized(
      input.teacher_profile_id,
      input.subject_id,
      institutionId,
    ),
  ]);

  if (
    term.academic_year_id !==
    classRecord.academic_year_id
  ) {
    throw new Error(
      'O período selecionado não pertence ao ano letivo da turma.',
    );
  }

  if (input.active) {
    await assertNoDuplicateActiveOffering(
      input,
      exceptId,
    );
  }
}

export const assignmentService = {
  async list(
    institutionId: string,
  ): Promise<AssignmentRow[]> {
    const rows: OfferingQueryRow[] = [];

    for (
      let offset = 0;
      ;
      offset += OFFERINGS_PAGE_SIZE
    ) {
      const { data, error } = await supabase
        .from('subject_offerings')
        .select(offeringSelect)
        .order('created_at', {
          ascending: false,
        })
        .range(
          offset,
          offset + OFFERINGS_PAGE_SIZE - 1,
        );

      if (error) {
        throw error;
      }

      rows.push(
        ...((data ?? []) as unknown as OfferingQueryRow[]),
      );

      if (!data || data.length < OFFERINGS_PAGE_SIZE) {
        break;
      }
    }

    return rows
      .map((row) =>
        normalizeOffering(row, institutionId),
      )
      .filter(
        (
          offering,
        ): offering is AssignmentRow =>
          offering !== null,
      )
      .sort((first, second) => {
        const classComparison =
          first.class_name.localeCompare(
            second.class_name,
            'pt-BR',
          );

        if (classComparison !== 0) {
          return classComparison;
        }

        return first.subject_name.localeCompare(
          second.subject_name,
          'pt-BR',
        );
      });
  },

  async create(
    input: SubjectOfferingFormData,
  ): Promise<void> {
    const data =
      subjectOfferingSchema.parse(input);

    await validateOfferingInput(
      data.institution_id,
      {
        class_id: data.class_id,
        subject_id: data.subject_id,
        teacher_profile_id:
          data.teacher_profile_id,
        term_id: data.term_id,
        active: data.active,
      },
    );

    const { error } = await supabase
      .from('subject_offerings')
      .insert({
        class_id: data.class_id,
        subject_id: data.subject_id,
        teacher_profile_id:
          data.teacher_profile_id,
        term_id: data.term_id,
        active: data.active,
      });

    if (error) {
      throw error;
    }
  },

  async update(
    id: string,
    institutionId: string,
    input: SubjectOfferingUpdateData,
  ): Promise<void> {
    await getOfferingForInstitution(
      id,
      institutionId,
    );

    const data =
      subjectOfferingUpdateSchema.parse(input);

    await validateOfferingInput(
      institutionId,
      data,
      id,
    );

    const { error } = await supabase
      .from('subject_offerings')
      .update(data)
      .eq('id', id);

    if (error) {
      throw error;
    }
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const current =
      await getOfferingForInstitution(
        id,
        institutionId,
      );

    if (active) {
      await validateOfferingInput(
        institutionId,
        {
          class_id: current.class_id,
          subject_id: current.subject_id,
          teacher_profile_id:
            current.teacher_profile_id,
          term_id: current.term_id,
          active,
        },
        id,
      );
    }

    const { error } = await supabase
      .from('subject_offerings')
      .update({ active })
      .eq('id', id);

    if (error) {
      throw error;
    }
  },
};
