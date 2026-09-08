import { supabase } from '../lib/supabaseClient';

export interface RegistrationPendingItem {
  id: string;
  label: string;
  description: string;
}

export interface RegistrationCompletion {
  role: 'STUDENT' | 'GUARDIAN';
  pendingItems: RegistrationPendingItem[];
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasIncompleteStudentPersonalData(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;

  const record = value as Record<string, unknown>;
  if (record.role !== 'STUDENT') return true;

  const profile = record.profile && typeof record.profile === 'object'
    ? record.profile as Record<string, unknown>
    : {};
  const student = record.student && typeof record.student === 'object'
    ? record.student as Record<string, unknown>
    : {};
  const address = student.address && typeof student.address === 'object'
    ? student.address as Record<string, unknown>
    : {};

  const personalFields = [
    profile.phone,
    student.cpf,
    student.sex,
    student.nationality,
    student.birthplace,
    student.birth_state,
  ];
  const addressFields = [
    address.postal_code,
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
  ];

  return personalFields.some((field) => !hasText(field))
    || addressFields.some((field) => !hasText(field));
}

export function buildStudentPendingItems(input: {
  birthDate: string | null | undefined;
  hasActiveEnrollment: boolean;
  hasActiveGuardian: boolean;
  hasIncompletePersonalData?: boolean;
}): RegistrationPendingItem[] {
  const pending: RegistrationPendingItem[] = [];

  if (!input.birthDate) {
    pending.push({
      id: 'birth-date',
      label: 'Data de nascimento',
      description: 'Informe sua data de nascimento no cadastro acadêmico.',
    });
  }

  if (input.hasIncompletePersonalData) {
    pending.push({
      id: 'personal-data',
      label: 'Dados pessoais',
      description: 'Complete seus dados pessoais e de endereço no cadastro.',
    });
  }

  if (!input.hasActiveEnrollment) {
    pending.push({
      id: 'enrollment',
      label: 'Matrícula ativa',
      description: 'A secretaria ainda precisa concluir sua matrícula.',
    });
  }

  if (!input.hasActiveGuardian) {
    pending.push({
      id: 'guardian',
      label: 'Responsável vinculado',
      description: 'Cadastre ou vincule um responsável ao seu cadastro.',
    });
  }

  return pending;
}

export function buildGuardianPendingItems(input: {
  phone: string | null | undefined;
}): RegistrationPendingItem[] {
  if (input.phone?.trim()) return [];

  return [{
    id: 'phone',
    label: 'Telefone de contato',
    description: 'Adicione um telefone para facilitar a comunicação da escola.',
  }];
}

export const registrationCompletionService = {
  async getStudentCompletion(
    studentId: string,
    institutionId: string,
  ): Promise<RegistrationCompletion> {
    const [studentResult, enrollmentResult, guardianshipResult, selfRegistrationResult] = await Promise.all([
      supabase
        .from('students')
        .select('birth_date')
        .eq('id', studentId)
        .eq('institution_id', institutionId)
        .maybeSingle(),
      supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('active', true)
        .limit(1),
      supabase
        .from('guardianships')
        .select('id')
        .eq('student_id', studentId)
        .eq('active', true)
        .limit(1),
      supabase.rpc('get_current_self_registration'),
    ]);

    if (studentResult.error) throw studentResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;
    if (guardianshipResult.error) throw guardianshipResult.error;

    return {
      role: 'STUDENT',
      pendingItems: buildStudentPendingItems({
        birthDate: (studentResult.data as { birth_date?: string | null } | null)?.birth_date,
        hasActiveEnrollment: (enrollmentResult.data ?? []).length > 0,
        hasActiveGuardian: (guardianshipResult.data ?? []).length > 0,
        hasIncompletePersonalData:
          selfRegistrationResult.error !== null ||
          hasIncompleteStudentPersonalData(selfRegistrationResult.data),
      }),
    };
  },

  async getGuardianCompletion(
    profileId: string,
  ): Promise<RegistrationCompletion> {
    const { data, error } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', profileId)
      .maybeSingle();

    if (error) throw error;

    return {
      role: 'GUARDIAN',
      pendingItems: buildGuardianPendingItems({
        phone: (data as { phone?: string | null } | null)?.phone,
      }),
    };
  },
};
