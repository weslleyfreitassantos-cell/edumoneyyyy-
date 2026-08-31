import type { AcademicYearRow } from './academicStructureService';
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
  'full_name', 'email', 'birth_date', 'cpf', 'social_name', 'rg',
  'rg_issuing_authority', 'rg_state', 'birth_certificate', 'nationality',
  'birthplace', 'birth_state', 'sex', 'phone', 'postal_code', 'street',
  'number', 'complement', 'neighborhood', 'city', 'state', 'rural_zone',
  'guardian_1_profile_id', 'guardian_1_full_name', 'guardian_1_email',
  'guardian_1_phone', 'guardian_1_relationship', 'guardian_1_is_primary',
  'guardian_2_profile_id', 'guardian_2_full_name', 'guardian_2_email',
  'guardian_2_phone', 'guardian_2_relationship', 'guardian_2_is_primary',
  'origin_school', 'origin_network', 'origin_city', 'origin_state',
  'last_grade', 'origin_year', 'origin_status', 'origin_observations',
  'history_delivered', 'transfer_declaration', 'allergies',
  'health_conditions', 'emergency_medication', 'disability', 'autism',
  'giftedness', 'needs_special_education', 'school_care_notes',
  'academic_year', 'academic_year_id', 'class', 'class_id', 'enrolled_at',
  ...[
    'certidao_nascimento', 'rg_document', 'cpf_document',
    'comprovante_endereco', 'historico_escolar', 'declaracao_transferencia',
    'carteira_vacinacao', 'laudo_relatorio', 'foto_3x4', 'outros',
  ].flatMap((key) => [`${key}_status`, `${key}_notes`]),
] as const;

export const TEACHER_IMPORT_HEADERS = [
  'full_name', 'email', 'phone', 'subjects', 'primary_subject',
  ...Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    return [`availability_${slot}_day`, `availability_${slot}_start`, `availability_${slot}_end`];
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
  return studentDocumentFields.map(({ type, key }) => ({
    document_type: type,
    status: documentStatus(value(row, [`${key}_status`]), `${type} - status`, errors),
    notes: value(row, [`${key}_notes`]),
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
    'data_matricula', 'ra', 'registration_number', 'arquivo_documento', 'foto',
  ].map((header) => normalizeSpreadsheetHeader(header)));
}

function teacherKnownHeaders(): Set<string> {
  return new Set([
    ...TEACHER_IMPORT_HEADERS,
    'nome', 'nome_completo', 'e_mail', 'telefone', 'disciplinas', 'materias',
    'disciplina_principal', 'materia_principal',
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
  options: { years: AcademicYearRow[]; classes: ClassRow[] },
): { previews: ImportPreview<StudentImportPreviewData>[]; unknownHeaders: string[] } {
  const previews = parsed.rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = value(row, ['full_name', 'nome_completo', 'nome']);
    const email = value(row, ['email', 'e_mail']);
    const birthDate = dateOrError(value(row, ['birth_date', 'data_nascimento', 'nascimento']), 'Data de nascimento', errors, true);
    const yearInput = value(row, ['academic_year_id', 'academic_year', 'ano_letivo', 'ano']);
    const classInput = value(row, ['class_id', 'class', 'turma']);
    const year = resolveYear(yearInput, options.years);
    const classRow = resolveClass(classInput, year, options.classes);

    required(fullName, 'Nome completo', errors);
    required(email, 'E-mail', errors);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('E-mail inválido.');
    if (yearInput && !year) errors.push('Ano letivo não encontrado nesta instituição.');
    if (classInput && !classRow) errors.push('Turma não encontrada para o ano letivo informado.');
    if (!year) errors.push('Ano letivo é obrigatório (use o nome ou ID).');
    if (!classRow) errors.push('Turma é obrigatória (use o nome ou ID).');

    const guardians = [1, 2].flatMap((index) => {
      const prefix = `guardian_${index}`;
      const profileId = value(row, [`${prefix}_profile_id`, `responsavel_${index}_profile_id`]);
      const guardianName = value(row, [`${prefix}_full_name`, `${prefix}_name`, `responsavel_${index}_nome`]);
      const guardianEmail = value(row, [`${prefix}_email`, `responsavel_${index}_email`]);
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
        is_primary: parseOptionalBoolean(value(row, [`${prefix}_is_primary`]), `Responsável ${index}: principal`, errors) ?? index === 1,
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
      rg_state: value(row, ['rg_state', 'uf_rg']),
      birth_certificate: value(row, ['birth_certificate', 'certidao_nascimento']),
      nationality: value(row, ['nationality', 'nacionalidade']) || 'Brasileira',
      birthplace: value(row, ['birthplace', 'naturalidade']),
      birth_state: value(row, ['birth_state', 'uf_nascimento']),
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
        origin_school: value(row, ['origin_school', 'escola_origem']), origin_network: value(row, ['origin_network', 'rede_origem']),
        city: value(row, ['origin_city', 'cidade_origem']), state: value(row, ['origin_state', 'uf_origem']),
        last_grade: value(row, ['last_grade', 'ultimo_ano']), origin_year: value(row, ['origin_year', 'ano_origem']),
        status: value(row, ['origin_status', 'status_origem']), observations: value(row, ['origin_observations', 'observacoes_origem']),
        history_delivered: parseBoolean(value(row, ['history_delivered', 'historico_entregue']), 'Histórico entregue', errors),
        transfer_declaration: parseBoolean(value(row, ['transfer_declaration', 'declaracao_transferencia']), 'Declaração de transferência', errors),
      },
      health: {
        allergies: value(row, ['allergies', 'alergias']), health_conditions: value(row, ['health_conditions', 'condicoes_saude']),
        emergency_medication: value(row, ['emergency_medication', 'medicacao_emergencia']), disability: value(row, ['disability', 'deficiencia']),
        autism: parseBoolean(value(row, ['autism', 'tea']), 'Autismo/TEA', errors), giftedness: parseBoolean(value(row, ['giftedness', 'altas_habilidades']), 'Altas habilidades', errors),
        needs_special_education: parseBoolean(value(row, ['needs_special_education', 'educacao_especial']), 'Educação especial', errors),
        school_care_notes: value(row, ['school_care_notes', 'observacoes_cuidado']),
      },
      documents: buildDocuments(row, errors),
      academic_year_id: year?.id ?? '',
      class_id: classRow?.id ?? '',
      enrolled_at: dateOrError(value(row, ['enrolled_at', 'data_matricula']) || new Date().toISOString().slice(0, 10), 'Data da matrícula', errors),
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
  full_name: 'Ana Souza', email: 'ana.souza@exemplo.com', birth_date: '2016-03-12', cpf: '12345678900',
  guardian_1_full_name: 'Carlos Souza', guardian_1_email: 'carlos.souza@exemplo.com', guardian_1_relationship: 'Pai',
  academic_year: '2027', class: '7º A',
};

export const TEACHER_IMPORT_EXAMPLE: Record<string, string> = {
  full_name: 'João Silva', email: 'joao.silva@exemplo.com', phone: '(71) 99999-0000',
  subjects: 'Matemática; Física', primary_subject: 'Matemática',
  availability_1_day: 'Segunda', availability_1_start: '07:00', availability_1_end: '12:00',
  availability_2_day: 'Terça', availability_2_start: '07:00', availability_2_end: '12:00',
};

export async function ensureSubjectsForTeacherImport(institutionId: string): Promise<SubjectRow[]> {
  return subjectService.list(institutionId);
}
