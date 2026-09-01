import { normalizeAcademicShift } from './academicShifts';
import {
  normalizeTimetablePolicy,
  type TimetablePolicySettings,
} from './timetablePolicy';

export type PreparationIssueSeverity = 'BLOCKER' | 'WARNING';

export interface PreparationIssue {
  code: string;
  severity: PreparationIssueSeverity;
  message: string;
  action: string;
}

export interface PreparationClassSummary {
  id: string;
  name: string;
  shift: string | null;
  students: number;
  capacity: number;
  weeklyLessons: number;
  compatibleSlots: number;
  assignedRooms: number;
  roomCapacity: number | null;
  issues: PreparationIssue[];
}

export interface TimetablePreparationInput {
  institutionId: string;
  academicYearId: string;
  shift?: string;
  policy?: Partial<TimetablePolicySettings> | null;
  enabledShifts?: string[];
  terms: Array<{ id: string; active?: boolean | null }>;
  classes: Array<{ id: string; name: string; shift: string | null; capacity: number; active?: boolean | null; academic_year_id?: string }>;
  enrollments: Array<{ class_id: string; academic_year_id: string; active?: boolean | null; status?: string | null }>;
  curriculumItems: Array<{ class_id: string; subject_id: string; weekly_lessons: number; is_complementary?: boolean | null; active?: boolean | null }>;
  subjectNames?: Record<string, string>;
  offerings: Array<{ class_id: string; subject_id: string; teacher_profile_id: string; term_id: string; active?: boolean | null }>;
  teacherSubjects: Array<{ teacher_profile_id: string; subject_id: string; active?: boolean | null }>;
  teacherAvailability: Array<{ teacher_profile_id: string; day_of_week: number; start_time: string; end_time: string; active?: boolean | null }>;
  slots: Array<{ shift: string; day_of_week: number; start_time: string; end_time: string; active?: boolean | null }>;
  breaks: Array<{ shift: string; day_of_week: number; start_time: string; end_time: string; active?: boolean | null }>;
  rooms: Array<{ id: string; class_id?: string | null; capacity?: number | null; active?: boolean | null }>;
}

export interface TimetablePreparationReport {
  ready: boolean;
  policy: TimetablePolicySettings;
  selectedShift: string | null;
  activeTerms: number;
  classes: PreparationClassSummary[];
  totals: {
    classes: number;
    students: number;
    weeklyLessons: number;
    teachers: number;
    rooms: number;
    sharedRooms: number;
    slots: number;
    breaks: number;
  };
  blockers: PreparationIssue[];
  warnings: PreparationIssue[];
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  return timeToMinutes(leftStart) < timeToMinutes(rightEnd) && timeToMinutes(rightStart) < timeToMinutes(leftEnd);
}

function isActive(value: boolean | null | undefined): boolean {
  return value !== false;
}

function normalizedStudentStatus(status: string | null | undefined): string {
  return String(status ?? 'active').trim().toLocaleLowerCase('pt-BR');
}

function isActiveEnrollment(enrollment: TimetablePreparationInput['enrollments'][number]): boolean {
  return isActive(enrollment.active) && !['cancelled', 'canceled', 'inactive', 'transferred', 'withdrawn'].includes(normalizedStudentStatus(enrollment.status));
}

function issue(code: string, severity: PreparationIssueSeverity, message: string, action: string): PreparationIssue {
  return { code, severity, message, action };
}

function displaySubjectName(input: TimetablePreparationInput, subjectId: string): string {
  const name = input.subjectNames?.[subjectId]?.trim();
  return name || 'disciplina não identificada';
}

function compatibleSlotsForClass(
  input: TimetablePreparationInput,
  classRecord: TimetablePreparationInput['classes'][number],
  policy: TimetablePolicySettings,
): TimetablePreparationInput['slots'] {
  const classShift = classRecord.shift ? normalizeAcademicShift(classRecord.shift) : null;
  return input.slots.filter((slot) => {
    if (!isActive(slot.active) || !policy.schoolDays.includes(slot.day_of_week)) return false;
    if (classShift && normalizeAcademicShift(slot.shift) !== classShift) return false;
    return !input.breaks.some((scheduleBreak) =>
      isActive(scheduleBreak.active) &&
      normalizeAcademicShift(scheduleBreak.shift) === normalizeAcademicShift(slot.shift) &&
      scheduleBreak.day_of_week === slot.day_of_week &&
      overlaps(slot.start_time, slot.end_time, scheduleBreak.start_time, scheduleBreak.end_time),
    );
  });
}

