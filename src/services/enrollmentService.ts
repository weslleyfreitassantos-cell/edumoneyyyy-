import { supabase } from '../lib/supabaseClient';

import {
  enrollmentSchema,
  enrollmentStatusUpdateSchema,
  enrollmentTransferSchema,
  type EnrollmentFormData,
  type EnrollmentStatusUpdateData,
  type EnrollmentTransferData,
} from '../schemas/adminSchemas';

interface ProfileRelation {
  full_name: string;
  email: string;
}

interface StudentRelation {
  id: string;
  institution_id: string;
  registration_number: string;
  active: boolean | null;
  profiles:
    | ProfileRelation
    | ProfileRelation[]
    | null;
}

interface AcademicYearRelation {
  id: string;
  institution_id: string;
  name: string;
  active: boolean | null;
}

interface ClassRelation {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  capacity: number | null;
  active: boolean | null;
}

interface EnrollmentQueryRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
  enrolled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  students:
    | StudentRelation
    | StudentRelation[]
    | null;
  classes:
    | ClassRelation
    | ClassRelation[]
    | null;
  academic_years:
    | AcademicYearRelation
    | AcademicYearRelation[]
    | null;
}

interface EnrollmentLookupRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
  students:
    | { institution_id: string; active: boolean | null }
    | { institution_id: string; active: boolean | null }[]
    | null;
  classes:
    | {
        institution_id: string;
        academic_year_id: string;
        capacity: number | null;
        active: boolean | null;
      }
    | {
        institution_id: string;
        academic_year_id: string;
        capacity: number | null;
        active: boolean | null;
      }[]
    | null;
}

interface ClassLookupRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  capacity: number | null;
  active: boolean | null;
  academic_years:
    | { active: boolean | null }
    | { active: boolean | null }[]
    | null;
}

interface DuplicateEnrollmentRow {
  id: string;
  class_id: string;
}

export type EnrollmentStatus =
  | 'ACTIVE'
  | 'TRANSFERRED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface EnrollmentRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: EnrollmentStatus;
  status_label: string;
  active: boolean;
  enrolled_at?: string;
  created_at?: string;
  updated_at?: string;
  student_name: string;
  student_registration_number: string;
  student_active: boolean;
  class_name: string;
  class_grade_level: string | null;
  class_shift: string | null;
  class_capacity: number | null;
  class_active: boolean;
  academic_year_name: string;
  active_enrollments_in_class: number;
  has_capacity_available: boolean;
}

const enrollmentSelect = `
  id,
  student_id,
  class_id,
  academic_year_id,
  status,
  active,
  enrolled_at,
  created_at,
  updated_at,
  students:student_id (
    id,
    institution_id,
    registration_number,
    active,
    profiles:profile_id (
      full_name,
      email
    )
  ),
  classes:class_id (
    id,
    institution_id,
    academic_year_id,
    name,
    grade_level,
    shift,
    capacity,
    active
  ),
  academic_years:academic_year_id (
    id,
    institution_id,
    name,
    active
  )
`;

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

function normalizeStatus(
  status: string | null,
  active: boolean | null,
): EnrollmentStatus {
  const normalized =
    status?.trim().toUpperCase();

  if (
    normalized === 'TRANSFERRED' ||
    normalized === 'CANCELLED' ||
    normalized === 'COMPLETED'
  ) {
    return normalized;
  }

  if (normalized === 'ACTIVE') {
    return 'ACTIVE';
  }

  return isActive(active)
    ? 'ACTIVE'
    : 'CANCELLED';
}

function getStatusLabel(
  status: EnrollmentStatus,
): string {
  const labels: Record<
    EnrollmentStatus,
    string
  > = {
    ACTIVE: 'Ativa',
    TRANSFERRED: 'Transferida',
    CANCELLED: 'Cancelada',
    COMPLETED: 'Concluída',
  };

  return labels[status];
}

function assertInstitutionEnrollment(
  row: EnrollmentQueryRow,
  institutionId: string,
): {
  student: StudentRelation;
  classRecord: ClassRelation;
  academicYear: AcademicYearRelation;
} | null {
  const student = normalizeRelation(row.students);
  const classRecord = normalizeRelation(
    row.classes,
  );
  const academicYear = normalizeRelation(
    row.academic_years,
  );

  if (
    !student ||
    !classRecord ||
    !academicYear ||
    student.institution_id !== institutionId ||
    classRecord.institution_id !==
      institutionId ||
    academicYear.institution_id !==
      institutionId
  ) {
    return null;
  }

  return {
    student,
    classRecord,
    academicYear,
  };
}

