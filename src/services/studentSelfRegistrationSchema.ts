import type { StudentSelfRegistration } from './selfRegistrationService';

export type NormalizedStudentRegistration = StudentSelfRegistration['student'];

const BRAZILIAN_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

function normalizeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeUf(value: string, label: string): string {
  const normalized = normalizeText(value, 2).toUpperCase();
  if (normalized && !BRAZILIAN_STATES.has(normalized)) {
    throw new Error(`${label} inválida.`);
  }
  return normalized;
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^([0-9])\1{10}$/.test(value)) {
    return false;
  }

  let first = 0;
  for (let index = 0; index < 9; index += 1) {
    first += Number(value[index]) * (10 - index);
  }
  const firstDigit = (first * 10) % 11;

  let second = 0;
  for (let index = 0; index < 10; index += 1) {
    second += Number(value[index]) * (11 - index);
  }
  const secondDigit = (second * 10) % 11;

  return (firstDigit === 10 ? 0 : firstDigit) === Number(value[9])
    && (secondDigit === 10 ? 0 : secondDigit) === Number(value[10]);
}

function normalizeDate(value: string): string {
  const normalized = normalizeText(value, 10);
  if (!normalized) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Data de nascimento inválida.');
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getTime() > Date.now()
  ) {
    throw new Error('Data de nascimento inválida.');
  }
  return normalized;
}

export function normalizeStudentPhone(value: string): string {
  const normalized = normalizeDigits(value);
  if (normalized && !/^\d{10,11}$/.test(normalized)) {
    throw new Error('Telefone inválido.');
  }
  return normalized;
}

function normalizeCpf(value: string): string {
  const normalized = normalizeDigits(value);
  if (normalized && !isValidCpf(normalized)) {
    throw new Error('CPF inválido.');
  }
  return normalized;
}

function normalizePostalCode(value: string): string {
  const normalized = normalizeDigits(value);
  if (normalized && !/^\d{8}$/.test(normalized)) {
    throw new Error('CEP inválido.');
  }
  return normalized;
}

function normalizeOriginYear(value: string): string {
  const normalized = normalizeText(value, 4);
  if (normalized && (!/^\d{4}$/.test(normalized) || Number(normalized) > new Date().getFullYear())) {
    throw new Error('Ano de origem inválido.');
  }
  return normalized;
}

export function normalizeStudentRegistration(
  value: StudentSelfRegistration['student'],
): NormalizedStudentRegistration {
  return {
    birthDate: normalizeDate(value.birthDate),
    cpf: normalizeCpf(value.cpf),
    socialName: normalizeText(value.socialName, 120),
    rg: normalizeText(value.rg, 40),
    rgIssuingAuthority: normalizeText(value.rgIssuingAuthority, 80),
    rgState: normalizeUf(value.rgState, 'UF do RG'),
    birthCertificate: normalizeText(value.birthCertificate, 80),
    nationality: normalizeText(value.nationality, 80),
    birthplace: normalizeText(value.birthplace, 120),
    birthState: normalizeUf(value.birthState, 'UF de nascimento'),
    sex: normalizeText(value.sex, 40),
    address: {
      postalCode: normalizePostalCode(value.address.postalCode),
      street: normalizeText(value.address.street, 160),
      number: normalizeText(value.address.number, 30),
      complement: normalizeText(value.address.complement, 100),
      neighborhood: normalizeText(value.address.neighborhood, 100),
      city: normalizeText(value.address.city, 100),
      state: normalizeUf(value.address.state, 'UF do endereço'),
      ruralZone: value.address.ruralZone === true,
    },
    previousSchooling: {
      originSchool: normalizeText(value.previousSchooling.originSchool, 160),
      originNetwork: normalizeText(value.previousSchooling.originNetwork, 80),
      city: normalizeText(value.previousSchooling.city, 100),
      state: normalizeUf(value.previousSchooling.state, 'UF da escola de origem'),
      lastGrade: normalizeText(value.previousSchooling.lastGrade, 80),
      originYear: normalizeOriginYear(value.previousSchooling.originYear),
      status: normalizeText(value.previousSchooling.status, 80),
      observations: normalizeText(value.previousSchooling.observations, 500),
      historyDelivered: value.previousSchooling.historyDelivered === true,
      transferDeclaration: value.previousSchooling.transferDeclaration === true,
    },
    health: {
      allergies: normalizeText(value.health.allergies, 500),
      healthConditions: normalizeText(value.health.healthConditions, 500),
      emergencyMedication: normalizeText(value.health.emergencyMedication, 500),
      disability: normalizeText(value.health.disability, 500),
      autism: value.health.autism === true,
      giftedness: value.health.giftedness === true,
      needsSpecialEducation: value.health.needsSpecialEducation === true,
    },
  };
}

export function normalizeStudentFullName(value: string): string {
  const normalized = normalizeText(value, 120);
  if (normalized.length < 2) throw new Error('Informe um nome válido.');
  return normalized;
}

export function validateStudentRegistrationForConfirmation(
  student: StudentSelfRegistration['student'],
  phone: string,
): NormalizedStudentRegistration {
  const normalized = normalizeStudentRegistration(student);
  const normalizedPhone = normalizeStudentPhone(phone);
  const required = [
    normalized.birthDate,
    normalized.cpf,
    normalized.sex,
    normalized.nationality,
    normalized.birthplace,
    normalized.birthState,
    normalized.address.postalCode,
    normalized.address.street,
    normalized.address.number,
    normalized.address.neighborhood,
    normalized.address.city,
    normalized.address.state,
    normalizedPhone,
  ];

  if (required.some((field) => !field)) {
    throw new Error('Complete os dados cadastrais obrigatórios antes de confirmar.');
  }

  return normalized;
}
