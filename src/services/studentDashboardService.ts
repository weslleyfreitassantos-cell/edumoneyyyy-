import { supabase } from '../lib/supabaseClient';

interface ProfileRelation {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface StudentDashboardQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string | null;
  active: boolean | null;
  created_at: string | null;
  profiles:
    | ProfileRelation
    | ProfileRelation[]
    | null;
}

interface ClassRelation {
  id: string;
  institution_id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
  active: boolean | null;
}

interface AcademicYearRelation {
  id: string;
  institution_id: string;
  name: string;
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
  classes:
    | ClassRelation
    | ClassRelation[]
    | null;
  academic_years:
    | AcademicYearRelation
    | AcademicYearRelation[]
    | null;
}

interface SubjectRelation {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  workload: number | null;
  active: boolean | null;
}

interface TeacherRelation {
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
  subjects:
    | SubjectRelation
    | SubjectRelation[]
    | null;
  profiles:
    | TeacherRelation
    | TeacherRelation[]
    | null;
  terms:
    | TermRelation
    | TermRelation[]
    | null;
}

export interface StudentDashboardRecord {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string | null;
  active: boolean;
  created_at?: string;
  profile: ProfileRelation | null;
}

export interface StudentDashboardEnrollment {
  id: string;
  class_id: string;
  academic_year_id: string;
  status: string;
  enrolled_at: string | null;
  class_name: string;
  grade_level: string | null;
  shift: string | null;
  academic_year_name: string;
}

export interface StudentDashboardOffering {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  workload: number | null;
  teacher_profile_id: string;
  teacher_name: string;
  teacher_email: string;
  term_id: string;
  term_name: string;
}

export interface StudentDashboardData {
  student: StudentDashboardRecord;
  activeEnrollment: StudentDashboardEnrollment | null;
  offerings: StudentDashboardOffering[];
}

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

function normalizeStudent(
  row: StudentDashboardQueryRow,
): StudentDashboardRecord {
  return {
    id: row.id,
    profile_id: row.profile_id,
    institution_id: row.institution_id,
    registration_number:
      row.registration_number,
    birth_date: row.birth_date,
    active: isActive(row.active),
    created_at:
      row.created_at ?? undefined,
    profile: normalizeRelation(row.profiles),
  };
}

function normalizeEnrollment(
  row: EnrollmentQueryRow,
  institutionId: string,
): StudentDashboardEnrollment | null {
  const classRecord = normalizeRelation(
    row.classes,
  );
  const academicYear = normalizeRelation(
    row.academic_years,
  );

  if (
    !classRecord ||
    !academicYear ||
    classRecord.institution_id !==
      institutionId ||
    academicYear.institution_id !==
      institutionId
  ) {
    return null;
  }

  return {
    id: row.id,
    class_id: row.class_id,
    academic_year_id: row.academic_year_id,
    status:
      row.status?.trim().toUpperCase() ??
      'ACTIVE',
    enrolled_at: row.enrolled_at,
    class_name: classRecord.name,
    grade_level: classRecord.grade_level,
    shift: classRecord.shift,
    academic_year_name:
      academicYear.name,
  };
}

function normalizeOffering(
  row: OfferingQueryRow,
  institutionId: string,
  academicYearId: string,
): StudentDashboardOffering | null {
  const subject = normalizeRelation(
    row.subjects,
  );
  const teacher = normalizeRelation(
    row.profiles,
  );
  const term = normalizeRelation(row.terms);

  if (
    !subject ||
    !teacher ||
    !term ||
    subject.institution_id !== institutionId ||
    term.academic_year_id !== academicYearId ||
    !isActive(subject.active) ||
    !isActive(teacher.active) ||
    !isActive(term.active)
  ) {
    return null;
  }

  return {
    id: row.id,
    subject_id: row.subject_id,
    subject_name: subject.name,
    subject_code: subject.code,
    workload: subject.workload,
    teacher_profile_id:
      row.teacher_profile_id,
    teacher_name: teacher.full_name,
    teacher_email: teacher.email,
    term_id: row.term_id,
    term_name: term.name,
  };
}

async function getStudentByProfile(
  profileId: string,
  institutionId: string,
): Promise<StudentDashboardRecord> {
  const { data, error } = await supabase
    .from('students')
    .select(
      `
      id,
      profile_id,
      institution_id,
      registration_number,
      birth_date,
      active,
      created_at,
      profiles:profile_id (
        full_name,
        email,
        avatar_url
      )
    `,
    )
    .eq('profile_id', profileId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'O registro acadêmico deste aluno não foi encontrado.',
    );
  }

  return normalizeStudent(
    data as unknown as StudentDashboardQueryRow,
  );
}

async function getStudentById(
  studentId: string,
  institutionId: string,
): Promise<StudentDashboardRecord> {
  const { data, error } = await supabase
    .from('students')
    .select(
      `
      id,
      profile_id,
      institution_id,
      registration_number,
      birth_date,
      active,
      created_at,
      profiles:profile_id (
        full_name,
        email,
        avatar_url
      )
    `,
    )
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

  return normalizeStudent(
    data as unknown as StudentDashboardQueryRow,
  );
}

async function getActiveEnrollment(
  studentId: string,
  institutionId: string,
): Promise<StudentDashboardEnrollment | null> {
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
      enrolled_at,
      classes:class_id (
        id,
        institution_id,
        academic_year_id,
        name,
        grade_level,
        shift,
        active
      ),
      academic_years:academic_year_id (
        id,
        institution_id,
        name,
        active
      )
    `,
    )
    .eq('student_id', studentId)
    .eq('active', true)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const rows =
    (data ?? []) as unknown as EnrollmentQueryRow[];

  for (const row of rows) {
    const enrollment = normalizeEnrollment(
      row,
      institutionId,
    );

    if (enrollment) {
      return enrollment;
    }
  }

  return null;
}

async function getOfferings(
  enrollment: StudentDashboardEnrollment | null,
  institutionId: string,
): Promise<StudentDashboardOffering[]> {
  if (!enrollment) {
    return [];
  }

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
      subjects:subject_id (
        id,
        institution_id,
        name,
        code,
        workload,
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
    `,
    )
    .eq('class_id', enrollment.class_id)
    .eq('active', true);

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as unknown as OfferingQueryRow[]
  )
    .map((row) =>
      normalizeOffering(
        row,
        institutionId,
        enrollment.academic_year_id,
      ),
    )
    .filter(
      (
        offering,
      ): offering is StudentDashboardOffering =>
        offering !== null,
    )
    .sort((first, second) =>
      first.subject_name.localeCompare(
        second.subject_name,
        'pt-BR',
      ),
    );
}

async function getDashboardForStudent(
  student: StudentDashboardRecord,
): Promise<StudentDashboardData> {
  const activeEnrollment =
    await getActiveEnrollment(
      student.id,
      student.institution_id,
    );

  const offerings = await getOfferings(
    activeEnrollment,
    student.institution_id,
  );

  return {
    student,
    activeEnrollment,
    offerings,
  };
}

export const studentDashboardService = {
  async getDashboard(
    profileId: string,
    institutionId: string,
  ): Promise<StudentDashboardData> {
    const student = await getStudentByProfile(
      profileId,
      institutionId,
    );

    return getDashboardForStudent(student);
  },

  async getDashboardByStudentId(
    studentId: string,
    institutionId: string,
  ): Promise<StudentDashboardData> {
    const student = await getStudentById(
      studentId,
      institutionId,
    );

    return getDashboardForStudent(student);
  },
};