function normalizeEnrollment(
  row: EnrollmentQueryRow,
  institutionId: string,
  activeEnrollmentsByClass: Map<string, number>,
): EnrollmentRow | null {
  const relations = assertInstitutionEnrollment(
    row,
    institutionId,
  );

  if (!relations) {
    return null;
  }

  const {
    student,
    classRecord,
    academicYear,
  } = relations;

  const profile = normalizeRelation(
    student.profiles,
  );

  const status = normalizeStatus(
    row.status,
    row.active,
  );

  const activeCount =
    activeEnrollmentsByClass.get(
      row.class_id,
    ) ?? 0;

  const capacity =
    classRecord.capacity ?? null;

  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    academic_year_id: row.academic_year_id,
    status,
    status_label: getStatusLabel(status),
    active: isActive(row.active),
    enrolled_at:
      row.enrolled_at ?? undefined,
    created_at:
      row.created_at ?? undefined,
    updated_at:
      row.updated_at ?? undefined,
    student_name:
      profile?.full_name ??
      student.registration_number,
    student_registration_number:
      student.registration_number,
    student_active: isActive(
      student.active,
    ),
    class_name: classRecord.name,
    class_grade_level:
      classRecord.grade_level,
    class_shift: classRecord.shift,
    class_capacity: capacity,
    class_active: isActive(
      classRecord.active,
    ),
    academic_year_name:
      academicYear.name,
    active_enrollments_in_class:
      activeCount,
    has_capacity_available:
      capacity === null ||
      capacity <= 0 ||
      activeCount < capacity,
  };
}

async function getClassForInstitution(
  classId: string,
  institutionId: string,
): Promise<ClassLookupRow> {
  const { data, error } = await supabase
    .from('classes')
    .select(
      `
      id,
      institution_id,
      academic_year_id,
      capacity,
      active,
      academic_years:academic_year_id (
        active
      )
    `,
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
    data as unknown as ClassLookupRow;

  const academicYear = normalizeRelation(
    classRecord.academic_years,
  );

  if (!isActive(classRecord.active)) {
    throw new Error(
      'A turma selecionada está inativa.',
    );
  }

  if (!isActive(academicYear?.active)) {
    throw new Error(
      'O ano letivo da turma selecionada está inativo.',
    );
  }

  return classRecord;
}

async function assertStudentForInstitution(
  studentId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('students')
    .select('id, active')
    .eq('id', studentId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Aluno não encontrado nesta instituição.',
    );
  }

  if (!isActive(data.active)) {
    throw new Error(
      'O aluno selecionado está inativo.',
    );
  }
}

async function assertNoActiveEnrollmentForYear(
  studentId: string,
  academicYearId: string,
  exceptEnrollmentId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, class_id')
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .eq('active', true);

  if (error) {
    throw error;
  }

  const duplicate = (
    (data ?? []) as DuplicateEnrollmentRow[]
  ).find(
    (enrollment) =>
      enrollment.id !== exceptEnrollmentId,
  );

  if (duplicate) {
    throw new Error(
      'Este aluno já possui matrícula ativa neste ano letivo.',
    );
  }
}

async function assertClassCapacityAvailable(
  classId: string,
  capacity: number | null,
  exceptEnrollmentId?: string,
): Promise<void> {
  if (!capacity || capacity <= 0) {
    return;
  }

  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('active', true);

  if (error) {
    throw error;
  }

  const activeCount = (data ?? []).filter(
    (enrollment) =>
      enrollment.id !== exceptEnrollmentId,
  ).length;

  if (activeCount >= capacity) {
    throw new Error(
      'A turma selecionada já atingiu a capacidade máxima.',
    );
  }
}

async function getEnrollmentForInstitution(
  enrollmentId: string,
  institutionId: string,
): Promise<EnrollmentLookupRow> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `
      id,
      student_id,
      class_id,
      academic_year_id,
      status,
      active,
      students:student_id (
        institution_id,
        active
      ),
      classes:class_id (
        institution_id,
        academic_year_id,
        capacity,
        active
      )
    `,
    )
    .eq('id', enrollmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Matrícula não encontrada.',
    );
  }

  const row =
    data as unknown as EnrollmentLookupRow;

  const student = normalizeRelation(
    row.students,
  );
  const classRecord = normalizeRelation(
    row.classes,
  );

  if (
    !student ||
    !classRecord ||
    student.institution_id !== institutionId ||
    classRecord.institution_id !==
      institutionId
  ) {
    throw new Error(
      'Matrícula não encontrada nesta instituição.',
    );
  }

  return row;
}

