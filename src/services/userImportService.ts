import type { AcademicYearRow } from './academicStructureService';
import { getActiveClassesForYear } from '../lib/academicSelection';
import {
  academicAutomationService,
  type TeacherAvailabilityRow,
} from './academicAutomationService';
import type { ClassRow } from './classService';
import {
  createFullStudentEnrollment,
  type FullStudentEnrollmentDraft,
  type StudentDocumentStatus,
} from './fullStudentEnrollmentService';
import { subjectService, type SubjectRow } from './subjectService';
import { teacherService } from './teacherService';
import {
  normalizeSpreadsheetHeader,
  type ParsedSpreadsheet,
  type ParsedSpreadsheetRow,
} from './spreadsheetImportService';

type TeacherAvailabilityDraft = Omit<
  TeacherAvailabilityRow,
  'id' | 'active' | 'institution_id' | 'teacher_profile_id'
>;

export interface ImportPreview<T> {
  rowNumber: number;
  label: string;
  data: T;
  errors: string[];
  warnings: string[];
}

export interface StudentImportPreviewData extends FullStudentEnrollmentDraft {}

export interface TeacherImportPreviewData {
  full_name: string;
  email: string;
  phone?: string;
  subject_ids: string[];
  primary_subject_id?: string;
  availability: TeacherAvailabilityDraft[];
}

export interface ImportProgress {
  current: number;
  total: number;
  rowNumber: number;
  label: string;
}

export interface ImportFailure {
  rowNumber: number;
  label: string;
  message: string;
}

export interface ImportResult {
  succeeded: Array<{ rowNumber: number; label: string }>;
  failed: ImportFailure[];
}

export const STUDENT_IMPORT_HEADERS = [
  'Nome completo', 'E-mail', 'Data de nascimento', 'CPF', 'Nome social', 'RG',
  'Órgão expedidor', 'UF do RG', 'Certidão de nascimento', 'Nacionalidade',
  'Naturalidade', 'UF de nascimento', 'Sexo', 'Telefone', 'CEP', 'Logradouro',
  'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'Zona rural',
  'Responsável 1 - ID do perfil', 'Responsável 1 - Nome completo',
  'Responsável 1 - E-mail', 'Responsável 1 - Telefone', 'Responsável 1 - Parentesco',
  'Responsável 1 - Principal', 'Responsável 2 - ID do perfil',
  'Responsável 2 - Nome completo', 'Responsável 2 - E-mail', 'Responsável 2 - Telefone',
  'Responsável 2 - Parentesco', 'Responsável 2 - Principal', 'Escola de origem',
  'Rede de ensino de origem', 'Cidade de origem', 'UF de origem', 'Último ano cursado',
  'Ano de origem', 'Status da origem', 'Observações da origem', 'Histórico escolar entregue',
  'Declaração de transferência entregue', 'Alergias', 'Condições de saúde',
  'Medicação de emergência', 'Deficiência', 'Autismo/TEA', 'Altas habilidades',
  'Necessita educação especial', 'Observações de cuidados', 'Ano letivo',
  'Ano escolar / série', 'ID do ano letivo', 'Turma', 'ID da turma', 'Data da matrícula',
  'Certidão de nascimento - Status', 'Certidão de nascimento - Observações',
  'RG - Status', 'RG - Observações', 'CPF - Status', 'CPF - Observações',
  'Comprovante de endereço - Status', 'Comprovante de endereço - Observações',
  'Histórico escolar - Status', 'Histórico escolar - Observações',
  'Declaração de transferência - Status', 'Declaração de transferência - Observações',
  'Carteira de vacinação - Status', 'Carteira de vacinação - Observações',
  'Laudo ou relatório - Status', 'Laudo ou relatório - Observações',
  'Foto 3x4 - Status', 'Foto 3x4 - Observações', 'Outros - Status', 'Outros - Observações',
] as const;

