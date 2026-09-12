import { supabase } from '../lib/supabaseClient';
import {
  academicPolicyService,
  type AcademicYearOption,
} from './academicPolicyService';
import {
  pedagogicalMonitoringService,
  type PedagogicalStudentSummary,
} from './pedagogicalMonitoringService';

export const CLASS_COUNCIL_STATUSES = [
  'DRAFT',
  'OPEN',
  'COMPLETED',
  'CANCELED',
] as const;

export type ClassCouncilStatus = (typeof CLASS_COUNCIL_STATUSES)[number];
export type ClassCouncilParticipantRole = 'DIRECTOR' | 'SECRETARY' | 'TEACHER';
export type ClassCouncilFollowUpCategory =
  | 'NONE'
  | 'MONITOR'
  | 'INDIVIDUAL_PLAN'
  | 'FAMILY_MEETING'
  | 'REFERRAL'
  | 'OTHER';

export interface ClassCouncil {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearName: string;
  termId: string;
  termName: string;
  termStartDate: string;
  termEndDate: string;
  classId: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  status: ClassCouncilStatus;
  scheduledAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  reopenedAt: string | null;
  generalNotes: string | null;
  createdBy: string;
  openedBy: string | null;
  completedBy: string | null;
  canceledBy: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassCouncilParticipant {
  id: string;
  institutionId: string;
  councilId: string;
  profileId: string;
  participantRole: ClassCouncilParticipantRole;
  profileName: string;
  profileEmail: string;
  createdAt: string;
}

export interface ClassCouncilStudentNote {
  id: string;
  institutionId: string;
  councilId: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  snapshotAt: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  lowPerformanceSubjects: number;
  lowAttendanceSubjects: number;
  pendingItems: number;
  riskLevel: 'NORMAL' | 'ATTENTION' | 'CRITICAL';
  riskReasons: string[];
  dataStatus: 'PARTIAL' | 'OFFICIAL';
  teacherContributions: Record<string, string>;
  observation: string | null;
  resolution: string | null;
  followUpCategory: ClassCouncilFollowUpCategory | null;
  followUpText: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassCouncilDetails {
  council: ClassCouncil;
  participants: ClassCouncilParticipant[];
  studentNotes: ClassCouncilStudentNote[];
}

export interface ClassCouncilListFilters {
  academicYearId?: string;
  termId?: string;
  classId?: string;
  status?: ClassCouncilStatus | 'ALL';
}

export interface ClassCouncilContextOptions {
  years: AcademicYearOption[];
  classes: Array<{
    id: string;
    academicYearId: string;
    name: string;
    gradeLevel: string | null;
    shift: string | null;
  }>;
}

export interface ClassCouncilEligibleParticipant {
  profileId: string;
  profileName: string;
  profileEmail: string;
  role: ClassCouncilParticipantRole;
}

export interface CreateClassCouncilInput {
  institutionId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  scheduledAt?: string | null;
  generalNotes?: string | null;
}

export interface UpdateClassCouncilInput {
  councilId: string;
  scheduledAt?: string | null;
  generalNotes?: string | null;
}

export interface UpdateClassCouncilStudentNoteInput {
  councilId: string;
  studentId: string;
  observation?: string | null;
  resolution?: string | null;
  followUpCategory?: ClassCouncilFollowUpCategory | null;
  followUpText?: string | null;
  teacherContribution?: string | null;
}

interface CouncilRow {
  id: string;
  institution_id: string;
  academic_year_id: string;
  term_id: string;
  class_id: string;
  status: string;
  scheduled_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  reopened_at: string | null;
  general_notes: string | null;
  created_by: string;
  opened_by: string | null;
  completed_by: string | null;
  canceled_by: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
  classes: ClassRow | ClassRow[] | null;
  academic_years: YearRow | YearRow[] | null;
  terms: TermRow | TermRow[] | null;
}

interface ClassRow {
  id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
}

interface YearRow {
  id: string;
  name: string;
}

interface TermRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface ParticipantRow {
  id: string;
  institution_id: string;
  council_id: string;
  profile_id: string;
  participant_role: ClassCouncilParticipantRole;
  created_at: string;
  profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

interface StudentNoteRow {
  id: string;
  institution_id: string;
  council_id: string;
  student_id: string;
  student_name: string;
  registration_number: string;
  class_name: string;
  snapshot_at: string;
  average_grade: number | string | null;
  attendance_percentage: number | string | null;
  low_performance_subjects: number;
  low_attendance_subjects: number;
  pending_items: number;
  risk_level: 'NORMAL' | 'ATTENTION' | 'CRITICAL';
  risk_reasons: string[] | null;
  data_status: 'PARTIAL' | 'OFFICIAL';
  teacher_contributions: Record<string, string> | null;
  observation: string | null;
  resolution: string | null;
  follow_up_category: ClassCouncilFollowUpCategory | null;
  follow_up_text: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MembershipParticipantRow {
  profile_id: string;
  role: ClassCouncilParticipantRole;
  profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

interface ContextClassRow {
  id: string;
  academic_year_id: string;
  name: string;
  grade_level: string | null;
  shift: string | null;
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function status(value: string): ClassCouncilStatus {
  return CLASS_COUNCIL_STATUSES.includes(value as ClassCouncilStatus)
    ? value as ClassCouncilStatus
    : 'DRAFT';
}

function normalizeCouncil(row: CouncilRow): ClassCouncil {
  const classRow = relation(row.classes);
  const yearRow = relation(row.academic_years);
  const termRow = relation(row.terms);
  return {
    id: row.id,
    institutionId: row.institution_id,
    academicYearId: row.academic_year_id,
    academicYearName: yearRow?.name ?? 'Ano letivo',
    termId: row.term_id,
    termName: termRow?.name ?? 'Período',
    termStartDate: termRow?.start_date ?? '',
    termEndDate: termRow?.end_date ?? '',
    classId: row.class_id,
    className: classRow?.name ?? 'Turma',
    gradeLevel: classRow?.grade_level ?? null,
    shift: classRow?.shift ?? null,
    status: status(row.status),
    scheduledAt: row.scheduled_at,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    reopenedAt: row.reopened_at,
    generalNotes: row.general_notes,
    createdBy: row.created_by,
    openedBy: row.opened_by,
    completedBy: row.completed_by,
    canceledBy: row.canceled_by,
    reopenedBy: row.reopened_by,
    reopenReason: row.reopen_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeParticipant(row: ParticipantRow): ClassCouncilParticipant {
  const profile = relation(row.profiles);
  return {
    id: row.id,
    institutionId: row.institution_id,
    councilId: row.council_id,
    profileId: row.profile_id,
    participantRole: row.participant_role,
    profileName: profile?.full_name ?? 'Participante',
    profileEmail: profile?.email ?? '',
    createdAt: row.created_at,
  };
}

function normalizeStudentNote(row: StudentNoteRow): ClassCouncilStudentNote {
  return {
    id: row.id,
    institutionId: row.institution_id,
    councilId: row.council_id,
    studentId: row.student_id,
    studentName: row.student_name,
    registrationNumber: row.registration_number,
    className: row.class_name,
    snapshotAt: row.snapshot_at,
    averageGrade: numberOrNull(row.average_grade),
    attendancePercentage: numberOrNull(row.attendance_percentage),
    lowPerformanceSubjects: row.low_performance_subjects,
    lowAttendanceSubjects: row.low_attendance_subjects,
    pendingItems: row.pending_items,
    riskLevel: row.risk_level,
    riskReasons: row.risk_reasons ?? [],
    dataStatus: row.data_status,
    teacherContributions: row.teacher_contributions ?? {},
    observation: row.observation,
    resolution: row.resolution,
    followUpCategory: row.follow_up_category,
    followUpText: row.follow_up_text,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureData<T>(data: T | T[] | null, label: string): T {
  if (data === null) throw new Error(`Não foi possível carregar ${label}.`);
  return data as T;
}

async function callCouncilRpc<T>(name: string, args: Record<string, unknown>, label: string): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || `Não foi possível ${label}.`);
  return ensureData(data as T | null, label);
}

function snapshotFromStudent(student: PedagogicalStudentSummary) {
  return {
    student_id: student.studentId,
    full_name: student.fullName,
    registration_number: student.registrationNumber,
    class_id: student.classId,
    class_name: student.className,
    average_grade: student.averageGrade,
    attendance_percentage: student.attendancePercentage,
    low_performance_subjects: student.lowPerformanceSubjects,
    low_attendance_subjects: student.lowAttendanceSubjects,
    pending_items: student.pendingItems,
    risk_level: student.risk.level,
    risk_reasons: student.risk.reasons,
    data_status: student.dataStatus,
  };
}

export const classCouncilService = {
  async list(institutionId: string, filters: ClassCouncilListFilters = {}): Promise<ClassCouncil[]> {
    let query = supabase
      .from('class_councils')
      .select(`
        id, institution_id, academic_year_id, term_id, class_id, status,
        scheduled_at, opened_at, completed_at, canceled_at, reopened_at,
        general_notes, created_by, opened_by, completed_by, canceled_by,
        reopened_by, reopen_reason, created_at, updated_at,
        classes (id, academic_year_id, name, grade_level, shift),
        academic_years (id, name),
        terms (id, name, start_date, end_date)
      `)
      .eq('institution_id', institutionId)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (filters.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);
    if (filters.termId) query = query.eq('term_id', filters.termId);
    if (filters.classId) query = query.eq('class_id', filters.classId);
    if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as CouncilRow[]).map(normalizeCouncil);
  },

  async getDetails(councilId: string): Promise<ClassCouncilDetails> {
    const { data, error } = await supabase
      .from('class_councils')
      .select(`
        id, institution_id, academic_year_id, term_id, class_id, status,
        scheduled_at, opened_at, completed_at, canceled_at, reopened_at,
        general_notes, created_by, opened_by, completed_by, canceled_by,
        reopened_by, reopen_reason, created_at, updated_at,
        classes (id, academic_year_id, name, grade_level, shift),
        academic_years (id, name),
        terms (id, name, start_date, end_date)
      `)
      .eq('id', councilId)
      .single();
    if (error) throw new Error(error.message);
    const council = normalizeCouncil(data as unknown as CouncilRow);
    const [participants, notes] = await Promise.all([
      supabase.from('class_council_participants').select('id, institution_id, council_id, profile_id, participant_role, created_at, profiles (full_name, email)').eq('council_id', councilId).order('created_at'),
      supabase.from('class_council_student_notes').select('*').eq('council_id', councilId).order('risk_level').order('student_name'),
    ]);
    if (participants.error) throw new Error(participants.error.message);
    if (notes.error) throw new Error(notes.error.message);
    return {
      council,
      participants: ((participants.data ?? []) as unknown as ParticipantRow[]).map(normalizeParticipant),
      studentNotes: ((notes.data ?? []) as unknown as StudentNoteRow[]).map(normalizeStudentNote),
    };
  },

  async listContextOptions(institutionId: string): Promise<ClassCouncilContextOptions> {
    const [years, classes] = await Promise.all([
      academicPolicyService.listAcademicYears(institutionId),
      supabase.from('classes').select('id, academic_year_id, name, grade_level, shift').eq('institution_id', institutionId).eq('active', true).order('name'),
    ]);
    if (classes.error) throw new Error(classes.error.message);
    return {
      years,
      classes: ((classes.data ?? []) as unknown as ContextClassRow[]).map((item) => ({
        id: item.id,
        academicYearId: item.academic_year_id,
        name: item.name,
        gradeLevel: item.grade_level,
        shift: item.shift,
      })),
    };
  },

  async listEligibleParticipants(institutionId: string): Promise<ClassCouncilEligibleParticipant[]> {
    const { data, error } = await supabase
      .from('memberships')
      .select('profile_id, role, profiles (full_name, email)')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .in('role', ['DIRECTOR', 'SECRETARY', 'TEACHER'])
      .order('role')
      .order('profile_id');
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as MembershipParticipantRow[])
      .map((row) => {
        const profile = relation(row.profiles);
        return {
          profileId: row.profile_id,
          profileName: profile?.full_name ?? 'Participante',
          profileEmail: profile?.email ?? '',
          role: row.role,
        };
      });
  },

  async create(input: CreateClassCouncilInput): Promise<ClassCouncil> {
    const row = await callCouncilRpc<CouncilRow>('create_class_council', {
      p_institution_id: input.institutionId,
      p_academic_year_id: input.academicYearId,
      p_term_id: input.termId,
      p_class_id: input.classId,
      p_scheduled_at: input.scheduledAt ?? null,
      p_general_notes: input.generalNotes ?? null,
    }, 'criar o conselho de classe');
    return normalizeCouncil(row);
  },

  async update(input: UpdateClassCouncilInput): Promise<ClassCouncil> {
    const { data, error } = await supabase.from('class_councils').update({
      scheduled_at: input.scheduledAt ?? null,
      general_notes: input.generalNotes ?? null,
    }).eq('id', input.councilId).select(`
      id, institution_id, academic_year_id, term_id, class_id, status,
      scheduled_at, opened_at, completed_at, canceled_at, reopened_at,
      general_notes, created_by, opened_by, completed_by, canceled_by,
      reopened_by, reopen_reason, created_at, updated_at,
      classes (id, academic_year_id, name, grade_level, shift),
      academic_years (id, name), terms (id, name, start_date, end_date)
    `).single();
    if (error) throw new Error(error.message);
    return normalizeCouncil(data as unknown as CouncilRow);
  },

  async open(council: ClassCouncil): Promise<ClassCouncil> {
    const monitoring = await pedagogicalMonitoringService.getInstitutionMonitoring(council.institutionId, {
      academicYearId: council.academicYearId,
      termId: council.termId,
      classId: council.classId,
    });
    const snapshots = monitoring.students
      .filter((student) => student.classId === council.classId)
      .map(snapshotFromStudent);
    const row = await callCouncilRpc<CouncilRow>('open_class_council', {
      p_council_id: council.id,
      p_snapshots: snapshots,
    }, 'abrir o conselho de classe');
    return normalizeCouncil(row);
  },

  async complete(councilId: string): Promise<ClassCouncil> {
    const row = await callCouncilRpc<CouncilRow>('complete_class_council', { p_council_id: councilId }, 'concluir o conselho de classe');
    return normalizeCouncil(row);
  },

  async reopen(councilId: string, reason: string): Promise<ClassCouncil> {
    const row = await callCouncilRpc<CouncilRow>('reopen_class_council', { p_council_id: councilId, p_reason: reason }, 'reabrir o conselho de classe');
    return normalizeCouncil(row);
  },

  async cancel(councilId: string): Promise<ClassCouncil> {
    const row = await callCouncilRpc<CouncilRow>('cancel_class_council', { p_council_id: councilId }, 'cancelar o conselho de classe');
    return normalizeCouncil(row);
  },

  async addParticipant(councilId: string, profileId: string, role: ClassCouncilParticipantRole): Promise<void> {
    await callCouncilRpc<ParticipantRow>('add_class_council_participant', { p_council_id: councilId, p_profile_id: profileId, p_participant_role: role }, 'adicionar o participante');
  },

  async removeParticipant(participantId: string): Promise<void> {
    await callCouncilRpc<boolean>('remove_class_council_participant', { p_participant_id: participantId }, 'remover o participante');
  },

  async updateStudentNote(input: UpdateClassCouncilStudentNoteInput): Promise<ClassCouncilStudentNote> {
    const row = await callCouncilRpc<StudentNoteRow>('update_class_council_student_note', {
      p_council_id: input.councilId,
      p_student_id: input.studentId,
      p_observation: input.observation ?? null,
      p_resolution: input.resolution ?? null,
      p_follow_up_category: input.followUpCategory ?? null,
      p_follow_up_text: input.followUpText ?? null,
      p_teacher_contribution: input.teacherContribution,
    }, 'salvar a decisão pedagógica');
    return normalizeStudentNote(row);
  },
};
