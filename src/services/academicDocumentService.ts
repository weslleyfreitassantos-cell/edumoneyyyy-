import { supabase } from '../lib/supabaseClient';

import { studentService } from './studentService';

export interface AcademicDocumentStudentOption {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
  cpf: string | null;
  active: boolean;
}

export interface AcademicDocumentEnrollment {
  id: string;
  classId: string;
  className: string;
  academicYearId: string;
  academicYearName: string;
  status: string;
  active: boolean;
  enrolledAt: string | null;
}

export interface AcademicDocumentGuardian {
  profileId: string;
  name: string;
  email: string;
  phone: string | null;
  relationship: string;
  primary: boolean;
}

export interface AcademicDocumentAddress {
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface AcademicDocumentStudent {
  id: string;
  institutionId: string;
  name: string;
  email: string;
  phone: string | null;
  registrationNumber: string;
  birthDate: string | null;
  cpf: string | null;
  active: boolean;
  details: Record<string, string | null>;
  address: AcademicDocumentAddress | null;
  guardians: AcademicDocumentGuardian[];
  enrollments: AcademicDocumentEnrollment[];
  currentEnrollment: AcademicDocumentEnrollment | null;
}

interface Relation<T> {
  data: T | T[] | null;
}

interface StudentDetailRow {
  id: string;
  profile_id: string;
  institution_id: string;
  registration_number: string;
  birth_date: string | null;
  cpf: string | null;
  active: boolean | null;
  profiles: Relation<{
    full_name: string;
    email: string;
    phone: string | null;
  }> | {
    full_name: string;
    email: string;
    phone: string | null;
  } | {
    full_name: string;
    email: string;
    phone: string | null;
  }[] | null;
}

interface EnrollmentDetailRow {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string | null;
  active: boolean | null;
  enrolled_at: string | null;
  created_at: string | null;
  classes:
    | { id: string; institution_id: string; name: string }
    | { id: string; institution_id: string; name: string }[]
    | null;
  academic_years:
    | { id: string; institution_id: string; name: string }
    | { id: string; institution_id: string; name: string }[]
    | null;
}

interface GuardianDetailRow {
  guardian_profile_id: string;
  relationship: string;
  is_primary: boolean | null;
  active: boolean | null;
  profiles:
    | { full_name: string; email: string; phone: string | null; active: boolean | null }
    | { full_name: string; email: string; phone: string | null; active: boolean | null }[]
    | null;
}

function relationOne<T>(
  value: T | T[] | null | undefined,
): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function statusIsActive(status: string | null): boolean {
  return status?.trim().toUpperCase() === 'ACTIVE';
}

export function selectCurrentActiveEnrollment(
  enrollments: readonly AcademicDocumentEnrollment[],
): AcademicDocumentEnrollment | null {
  return enrollments
    .filter((enrollment) => enrollment.active && statusIsActive(enrollment.status))
    .sort((first, second) =>
      (second.enrolledAt ?? '').localeCompare(first.enrolledAt ?? ''),
    )[0] ?? null;
}

function normalizeEnrollment(
  row: EnrollmentDetailRow,
  institutionId: string,
): AcademicDocumentEnrollment | null {
  const classRecord = relationOne(row.classes);
  const academicYear = relationOne(row.academic_years);

  if (
    !classRecord ||
    !academicYear ||
    classRecord.institution_id !== institutionId ||
    academicYear.institution_id !== institutionId
  ) {
    return null;
  }

  return {
    id: row.id,
    classId: row.class_id,
    className: classRecord.name,
    academicYearId: row.academic_year_id,
    academicYearName: academicYear.name,
    status: row.status?.trim().toUpperCase() ?? '',
    active: row.active === true,
    enrolledAt: row.enrolled_at ?? row.created_at,
  };
}

export const academicDocumentService = {
  async listStudents(
    institutionId: string,
  ): Promise<AcademicDocumentStudentOption[]> {
    const students = await studentService.list(institutionId);

    return students
      .map((student) => ({
        id: student.id,
        name: student.profiles?.full_name?.trim() || student.registration_number,
        email: student.profiles?.email ?? '',
        registrationNumber: student.registration_number,
        cpf: student.cpf,
        active: student.active,
      }))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
  },

  async getStudent(
    institutionId: string,
    studentId: string,
  ): Promise<AcademicDocumentStudent> {
    const [studentResult, detailsResult, addressResult, guardiansResult, enrollmentsResult] = await Promise.all([
      supabase
        .from('students')
        .select('id, profile_id, institution_id, registration_number, birth_date, cpf, active, profiles:profile_id(full_name, email, phone)')
        .eq('id', studentId)
        .eq('institution_id', institutionId)
        .maybeSingle(),
      supabase
        .from('student_registration_details')
        .select('social_name, rg, rg_issuing_authority, rg_state, birth_certificate, nationality, birthplace, birth_state, sex')
        .eq('student_id', studentId)
        .eq('institution_id', institutionId)
        .maybeSingle(),
      supabase
        .from('student_addresses')
        .select('postal_code, street, number, complement, neighborhood, city, state')
        .eq('student_id', studentId)
        .eq('institution_id', institutionId)
        .maybeSingle(),
      supabase
        .from('guardianships')
        .select('guardian_profile_id, relationship, is_primary, active, profiles:guardian_profile_id(full_name, email, phone, active)')
        .eq('student_id', studentId)
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('enrollments')
        .select('id, student_id, class_id, academic_year_id, status, active, enrolled_at, created_at, classes:class_id(id, institution_id, name), academic_years:academic_year_id(id, institution_id, name)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
    ]);

    const failed = [
      studentResult,
      detailsResult,
      addressResult,
      guardiansResult,
      enrollmentsResult,
    ].find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    const student = studentResult.data as unknown as StudentDetailRow | null;
    if (!student || student.institution_id !== institutionId) {
      throw new Error('Aluno não encontrado nesta instituição.');
    }

    const profile = relationOne(student.profiles as unknown as {
      full_name: string;
      email: string;
      phone: string | null;
    } | {
      full_name: string;
      email: string;
      phone: string | null;
    }[] | null);
    const enrollments = (enrollmentsResult.data as unknown as EnrollmentDetailRow[] ?? [])
      .map((row) => normalizeEnrollment(row, institutionId))
      .filter((row): row is AcademicDocumentEnrollment => row !== null);
    const guardians = (guardiansResult.data as unknown as GuardianDetailRow[] ?? [])
      .map((row) => {
        const guardian = relationOne(row.profiles);
        if (!guardian || guardian.active === false) return null;

        return {
          profileId: row.guardian_profile_id,
          name: guardian.full_name,
          email: guardian.email,
          phone: guardian.phone ?? null,
          relationship: row.relationship,
          primary: row.is_primary === true,
        } satisfies AcademicDocumentGuardian;
      })
      .filter((row): row is AcademicDocumentGuardian => row !== null);
    const details = (detailsResult.data ?? {}) as Record<string, unknown>;
    const addressRow = addressResult.data as {
      postal_code: string | null;
      street: string | null;
      number: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
    } | null;

    return {
      id: student.id,
      institutionId: student.institution_id,
      name: profile?.full_name ?? student.registration_number,
      email: profile?.email ?? '',
      phone: profile?.phone ?? null,
      registrationNumber: student.registration_number,
      birthDate: student.birth_date ?? null,
      cpf: student.cpf ?? null,
      active: student.active === true,
      details: Object.fromEntries(
        Object.entries(details).map(([key, value]) => [key, textOrNull(value)]),
      ),
      address: addressRow
        ? {
            postalCode: addressRow.postal_code ?? null,
            street: addressRow.street ?? null,
            number: addressRow.number ?? null,
            complement: addressRow.complement ?? null,
            neighborhood: addressRow.neighborhood ?? null,
            city: addressRow.city ?? null,
            state: addressRow.state ?? null,
          }
        : null,
      guardians,
      enrollments,
      currentEnrollment: selectCurrentActiveEnrollment(enrollments),
    };
  },
};