export const enrollmentService = {
  async list(
    institutionId: string,
  ): Promise<EnrollmentRow[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(enrollmentSelect)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const rows =
      (data ?? []) as unknown as EnrollmentQueryRow[];

    const institutionRows = rows.filter(
      (row) =>
        Boolean(
          assertInstitutionEnrollment(
            row,
            institutionId,
          ),
        ),
    );

    const activeEnrollmentsByClass =
      new Map<string, number>();

    for (const row of institutionRows) {
      if (!isActive(row.active)) {
        continue;
      }

      activeEnrollmentsByClass.set(
        row.class_id,
        (activeEnrollmentsByClass.get(
          row.class_id,
        ) ?? 0) + 1,
      );
    }

    return institutionRows
      .map((row) =>
        normalizeEnrollment(
          row,
          institutionId,
          activeEnrollmentsByClass,
        ),
      )
      .filter(
        (
          enrollment,
        ): enrollment is EnrollmentRow =>
          enrollment !== null,
      )
      .sort((first, second) =>
        first.student_name.localeCompare(
          second.student_name,
          'pt-BR',
        ),
      );
  },

  async create(
    input: EnrollmentFormData,
  ): Promise<void> {
    const data = enrollmentSchema.parse(input);

    await assertStudentForInstitution(
      data.student_id,
      data.institution_id,
    );

    const classRecord =
      await getClassForInstitution(
        data.class_id,
        data.institution_id,
      );

    if (
      classRecord.academic_year_id !==
      data.academic_year_id
    ) {
      throw new Error(
        'A turma selecionada não pertence ao ano letivo informado.',
      );
    }

    await assertNoActiveEnrollmentForYear(
      data.student_id,
      data.academic_year_id,
    );

    await assertClassCapacityAvailable(
      data.class_id,
      classRecord.capacity,
    );

    const { error } = await supabase
      .from('enrollments')
      .insert({
        student_id: data.student_id,
        class_id: data.class_id,
        academic_year_id:
          data.academic_year_id,
        status: data.status,
        active: data.active,
      });

    if (error) {
      throw error;
    }
  },

  async transfer(
    institutionId: string,
    input: EnrollmentTransferData,
  ): Promise<void> {
    const data =
      enrollmentTransferSchema.parse(input);

    const current =
      await getEnrollmentForInstitution(
        data.enrollment_id,
        institutionId,
      );

    if (!isActive(current.active)) {
      throw new Error(
        'Apenas matrículas ativas podem ser transferidas.',
      );
    }

    if (current.class_id === data.target_class_id) {
      throw new Error(
        'Selecione uma turma de destino diferente.',
      );
    }

    const targetClass =
      await getClassForInstitution(
        data.target_class_id,
        institutionId,
      );

    if (
      targetClass.academic_year_id !==
      current.academic_year_id
    ) {
      throw new Error(
        'Transferências precisam permanecer no mesmo ano letivo.',
      );
    }

    await assertNoActiveEnrollmentForYear(
      current.student_id,
      current.academic_year_id,
      current.id,
    );

    await assertClassCapacityAvailable(
      targetClass.id,
      targetClass.capacity,
    );

    const previousState = {
      active: current.active,
      status: current.status,
    };

    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        active: false,
        status: 'TRANSFERRED',
      })
      .eq('id', current.id);

    if (updateError) {
      throw updateError;
    }

    const { error: insertError } = await supabase
      .from('enrollments')
      .insert({
        student_id: current.student_id,
        class_id: targetClass.id,
        academic_year_id:
          current.academic_year_id,
        status: 'ACTIVE',
        active: true,
      });

    if (insertError) {
      await supabase
        .from('enrollments')
        .update(previousState)
        .eq('id', current.id);

      throw insertError;
    }
  },

  async updateStatus(
    enrollmentId: string,
    institutionId: string,
    input: EnrollmentStatusUpdateData,
  ): Promise<void> {
    const data =
      enrollmentStatusUpdateSchema.parse(input);

    const current =
      await getEnrollmentForInstitution(
        enrollmentId,
        institutionId,
      );

    const classRecord = normalizeRelation(
      current.classes,
    );

    if (!classRecord) {
      throw new Error(
        'Turma da matrícula não encontrada.',
      );
    }

    if (data.active) {
      await assertStudentForInstitution(
        current.student_id,
        institutionId,
      );

      if (!isActive(classRecord.active)) {
        throw new Error(
          'A turma da matrícula está inativa.',
        );
      }

      await assertNoActiveEnrollmentForYear(
        current.student_id,
        current.academic_year_id,
        current.id,
      );

      await assertClassCapacityAvailable(
        current.class_id,
        classRecord.capacity,
        current.id,
      );
    }

    const { error } = await supabase
      .from('enrollments')
      .update({
        active: data.active,
        status: data.status,
      })
      .eq('id', current.id);

    if (error) {
      throw error;
    }
  },
};