export const TEACHER_IMPORT_HEADERS = [
  'Nome completo', 'E-mail', 'Telefone', 'Disciplinas', 'Disciplina principal',
  ...Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    return [`Disponibilidade ${slot} - Dia`, `Disponibilidade ${slot} - Início`, `Disponibilidade ${slot} - Fim`];
  }).flat(),
] as const;

const studentDocumentFields: Array<{ type: string; key: string }> = [
  { type: 'Certidao de nascimento', key: 'certidao_nascimento' },
  { type: 'RG', key: 'rg_document' },
  { type: 'CPF', key: 'cpf_document' },
  { type: 'Comprovante de endereco', key: 'comprovante_endereco' },
  { type: 'Historico escolar', key: 'historico_escolar' },
  { type: 'Declaracao de transferencia', key: 'declaracao_transferencia' },
  { type: 'Carteira de vacinacao', key: 'carteira_vacinacao' },
  { type: 'Laudo ou relatorio', key: 'laudo_relatorio' },
  { type: 'Foto 3x4', key: 'foto_3x4' },
  { type: 'Outros', key: 'outros' },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function value(row: ParsedSpreadsheetRow, aliases: string[]): string {
  for (const alias of aliases) {
    const result = row.values[normalizeSpreadsheetHeader(alias)];
    if (result) return result.trim();
  }
  return '';
}

function hasAny(row: ParsedSpreadsheetRow, aliases: string[]): boolean {
  return aliases.some((alias) => Boolean(row.values[normalizeSpreadsheetHeader(alias)]?.trim()));
}

function required(valueToCheck: string, label: string, errors: string[]): void {
  if (!valueToCheck.trim()) errors.push(`${label} é obrigatório.`);
}

function parseDate(valueToParse: string): string | null {
  const input = valueToParse.trim();
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const brazilian = input.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const serial = Number(input);
  if (Number.isInteger(serial) && serial >= 1 && serial <= 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function parseBoolean(valueToParse: string, label: string, errors: string[]): boolean {
  const input = normalize(valueToParse);
  if (!input) return false;
  if (['true', '1', 'sim', 's', 'yes', 'ativo'].includes(input)) return true;
  if (['false', '0', 'nao', 'n', 'no', 'inativo'].includes(input)) return false;
  errors.push(`${label} deve ser Sim/Não ou Verdadeiro/Falso.`);
  return false;
}

function parseOptionalBoolean(valueToParse: string, label: string, errors: string[]): boolean | undefined {
  return valueToParse.trim() ? parseBoolean(valueToParse, label, errors) : undefined;
}

function parseYear(valueToParse: string): number | null {
  const parsed = Number(valueToParse.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveYear(valueToParse: string, years: AcademicYearRow[]): AcademicYearRow | null {
  if (!valueToParse) return null;
  return years.find((year) => year.id === valueToParse)
    ?? years.find((year) => normalize(year.name) === normalize(valueToParse))
    ?? null;
}

function resolveClass(
  valueToParse: string,
  year: AcademicYearRow | null,
  classes: ClassRow[],
): ClassRow | null {
  if (!valueToParse) return null;
  return classes.find((classRow) => classRow.id === valueToParse && (!year || classRow.academic_year_id === year.id))
    ?? classes.find((classRow) => normalize(classRow.name) === normalize(valueToParse) && (!year || classRow.academic_year_id === year.id))
    ?? null;
}

function normalizeGradeLevel(valueToParse: string): string {
  return normalize(valueToParse)
    .replace(/[ºª°]/g, '')
    .replace(/\b(ano|serie)\b/g, '')
    .replace(/\s+/g, '');
}

function classesMatchGrade(
  classRow: ClassRow,
  gradeInput: string,
): boolean {
  const normalizedInput = normalizeGradeLevel(gradeInput);
  const normalizedClass = normalizeGradeLevel(classRow.grade_level ?? '');

  if (!normalizedInput || !normalizedClass) return false;
  if (normalizedInput === normalizedClass) return true;

  const inputNumber = normalizedInput.match(/^\d+/)?.[0];
  const classNumber = normalizedClass.match(/^\d+/)?.[0];

  return Boolean(
    inputNumber &&
      classNumber &&
      inputNumber === classNumber &&
      normalizedInput.replace(/^\d+/, '') === '',
  );
}

function resolveAutomaticClass(
  year: AcademicYearRow | null,
  gradeInput: string,
  classes: ClassRow[],
  projectedEnrollments: Map<string, number>,
): ClassRow | null {
  if (!year) return null;

  const classesForYear = getActiveClassesForYear(classes, year.id);
  if (!gradeInput && classesForYear.length !== 1) return null;

  const matchingClasses = gradeInput
    ? classesForYear.filter((classRow) => classesMatchGrade(classRow, gradeInput))
    : classesForYear;
  const classesWithSeats = matchingClasses.filter((classRow) => {
    const enrolled = projectedEnrollments.get(classRow.id) ?? classRow.active_enrollments_count;

    return classRow.capacity <= 0 || enrolled < classRow.capacity;
  });

  return [...classesWithSeats].sort((left, right) => {
    const leftCount = projectedEnrollments.get(left.id) ?? left.active_enrollments_count;
    const rightCount = projectedEnrollments.get(right.id) ?? right.active_enrollments_count;

    if (leftCount !== rightCount) return leftCount - rightCount;

    return left.name.localeCompare(right.name, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  })[0] ?? null;
}

function resolveSubject(valueToParse: string, subjects: SubjectRow[]): SubjectRow | null {
  const input = normalize(valueToParse);
  return subjects.find((subject) => subject.id === valueToParse)
    ?? subjects.find((subject) => normalize(subject.name) === input)
    ?? subjects.find((subject) => normalize(subject.code ?? '') === input)
    ?? null;
}

function splitList(valueToSplit: string): string[] {
  return valueToSplit.split(/[;,\n|]/).map((item) => item.trim()).filter(Boolean);
}

function parseTime(valueToParse: string): string | null {
  const match = valueToParse.trim().match(/^(\d{1,2})[:h](\d{2})/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDay(valueToParse: string): number | null {
  const input = normalize(valueToParse).replace(/-feira/g, '');
  const numeric = Number(input);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 6) return numeric;
  const days: Record<string, number> = {
    segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3,
    quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6,
  };
  return days[input] ?? null;
}

function documentStatus(valueToParse: string, label: string, errors: string[]): StudentDocumentStatus {
  const input = normalize(valueToParse).replace(/ /g, '_');
  const statuses: Record<string, StudentDocumentStatus> = {
    pending: 'PENDING', pendente: 'PENDING',
    delivered: 'DELIVERED', entregue: 'DELIVERED',
    validated: 'VALIDATED', validado: 'VALIDATED', validada: 'VALIDATED',
    dispensed: 'DISPENSED', dispensado: 'DISPENSED', dispensada: 'DISPENSED',
  };
  if (!input) return 'PENDING';
  const status = statuses[input];
  if (status) return status;
  errors.push(`${label} deve ser Pendente, Entregue, Validado ou Dispensado.`);
  return 'PENDING';
}

function buildDocuments(row: ParsedSpreadsheetRow, errors: string[]): FullStudentEnrollmentDraft['documents'] {
  const documentPrefixes: Record<string, string[]> = {
    certidao_nascimento: ['certidao_nascimento', 'certidao_de_nascimento'],
    rg_document: ['rg_document', 'rg'],
    cpf_document: ['cpf_document', 'cpf'],
    comprovante_endereco: ['comprovante_endereco', 'comprovante_de_endereco'],
    historico_escolar: ['historico_escolar'],
    declaracao_transferencia: ['declaracao_transferencia'],
    carteira_vacinacao: ['carteira_vacinacao'],
    laudo_relatorio: ['laudo_relatorio', 'laudo_ou_relatorio'],
    foto_3x4: ['foto_3x4'],
    outros: ['outros'],
  };
  return studentDocumentFields.map(({ type, key }) => ({
    document_type: type,
    status: documentStatus(value(row, (documentPrefixes[key] ?? [key]).flatMap((prefix) => [`${prefix}_status`])), `${type} - status`, errors),
    notes: value(row, (documentPrefixes[key] ?? [key]).flatMap((prefix) => [`${prefix}_notes`, `${prefix}_observacoes`])),
  }));
}

function dateOrError(valueToParse: string, label: string, errors: string[], isRequired = false): string {
  const parsed = parseDate(valueToParse);
  if (!parsed && (isRequired || valueToParse)) errors.push(`${label} deve ser uma data válida (AAAA-MM-DD ou DD/MM/AAAA).`);
  if (!parsed && isRequired) return '';
  return parsed ?? '';
}

function studentKnownHeaders(): Set<string> {
  return new Set([
    ...STUDENT_IMPORT_HEADERS,
    'nome', 'nome_completo', 'e_mail', 'data_nascimento', 'nascimento',
    'nome_social', 'orgao_expedidor', 'uf_rg', 'certidao_nascimento',
    'nacionalidade', 'naturalidade', 'uf_nascimento', 'sexo', 'telefone',
    'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
    'zona_rural', 'responsavel_1_profile_id', 'responsavel_1_nome',
    'responsavel_1_email', 'responsavel_1_telefone', 'responsavel_1_parentesco',
    'responsavel_1_relacao', 'responsavel_2_profile_id', 'responsavel_2_nome',
    'responsavel_2_email', 'responsavel_2_telefone', 'responsavel_2_parentesco',
    'responsavel_2_relacao', 'escola_origem', 'rede_origem', 'cidade_origem',
    'uf_origem', 'ultimo_ano', 'ano_origem', 'status_origem', 'observacoes_origem',
    'historico_entregue', 'declaracao_transferencia', 'alergias', 'condicoes_saude',
    'medicacao_emergencia', 'deficiencia', 'tea', 'altas_habilidades',
    'educacao_especial', 'observacoes_cuidado', 'ano_letivo', 'ano', 'turma',
    'grade_level', 'ano_escolar', 'ano_escolar_serie', 'serie', 'ano_do_aluno', 'ano_cursado',
    'data_matricula', 'ra', 'registration_number', 'arquivo_documento', 'foto',
    'responsavel_1_id_do_perfil', 'responsavel_1_nome_completo', 'responsavel_1_e_mail',
    'responsavel_1_principal', 'responsavel_2_id_do_perfil', 'responsavel_2_nome_completo',
    'responsavel_2_e_mail', 'responsavel_2_principal', 'uf_do_rg', 'uf_de_nascimento',
    'cidade_de_origem', 'rede_de_ensino_de_origem', 'uf_de_origem', 'ultimo_ano_cursado',
    'ano_de_origem', 'status_da_origem', 'observacoes_da_origem', 'historico_escolar_entregue',
    'declaracao_de_transferencia_entregue', 'condicoes_de_saude', 'medicacao_de_emergencia',
    'necessita_educacao_especial', 'observacoes_de_cuidados', 'id_do_ano_letivo', 'id_da_turma',
    'autismo_tea', 'certidao_de_nascimento', 'comprovante_de_endereco', 'laudo_ou_relatorio',
    'outros',
  ].map((header) => normalizeSpreadsheetHeader(header)));
}

function teacherKnownHeaders(): Set<string> {
  return new Set([
    ...TEACHER_IMPORT_HEADERS,
    'nome', 'nome_completo', 'e_mail', 'telefone', 'disciplinas', 'materias',
    'disciplina_principal', 'materia_principal', 'disponibilidade_1_dia',
    ...Array.from({ length: 10 }, (_, index) => {
      const slot = index + 1;
      return [`disponibilidade_${slot}_dia`, `disponibilidade_${slot}_inicio`, `disponibilidade_${slot}_fim`];
    }).flat(),
  ].map((header) => normalizeSpreadsheetHeader(header)));
}

function unknownHeaders(parsed: ParsedSpreadsheet, known: Set<string>): string[] {
  return parsed.headers.filter((header) => !known.has(header));
}

export function buildStudentImportPreviews(
  parsed: ParsedSpreadsheet,
  options: {
    years: AcademicYearRow[];
    classes: ClassRow[];
    defaultAcademicYearId?: string;
  },
): { previews: ImportPreview<StudentImportPreviewData>[]; unknownHeaders: string[] } {
  const defaultAcademicYear = options.years.find(
    (year) => year.id === options.defaultAcademicYearId,
  ) ?? null;
  const projectedEnrollments = new Map(
    options.classes.map((classRow) => [
      classRow.id,
      classRow.active_enrollments_count,
    ]),
  );

  const previews = parsed.rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = value(row, ['full_name', 'nome_completo', 'nome']);
    const email = value(row, ['email', 'e_mail']);
    const birthDate = dateOrError(value(row, ['birth_date', 'data_nascimento', 'data_de_nascimento', 'nascimento']), 'Data de nascimento', errors, true);
    const yearInput = value(row, ['academic_year_id', 'academic_year', 'ano_letivo', 'ano', 'id_do_ano_letivo']);
    const classInput = value(row, ['class_id', 'class', 'turma', 'id_da_turma']);
    const gradeInput = value(row, ['grade_level', 'ano_escolar', 'ano_escolar_serie', 'serie', 'ano_do_aluno', 'ano_cursado']);
    const year = resolveYear(yearInput, options.years) ?? (yearInput ? null : defaultAcademicYear);
    let classRow = resolveClass(classInput, year, options.classes);
    const yearClasses = year ? getActiveClassesForYear(options.classes, year.id) : [];
    const matchingGradeClasses = gradeInput
      ? yearClasses.filter((item) => classesMatchGrade(item, gradeInput))
      : yearClasses;

    if (!classInput) {
      classRow = resolveAutomaticClass(
        year,
        gradeInput,
        options.classes,
        projectedEnrollments,
      );
    }

    required(fullName, 'Nome completo', errors);
    required(email, 'E-mail', errors);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('E-mail inválido.');
    if (classInput && !classRow) errors.push('Turma não encontrada para o ano letivo informado.');
    if (!year) {
      errors.push(
        yearInput
          ? 'Ano letivo não encontrado nesta instituição.'
          : 'Ano letivo é obrigatório ou selecione um ano padrão para a importação.',
      );
    }
    if (!classInput && !classRow && year) {
      if (!gradeInput && matchingGradeClasses.length > 1) {
        errors.push('Informe o ano escolar/série para distribuir o aluno entre as turmas.');
      } else if (matchingGradeClasses.length === 0) {
        errors.push('Nenhuma turma ativa corresponde ao ano escolar informado.');
      } else {
        errors.push('Não há vagas nas turmas correspondentes ao ano escolar informado.');
      }
    }

    if (!classInput && classRow) {
      warnings.push(`Turma atribuída automaticamente: ${classRow.name}.`);
    }

    if (classRow) {
      projectedEnrollments.set(
        classRow.id,
        (projectedEnrollments.get(classRow.id) ?? classRow.active_enrollments_count) + 1,
      );
    }

    const guardians = [1, 2].flatMap((index) => {
      const prefix = `guardian_${index}`;
      const profileId = value(row, [`${prefix}_profile_id`, `responsavel_${index}_profile_id`, `responsavel_${index}_id_do_perfil`]);
      const guardianName = value(row, [`${prefix}_full_name`, `${prefix}_name`, `responsavel_${index}_nome`, `responsavel_${index}_nome_completo`]);
      const guardianEmail = value(row, [`${prefix}_email`, `responsavel_${index}_email`, `responsavel_${index}_e_mail`]);
      const guardianPhone = value(row, [`${prefix}_phone`, `responsavel_${index}_telefone`]);
      const relationship = value(row, [`${prefix}_relationship`, `responsavel_${index}_parentesco`, `responsavel_${index}_relacao`]);
      const anyGuardianValue = Boolean(profileId || guardianName || guardianEmail || guardianPhone || relationship);
      if (!anyGuardianValue) return [];
      if (!profileId) {
        required(guardianName, `Responsável ${index}: nome`, errors);
        required(guardianEmail, `Responsável ${index}: e-mail`, errors);
        if (guardianEmail && !/^\S+@\S+\.\S+$/.test(guardianEmail)) errors.push(`Responsável ${index}: e-mail inválido.`);
      }
      required(relationship, `Responsável ${index}: parentesco`, errors);
      return [{
        mode: profileId ? 'existing' as const : 'new' as const,
        profile_id: profileId,
        full_name: guardianName,
        email: guardianEmail,
        phone: guardianPhone,
        relationship,
        is_primary: parseOptionalBoolean(value(row, [`${prefix}_is_primary`, `responsavel_${index}_principal`]), `Responsável ${index}: principal`, errors) ?? index === 1,
      }];
    });
    if (guardians.length === 0) errors.push('Informe pelo menos um responsável (ID de perfil existente ou dados para criar).');

    const identity = {
      full_name: fullName,
      email,
      birth_date: birthDate,
      cpf: value(row, ['cpf']),
      social_name: value(row, ['social_name', 'nome_social']),
      rg: value(row, ['rg']),
      rg_issuing_authority: value(row, ['rg_issuing_authority', 'orgao_expedidor']),
      rg_state: value(row, ['rg_state', 'uf_rg', 'uf_do_rg']),
      birth_certificate: value(row, ['birth_certificate', 'certidao_nascimento', 'certidao_de_nascimento']),
      nationality: value(row, ['nationality', 'nacionalidade']) || 'Brasileira',
      birthplace: value(row, ['birthplace', 'naturalidade']),
      birth_state: value(row, ['birth_state', 'uf_nascimento', 'uf_de_nascimento']),
      sex: value(row, ['sex', 'sexo']),
      phone: value(row, ['phone', 'telefone']),
    };

    const data: StudentImportPreviewData = {
      identity,
      address: {
        postal_code: value(row, ['postal_code', 'cep']), street: value(row, ['street', 'logradouro']),
        number: value(row, ['number', 'numero']), complement: value(row, ['complement', 'complemento']),
        neighborhood: value(row, ['neighborhood', 'bairro']), city: value(row, ['city', 'cidade']),
        state: value(row, ['state', 'uf']), rural_zone: parseBoolean(value(row, ['rural_zone', 'zona_rural']), 'Zona rural', errors),
      },
      guardians,
      previous_schooling: {
        origin_school: value(row, ['origin_school', 'escola_origem']), origin_network: value(row, ['origin_network', 'rede_origem', 'rede_de_ensino_de_origem']),
        city: value(row, ['origin_city', 'cidade_origem', 'cidade_de_origem']), state: value(row, ['origin_state', 'uf_origem', 'uf_de_origem']),
        last_grade: value(row, ['last_grade', 'ultimo_ano', 'ultimo_ano_cursado']), origin_year: value(row, ['origin_year', 'ano_origem', 'ano_de_origem']),
        status: value(row, ['origin_status', 'status_origem', 'status_da_origem']), observations: value(row, ['origin_observations', 'observacoes_origem', 'observacoes_da_origem']),
        history_delivered: parseBoolean(value(row, ['history_delivered', 'historico_entregue', 'historico_escolar_entregue']), 'Histórico entregue', errors),
        transfer_declaration: parseBoolean(value(row, ['transfer_declaration', 'declaracao_transferencia', 'declaracao_de_transferencia_entregue']), 'Declaração de transferência', errors),
      },
      health: {
        allergies: value(row, ['allergies', 'alergias']), health_conditions: value(row, ['health_conditions', 'condicoes_saude', 'condicoes_de_saude']),
        emergency_medication: value(row, ['emergency_medication', 'medicacao_emergencia', 'medicacao_de_emergencia']), disability: value(row, ['disability', 'deficiencia']),
        autism: parseBoolean(value(row, ['autism', 'tea', 'autismo_tea']), 'Autismo/TEA', errors), giftedness: parseBoolean(value(row, ['giftedness', 'altas_habilidades']), 'Altas habilidades', errors),
        needs_special_education: parseBoolean(value(row, ['needs_special_education', 'educacao_especial', 'necessita_educacao_especial']), 'Educação especial', errors),
        school_care_notes: value(row, ['school_care_notes', 'observacoes_cuidado', 'observacoes_de_cuidados']),
      },
      documents: buildDocuments(row, errors),
      academic_year_id: year?.id ?? '',
      class_id: classRow?.id ?? '',
      enrolled_at: dateOrError(value(row, ['enrolled_at', 'data_matricula', 'data_da_matricula', 'data_de_matricula']) || new Date().toISOString().slice(0, 10), 'Data da matrícula', errors),
    };

    if (hasAny(row, ['registration_number', 'ra'])) warnings.push('RA informado foi ignorado; o sistema gera o RA automaticamente.');
    if (hasAny(row, ['document_file', 'arquivo_documento', 'foto'])) warnings.push('Arquivos não são carregados pela planilha; importe apenas status e observações dos documentos.');
    return { rowNumber: row.rowNumber, label: fullName || `Linha ${row.rowNumber}`, data, errors, warnings };
  });
  return { previews, unknownHeaders: unknownHeaders(parsed, studentKnownHeaders()) };
}

export function buildTeacherImportPreviews(
  parsed: ParsedSpreadsheet,
  subjects: SubjectRow[],
): { previews: ImportPreview<TeacherImportPreviewData>[]; unknownHeaders: string[] } {
  const previews = parsed.rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = value(row, ['full_name', 'nome_completo', 'nome']);
    const email = value(row, ['email', 'e_mail']);
    required(fullName, 'Nome completo', errors);
    required(email, 'E-mail', errors);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('E-mail inválido.');

    const subjectNames = splitList(value(row, ['subjects', 'disciplinas', 'materias']));
    const resolvedSubjects = subjectNames.map((item) => resolveSubject(item, subjects));
    resolvedSubjects.forEach((subject, index) => {
      if (!subject) errors.push(`Disciplina não encontrada: ${subjectNames[index]}.`);
    });
    if (resolvedSubjects.length === 0) errors.push('Informe pelo menos uma disciplina em subjects/disciplinas.');
    const subjectIds = resolvedSubjects.filter((subject): subject is SubjectRow => Boolean(subject)).map((subject) => subject.id);
    const primaryInput = value(row, ['primary_subject', 'disciplina_principal', 'materia_principal']);
    const primarySubject = primaryInput ? resolveSubject(primaryInput, subjects) : null;
    if (primaryInput && !primarySubject) errors.push(`Disciplina principal não encontrada: ${primaryInput}.`);
    if (primarySubject && !subjectIds.includes(primarySubject.id)) errors.push('A disciplina principal precisa estar na lista de disciplinas.');

    const availability: TeacherAvailabilityDraft[] = [];
    for (let index = 1; index <= 10; index += 1) {
      const dayInput = value(row, [`availability_${index}_day`, `disponibilidade_${index}_dia`]);
      const startInput = value(row, [`availability_${index}_start`, `disponibilidade_${index}_inicio`]);
      const endInput = value(row, [`availability_${index}_end`, `disponibilidade_${index}_fim`]);
      if (!dayInput && !startInput && !endInput) continue;
      const day = parseDay(dayInput);
      const start = parseTime(startInput);
      const end = parseTime(endInput);
      if (!day) errors.push(`Disponibilidade ${index}: dia inválido.`);
      if (!start || !end) errors.push(`Disponibilidade ${index}: informe horários válidos.`);
      if (start && end && start >= end) errors.push(`Disponibilidade ${index}: o fim deve ser posterior ao início.`);
      if (day && start && end) availability.push({ day_of_week: day, start_time: start, end_time: end });
    }
    const data: TeacherImportPreviewData = {
      full_name: fullName,
      email,
      phone: value(row, ['phone', 'telefone']) || undefined,
      subject_ids: [...new Set(subjectIds)],
      primary_subject_id: primarySubject?.id,
      availability,
    };
    return { rowNumber: row.rowNumber, label: fullName || `Linha ${row.rowNumber}`, data, errors, warnings };
  });
  return { previews, unknownHeaders: unknownHeaders(parsed, teacherKnownHeaders()) };
}

export async function importStudents(
  institutionId: string,
  previews: Array<ImportPreview<StudentImportPreviewData>>,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const result: ImportResult = { succeeded: [], failed: [] };
  for (let index = 0; index < previews.length; index += 1) {
    const preview = previews[index];
    onProgress?.({ current: index + 1, total: previews.length, rowNumber: preview.rowNumber, label: preview.label });
    try {
      await createFullStudentEnrollment(institutionId, preview.data);
      result.succeeded.push({ rowNumber: preview.rowNumber, label: preview.label });
    } catch (error) {
      result.failed.push({ rowNumber: preview.rowNumber, label: preview.label, message: error instanceof Error ? error.message : 'Não foi possível importar o aluno.' });
    }
  }
  return result;
}

export async function importTeachers(
  institutionId: string,
  previews: Array<ImportPreview<TeacherImportPreviewData>>,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const result: ImportResult = { succeeded: [], failed: [] };
  for (let index = 0; index < previews.length; index += 1) {
    const preview = previews[index];
    onProgress?.({ current: index + 1, total: previews.length, rowNumber: preview.rowNumber, label: preview.label });
    try {
      const teacher = await teacherService.create({
        institution_id: institutionId,
        full_name: preview.data.full_name,
        email: preview.data.email,
        ...(preview.data.phone ? { phone: preview.data.phone } : {}),
      });
      await academicAutomationService.replaceTeacherSubjects({
        institution_id: institutionId,
        teacher_profile_id: teacher.profile_id,
        subject_ids: preview.data.subject_ids,
        primary_subject_id: preview.data.primary_subject_id,
      });
      await academicAutomationService.replaceTeacherAvailability({
        institution_id: institutionId,
        teacher_profile_id: teacher.profile_id,
        availability: preview.data.availability,
      });
      result.succeeded.push({ rowNumber: preview.rowNumber, label: preview.label });
    } catch (error) {
      result.failed.push({ rowNumber: preview.rowNumber, label: preview.label, message: error instanceof Error ? error.message : 'Não foi possível importar o professor.' });
    }
  }
  return result;
}

export const STUDENT_IMPORT_EXAMPLE: Record<string, string> = {
  'Nome completo': 'Ana Souza', 'E-mail': 'ana.souza@exemplo.com', 'Data de nascimento': '12/03/2016', CPF: '12345678900',
  'Responsável 1 - Nome completo': 'Carlos Souza', 'Responsável 1 - E-mail': 'carlos.souza@exemplo.com', 'Responsável 1 - Parentesco': 'Pai',
  'Ano letivo': '2027', 'Ano escolar / série': '7º ano',
};

export const TEACHER_IMPORT_EXAMPLE: Record<string, string> = {
  'Nome completo': 'João Silva', 'E-mail': 'joao.silva@exemplo.com', Telefone: '(71) 99999-0000',
  Disciplinas: 'Matemática; Física', 'Disciplina principal': 'Matemática',
  'Disponibilidade 1 - Dia': 'Segunda', 'Disponibilidade 1 - Início': '07:00', 'Disponibilidade 1 - Fim': '12:00',
  'Disponibilidade 2 - Dia': 'Terça', 'Disponibilidade 2 - Início': '07:00', 'Disponibilidade 2 - Fim': '12:00',
};

export async function ensureSubjectsForTeacherImport(institutionId: string): Promise<SubjectRow[]> {
  return subjectService.list(institutionId);
}