export function buildTimetablePreparationReport(input: TimetablePreparationInput): TimetablePreparationReport {
  const policy = normalizeTimetablePolicy(input.policy);
  const selectedShift = input.shift && input.shift !== 'TODOS'
    ? normalizeAcademicShift(input.shift)
    : null;
  const activeTerms = input.terms.filter((term) => isActive(term.active));
  const classes = input.classes.filter((classRecord) =>
    isActive(classRecord.active) &&
    (!classRecord.academic_year_id || classRecord.academic_year_id === input.academicYearId) &&
    (!selectedShift || normalizeAcademicShift(classRecord.shift ?? 'MATUTINO') === selectedShift),
  );
  const activeCurriculum = input.curriculumItems.filter((item) => isActive(item.active) && item.weekly_lessons > 0);
  const activeClassIds = new Set(classes.map((classRecord) => classRecord.id));
  const activeOfferings = input.offerings.filter((offering) =>
    isActive(offering.active) &&
    activeClassIds.has(offering.class_id) &&
    activeTerms.some((term) => term.id === offering.term_id),
  );
  const activeSkills = input.teacherSubjects.filter((skill) => isActive(skill.active));
  const qualifiedSubjectIds = new Set(activeSkills.map((skill) => skill.subject_id));
  const activeRooms = input.rooms.filter((room) => isActive(room.active));
  const enabledShifts = input.enabledShifts?.map((shift) => normalizeAcademicShift(shift)) ?? null;
  const sharedRooms = activeRooms.filter((room) => !room.class_id);
  const allIssues: PreparationIssue[] = [];

  if (activeTerms.length === 0) {
    allIssues.push(issue('TERMS_REQUIRED', 'BLOCKER', 'O ano letivo não possui períodos ativos.', 'Cadastre pelo menos um período no ano letivo.'));
  }
  if (classes.length === 0) {
    allIssues.push(issue('CLASSES_REQUIRED', 'BLOCKER', 'Nenhuma turma ativa foi encontrada para este ano e turno.', 'Cadastre as turmas ou selecione outro turno.'));
  }

  const classSummaries = classes.map((classRecord): PreparationClassSummary => {
    const classCurriculum = activeCurriculum.filter((item) => item.class_id === classRecord.id);
    const generationCurriculum = classCurriculum.filter((item) => !item.is_complementary || qualifiedSubjectIds.has(item.subject_id));
    const weeklyLessons = generationCurriculum.reduce((total, item) => total + item.weekly_lessons, 0);
    const students = input.enrollments.filter((enrollment) =>
      enrollment.class_id === classRecord.id &&
      enrollment.academic_year_id === input.academicYearId &&
      isActiveEnrollment(enrollment),
    ).length;
    const classRooms = activeRooms.filter((room) => room.class_id === classRecord.id);
    const usableRooms = classRooms.length > 0 ? classRooms : (policy.allowSharedRooms ? sharedRooms : []);
    const compatibleSlots = compatibleSlotsForClass(input, classRecord, policy);
    const classIssues: PreparationIssue[] = [];

    if (!classRecord.shift?.trim()) {
      classIssues.push(issue('CLASS_SHIFT_REQUIRED', 'BLOCKER', `${classRecord.name} não possui turno definido.`, 'Defina o turno da turma antes de gerar.'));
    } else if (enabledShifts && !enabledShifts.includes(normalizeAcademicShift(classRecord.shift))) {
      classIssues.push(issue('CLASS_SHIFT_NOT_ENABLED', 'BLOCKER', `${classRecord.name} usa um turno que não está habilitado para a escola.`, 'Habilite o turno na Política acadêmica ou edite o turno da turma.'));
    }
    if (classCurriculum.length === 0) {
      classIssues.push(issue('CURRICULUM_REQUIRED', 'BLOCKER', `${classRecord.name} não possui matérias com carga semanal.`, 'Aplique uma matriz curricular ou cadastre as matérias da turma.'));
    }
    if (weeklyLessons > policy.maxLessonsPerDay * policy.schoolDays.length) {
      classIssues.push(issue('CLASS_WEEKLY_CAPACITY', 'BLOCKER', `${classRecord.name} precisa de ${weeklyLessons} aulas semanais, acima da capacidade configurada.`, 'Aumente os horários do turno ou revise a carga da matriz.'));
    }
    if (compatibleSlots.length > 0 && compatibleSlots.length < weeklyLessons) {
      classIssues.push(issue('SCHOOL_SLOT_CAPACITY', 'WARNING', `${classRecord.name} precisa de ${weeklyLessons} horários compatíveis, mas há apenas ${compatibleSlots.length} configurado(s).`, 'O gerador tentará completar os horários padrão; revise o resultado antes de publicar.'));
    } else if (compatibleSlots.length === 0) {
      classIssues.push(issue('SCHOOL_SLOTS_WILL_BE_CREATED', 'WARNING', `${classRecord.name} ainda não possui horários cadastrados para o turno.`, 'O gerador tentará criar horários padrão; confirme a rotina da escola antes de publicar.'));
    }
    if (students > classRecord.capacity) {
      classIssues.push(issue('CLASS_CAPACITY_EXCEEDED', 'BLOCKER', `${classRecord.name} possui ${students} alunos para uma capacidade de ${classRecord.capacity}.`, 'Aumente a capacidade da turma ou redistribua os alunos.'));
    }
    if (usableRooms.length === 0) {
      classIssues.push(issue('ROOMS_WILL_BE_CREATED', 'WARNING', `${classRecord.name} não possui sala exclusiva nem sala compartilhada disponível.`, 'A preparação automática criará uma sala vinculada à turma antes da geração.'));
    }
    const roomCapacities = usableRooms.map((room) => room.capacity).filter((capacity): capacity is number => typeof capacity === 'number');
    if (students > 0 && roomCapacities.length > 0 && Math.max(...roomCapacities) < students) {
      classIssues.push(issue('ROOM_CAPACITY_INSUFFICIENT', 'BLOCKER', `${classRecord.name} possui ${students} alunos, mas nenhuma sala disponível comporta a turma.`, 'Aumente a capacidade da sala ou redistribua os alunos.'));
    }

    for (const curriculum of classCurriculum) {
      const subjectName = displaySubjectName(input, curriculum.subject_id);
      const offerings = activeOfferings.filter((offering) => offering.class_id === classRecord.id && offering.subject_id === curriculum.subject_id);
      const qualifiedTeachers = [...new Set(activeSkills.filter((skill) => skill.subject_id === curriculum.subject_id).map((skill) => skill.teacher_profile_id))];
      if (qualifiedTeachers.length === 0) {
        if (curriculum.is_complementary) {
          classIssues.push(issue('COMPLEMENTARY_TEACHER_MISSING', 'WARNING', `${classRecord.name} possui a matéria complementar ${subjectName} sem professor qualificado; ela ficará fora da geração.`, 'Vincule um professor habilitado se essa matéria precisar entrar na grade.'));
          continue;
        }
        classIssues.push(issue('TEACHER_COVERAGE_MISSING', 'BLOCKER', `${classRecord.name} não possui professor vinculado à matéria ${subjectName}.`, 'Vincule um professor à matéria em Usuários > Professores.'));
        continue;
      }
      const qualifiedTeacherIds = new Set(qualifiedTeachers);
      const invalidOffering = offerings.find((offering) => !qualifiedTeacherIds.has(offering.teacher_profile_id));
      if (invalidOffering) {
        classIssues.push(issue(
          'TEACHER_SUBJECT_NOT_AUTHORIZED',
          'BLOCKER',
          `${classRecord.name} possui uma atribuição da matéria ${subjectName} com professor não habilitado.`,
          'Habilite a matéria para o professor ou troque o professor da atribuição.',
        ));
        continue;
      }
      if (offerings.length < activeTerms.length) {
        classIssues.push(issue('ASSIGNMENT_WILL_BE_CREATED', 'WARNING', `${classRecord.name} ainda precisa de atribuição em ${activeTerms.length - offerings.length} período(s).`, 'A geração poderá criar as atribuições usando os professores qualificados.'));
      }
      if (policy.requireTeacherAvailability) {
        const teacherIds = offerings.length > 0
          ? [...new Set(offerings.map((offering) => offering.teacher_profile_id))]
          : qualifiedTeachers;
        const availableSlotCount = (teacherId: string) => compatibleSlots.filter((slot) =>
          input.teacherAvailability.some((availability) =>
            isActive(availability.active) &&
            availability.teacher_profile_id === teacherId &&
            availability.day_of_week === slot.day_of_week &&
            timeToMinutes(availability.start_time) <= timeToMinutes(slot.start_time) &&
            timeToMinutes(availability.end_time) >= timeToMinutes(slot.end_time),
          ),
        ).length;
        const teacherAvailabilityCounts = teacherIds.map((teacherId) => availableSlotCount(teacherId));
        if (teacherAvailabilityCounts.length === 0 || teacherAvailabilityCounts.every((count) => count === 0)) {
          classIssues.push(issue('TEACHER_AVAILABILITY_MISSING', 'BLOCKER', `${classRecord.name} não possui disponibilidade compatível para a matéria ${subjectName}.`, 'Cadastre a disponibilidade semanal do professor.'));
        } else if (compatibleSlots.length >= weeklyLessons && (offerings.length > 0
          ? teacherAvailabilityCounts.some((count) => count < weeklyLessons)
          : teacherAvailabilityCounts.every((count) => count < weeklyLessons))) {
          classIssues.push(issue('TEACHER_AVAILABILITY_CAPACITY', 'BLOCKER', `${classRecord.name} não possui disponibilidade suficiente para cumprir as ${weeklyLessons} aulas semanais da matéria ${subjectName}.`, 'Amplie a disponibilidade do professor ou distribua a matéria entre mais professores.'));
        }
      }
    }

    const summary = {
      id: classRecord.id,
      name: classRecord.name,
      shift: classRecord.shift,
      students,
      capacity: classRecord.capacity,
      weeklyLessons,
      compatibleSlots: compatibleSlots.length,
      assignedRooms: classRooms.length,
      roomCapacity: usableRooms.length > 0
        ? Math.max(...usableRooms.map((room) => room.capacity ?? 0)) || null
        : null,
      issues: classIssues,
    };
    allIssues.push(...classIssues);
    return summary;
  });

  const teacherIds = new Set(activeSkills.map((skill) => skill.teacher_profile_id));
  const teacherLoads = new Map<string, number>();
  const countedTeacherAssignments = new Set<string>();
  for (const offering of activeOfferings) {
    const curriculum = activeCurriculum.find((item) => item.class_id === offering.class_id && item.subject_id === offering.subject_id);
    if (!curriculum) continue;
    if (curriculum.is_complementary && !qualifiedSubjectIds.has(curriculum.subject_id)) continue;
    const assignmentKey = `${offering.class_id}:${offering.subject_id}:${offering.teacher_profile_id}`;
    if (countedTeacherAssignments.has(assignmentKey)) continue;
    countedTeacherAssignments.add(assignmentKey);
    teacherLoads.set(
      offering.teacher_profile_id,
      (teacherLoads.get(offering.teacher_profile_id) ?? 0) + curriculum.weekly_lessons,
    );
  }
  for (const [teacherId, weeklyLessons] of teacherLoads) {
    if (weeklyLessons > policy.maxTeacherLessonsPerWeek) {
      const teacherIssue = issue('TEACHER_WEEKLY_CAPACITY', 'BLOCKER', `O professor ${teacherId} ultrapassa a carga semanal máxima de ${policy.maxTeacherLessonsPerWeek} aulas.`, 'Distribua a matéria entre mais professores.');
      allIssues.push(teacherIssue);
    }
  }

  const blockers = allIssues.filter((item) => item.severity === 'BLOCKER');
  const warnings = allIssues.filter((item) => item.severity === 'WARNING');
  return {
    ready: blockers.length === 0,
    policy,
    selectedShift,
    activeTerms: activeTerms.length,
    classes: classSummaries,
    totals: {
      classes: classes.length,
      students: classSummaries.reduce((total, item) => total + item.students, 0),
      weeklyLessons: classSummaries.reduce((total, item) => total + item.weeklyLessons, 0),
      teachers: teacherIds.size,
      rooms: activeRooms.length,
      sharedRooms: sharedRooms.length,
      slots: input.slots.filter((slot) => isActive(slot.active)).length,
      breaks: input.breaks.filter((scheduleBreak) => isActive(scheduleBreak.active)).length,
    },
    blockers,
    warnings,
  };
}
