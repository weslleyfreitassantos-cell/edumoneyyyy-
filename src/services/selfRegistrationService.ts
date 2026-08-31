import { supabase } from '../lib/supabaseClient';

export interface SelfRegistrationProfile {
  fullName: string;
  email: string;
  phone: string;
}

export interface SelfRegistrationAddress {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ruralZone: boolean;
}

export interface SelfRegistrationPreviousSchooling {
  originSchool: string;
  originNetwork: string;
  city: string;
  state: string;
  lastGrade: string;
  originYear: string;
  status: string;
  observations: string;
  historyDelivered: boolean;
  transferDeclaration: boolean;
}

export interface SelfRegistrationHealth {
  allergies: string;
  healthConditions: string;
  emergencyMedication: string;
  disability: string;
  autism: boolean;
  giftedness: boolean;
  needsSpecialEducation: boolean;
}

export interface StudentSelfRegistration {
  role: 'STUDENT';
  profile: SelfRegistrationProfile;
  student: {
    birthDate: string;
    cpf: string;
    socialName: string;
    rg: string;
    rgIssuingAuthority: string;
    rgState: string;
    birthCertificate: string;
    nationality: string;
    birthplace: string;
    birthState: string;
    sex: string;
    address: SelfRegistrationAddress;
    previousSchooling: SelfRegistrationPreviousSchooling;
    health: SelfRegistrationHealth;
  };
}

export interface GuardianSelfRegistration {
  role: 'GUARDIAN';
  profile: SelfRegistrationProfile;
}

export type SelfRegistrationData =
  | StudentSelfRegistration
  | GuardianSelfRegistration;

export interface StudentSelfRegistrationUpdate {
  role: 'STUDENT';
  profile: {
    fullName: string;
    phone: string;
  };
  student: StudentSelfRegistration['student'];
}

export interface GuardianSelfRegistrationUpdate {
  role: 'GUARDIAN';
  profile: {
    fullName: string;
    phone: string;
  };
}

export type SelfRegistrationUpdate =
  | StudentSelfRegistrationUpdate
  | GuardianSelfRegistrationUpdate;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function addressValue(value: unknown): SelfRegistrationAddress {
  const address = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return {
    postalCode: text(address.postal_code),
    street: text(address.street),
    number: text(address.number),
    complement: text(address.complement),
    neighborhood: text(address.neighborhood),
    city: text(address.city),
    state: text(address.state),
    ruralZone: booleanValue(address.rural_zone),
  };
}

function previousSchoolingValue(value: unknown): SelfRegistrationPreviousSchooling {
  const previous = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return {
    originSchool: text(previous.origin_school),
    originNetwork: text(previous.origin_network),
    city: text(previous.city),
    state: text(previous.state),
    lastGrade: text(previous.last_grade),
    originYear: previous.origin_year == null ? '' : String(previous.origin_year),
    status: text(previous.status),
    observations: text(previous.observations),
    historyDelivered: booleanValue(previous.history_delivered),
    transferDeclaration: booleanValue(previous.transfer_declaration),
  };
}

function healthValue(value: unknown): SelfRegistrationHealth {
  const health = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return {
    allergies: text(health.allergies),
    healthConditions: text(health.health_conditions),
    emergencyMedication: text(health.emergency_medication),
    disability: text(health.disability),
    autism: booleanValue(health.autism),
    giftedness: booleanValue(health.giftedness),
    needsSpecialEducation: booleanValue(health.needs_special_education),
  };
}

function normalizeData(value: unknown): SelfRegistrationData {
  if (!value || typeof value !== 'object') {
    throw new Error('O cadastro pessoal não foi encontrado.');
  }

  const record = value as Record<string, unknown>;
  const profileValue = record.profile && typeof record.profile === 'object'
    ? record.profile as Record<string, unknown>
    : {};
  const profile: SelfRegistrationProfile = {
    fullName: text(profileValue.full_name),
    email: text(profileValue.email),
    phone: text(profileValue.phone),
  };

  if (record.role === 'GUARDIAN') {
    return { role: 'GUARDIAN', profile };
  }

  if (record.role !== 'STUDENT') {
    throw new Error('Este cadastro não permite edição neste fluxo.');
  }

  const studentValue = record.student && typeof record.student === 'object'
    ? record.student as Record<string, unknown>
    : {};

  return {
    role: 'STUDENT',
    profile,
    student: {
      birthDate: text(studentValue.birth_date),
      cpf: text(studentValue.cpf),
      socialName: text(studentValue.social_name),
      rg: text(studentValue.rg),
      rgIssuingAuthority: text(studentValue.rg_issuing_authority),
      rgState: text(studentValue.rg_state),
      birthCertificate: text(studentValue.birth_certificate),
      nationality: text(studentValue.nationality),
      birthplace: text(studentValue.birthplace),
      birthState: text(studentValue.birth_state),
      sex: text(studentValue.sex),
      address: addressValue(studentValue.address),
      previousSchooling: previousSchoolingValue(studentValue.previous_schooling),
      health: healthValue(studentValue.health),
    },
  };
}

function toPayload(input: SelfRegistrationUpdate): Record<string, unknown> {
  const profile = {
    full_name: input.profile.fullName,
    phone: input.profile.phone,
  };

  if (input.role === 'GUARDIAN') {
    return { role: input.role, profile };
  }

  return {
    role: input.role,
    profile,
    student: {
      birth_date: input.student.birthDate,
      cpf: input.student.cpf,
      social_name: input.student.socialName,
      rg: input.student.rg,
      rg_issuing_authority: input.student.rgIssuingAuthority,
      rg_state: input.student.rgState,
      birth_certificate: input.student.birthCertificate,
      nationality: input.student.nationality,
      birthplace: input.student.birthplace,
      birth_state: input.student.birthState,
      sex: input.student.sex,
      address: {
        postal_code: input.student.address.postalCode,
        street: input.student.address.street,
        number: input.student.address.number,
        complement: input.student.address.complement,
        neighborhood: input.student.address.neighborhood,
        city: input.student.address.city,
        state: input.student.address.state,
        rural_zone: input.student.address.ruralZone,
      },
      previous_schooling: {
        origin_school: input.student.previousSchooling.originSchool,
        origin_network: input.student.previousSchooling.originNetwork,
        city: input.student.previousSchooling.city,
        state: input.student.previousSchooling.state,
        last_grade: input.student.previousSchooling.lastGrade,
        origin_year: input.student.previousSchooling.originYear,
        status: input.student.previousSchooling.status,
        observations: input.student.previousSchooling.observations,
        history_delivered: input.student.previousSchooling.historyDelivered,
        transfer_declaration: input.student.previousSchooling.transferDeclaration,
      },
      health: {
        allergies: input.student.health.allergies,
        health_conditions: input.student.health.healthConditions,
        emergency_medication: input.student.health.emergencyMedication,
        disability: input.student.health.disability,
        autism: input.student.health.autism,
        giftedness: input.student.health.giftedness,
        needs_special_education: input.student.health.needsSpecialEducation,
      },
    },
  };
}

export const selfRegistrationService = {
  async getCurrent(): Promise<SelfRegistrationData> {
    const { data, error } = await supabase.rpc(
      'get_current_self_registration',
    );

    if (error) throw error;

    return normalizeData(data);
  },

  async update(input: SelfRegistrationUpdate): Promise<SelfRegistrationData> {
    const { data, error } = await supabase.rpc(
      'update_current_self_registration',
      { p_payload: toPayload(input) },
    );

    if (error) throw error;

    return normalizeData(data);
  },
};
