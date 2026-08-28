import { normalizeAcademicShift } from './automaticPreparation';

export interface GeneratorTerm {
  id: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
}

export interface GeneratorClass {
  id: string;
  institutionId: string;
  academicYearId: string;
  name: string;
  shift: string | null;
}

export interface GeneratorCurriculumItem {
  classId: string;
  subjectId: string;
  weeklyLessons: number;
  lessonDurationMinutes: number;
}

export interface GeneratorOffering {
  id: string;
  institutionId: string;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  termId: string;
}

export interface GeneratorTeacherSubject {
  institutionId: string;
  teacherProfileId: string;
  subjectId: string;
  active: boolean;
}

export interface GeneratorTeacherAvailability {
  institutionId: string;
  teacherProfileId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface GeneratorTimeSlot {
  id: string;
  institutionId: string;
  shift: string;
  dayOfWeek: number;
  slotNumber: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface GeneratorRoom {
  id: string;
  institutionId: string;
  classId?: string | null;
  active: boolean;
}

export interface GeneratorEntry {
  id?: string;
  institutionId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  subjectOfferingId: string;
  teacherProfileId: string;
  subjectId: string;
  roomId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locked: boolean;
}

export interface TimetableGeneratorInput {
  institutionId: string;
  academicYearId: string;
  termIds?: string[];
  terms: GeneratorTerm[];
  classes: GeneratorClass[];
  curriculumItems: GeneratorCurriculumItem[];
  subjectOfferings: GeneratorOffering[];
  teacherSubjects: GeneratorTeacherSubject[];
  teacherAvailability: GeneratorTeacherAvailability[];
  schoolTimeSlots: GeneratorTimeSlot[];
  rooms: GeneratorRoom[];
  lockedEntries?: GeneratorEntry[];
  subjectLabels?: Record<string, string>;
  requireWeekdayCoverage?: boolean;
  seed?: string;
}

export interface GeneratorDiagnostic {
  code: string;
  message: string;
  classId?: string;
  subjectId?: string;
  teacherProfileId?: string;
  suggestions: string[];
}

export interface TimetableGeneratorResult {
  valid: boolean;
  status: 'VALID' | 'UNSATISFIED' | 'INVALID';
  entries: GeneratorEntry[];
  hardConflicts: number;
  score: number;
  penalties: {
    teacherGaps: number;
    sameSubjectSameDay: number;
    roomChanges: number;
  };
  diagnostics: GeneratorDiagnostic[];
  seed: string;
}

interface Demand {
  classRecord: GeneratorClass;
  curriculum: GeneratorCurriculumItem;
  offering: GeneratorOffering;
  term: GeneratorTerm;
  occurrence: number;
}

interface Candidate {
  slot: GeneratorTimeSlot;
  roomId: string | null;
}

export const REQUIRED_SCHOOL_DAYS = [1, 2, 3, 4, 5] as const;

const SCHOOL_DAY_LABELS: Record<number, string> = {
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  return timeToMinutes(leftStart) < timeToMinutes(rightEnd) && timeToMinutes(rightStart) < timeToMinutes(leftEnd);
}

function termsOverlap(left: GeneratorTerm, right: GeneratorTerm): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compareIds(left: string, right: string, seed: string): number {
  const leftHash = stableHash(`${seed}:${left}`);
  const rightHash = stableHash(`${seed}:${right}`);
  return leftHash - rightHash || left.localeCompare(right);
}

function occupiedBy(entry: GeneratorEntry, candidate: Candidate, demand: Demand, terms: Map<string, GeneratorTerm>): boolean {
  if (entry.dayOfWeek !== candidate.slot.dayOfWeek || !overlaps(entry.startTime, entry.endTime, candidate.slot.startTime, candidate.slot.endTime)) {
    return false;
  }
  const existingTerm = terms.get(entry.termId);
  return Boolean(existingTerm && termsOverlap(existingTerm, demand.term));
}

function hasTeacherAvailability(input: TimetableGeneratorInput, demand: Demand, slot: GeneratorTimeSlot): boolean {
  const teacherAvailability = input.teacherAvailability.filter(
    (availability) =>
      availability.institutionId === input.institutionId &&
      availability.teacherProfileId === demand.offering.teacherProfileId,
  );

  // Availability is an operational constraint when it has been configured
  // for the teacher. An empty configuration must not block the structural
  // onboarding draft.
  if (teacherAvailability.length === 0) return true;

  return teacherAvailability.some((availability) =>
    availability.active &&
    availability.dayOfWeek === slot.dayOfWeek &&
    timeToMinutes(availability.startTime) <= timeToMinutes(slot.startTime) &&
    timeToMinutes(availability.endTime) >= timeToMinutes(slot.endTime),
  );
}

function slotsForClass(allSlots: GeneratorTimeSlot[], classRecord: GeneratorClass): GeneratorTimeSlot[] {
  const normalizedClassShift = classRecord.shift === null ? null : normalizeAcademicShift(classRecord.shift);
  const matchingSlots = allSlots.filter((slot) => normalizedClassShift === null || normalizeAcademicShift(slot.shift) === normalizedClassShift);
  if (!classRecord.shift) return matchingSlots;

  const exactShift = classRecord.shift.trim();
  const exactSlots = matchingSlots.filter((slot) => slot.shift.trim() === exactShift);
  return exactSlots.length > 0 ? exactSlots : matchingSlots;
}

function candidateRooms(input: TimetableGeneratorInput, entries: GeneratorEntry[], demand: Demand, candidate: Candidate, terms: Map<string, GeneratorTerm>): string[] {
  const rooms = input.rooms.filter((room) => room.active && room.institutionId === input.institutionId);
  if (rooms.length === 0) return [null as unknown as string];
  const assignedRooms = rooms.filter((room) => room.classId === demand.classRecord.id);
  const availableRooms = assignedRooms.length > 0 ? assignedRooms : rooms;
  return availableRooms
    .filter((room) => !entries.some((entry) => entry.roomId === room.id && occupiedBy(entry, candidate, demand, terms)))
    .map((room) => room.id);
}

function buildDiagnostics(input: TimetableGeneratorInput, demand: Demand, reason: string): GeneratorDiagnostic {
  const subjectLabel = input.subjectLabels?.[demand.curriculum.subjectId] ?? demand.curriculum.subjectId;
  return {
    code: 'UNSATISFIED',
    message: `${demand.classRecord.name}: ${subjectLabel} precisa de ${demand.curriculum.weeklyLessons} aulas; ${reason}`,
    classId: demand.classRecord.id,
    subjectId: demand.curriculum.subjectId,
    teacherProfileId: demand.offering.teacherProfileId,
    suggestions: ['Expand teacher availability.', 'Add or adjust school time slots.', 'Review the teacher assignment or weekly workload.'],
  };
}

function formatSchoolDays(days: number[]): string {
  const labels = days.map((day) => SCHOOL_DAY_LABELS[day] ?? `dia ${day}`);
  if (labels.length <= 1) return labels[0] ?? 'os dias obrigatórios';
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

function buildWeekdayCoverageDiagnostics(
  input: TimetableGeneratorInput,
  classes: Map<string, GeneratorClass>,
  demands: Demand[],
  entries: GeneratorEntry[],
  allSlots: GeneratorTimeSlot[],
): GeneratorDiagnostic[] {
  const diagnostics: GeneratorDiagnostic[] = [];
  const groups = new Set<string>();

  for (const demand of demands) {
    groups.add(`${demand.classRecord.id}:${demand.term.id}`);
  }
  for (const entry of entries) {
    groups.add(`${entry.classId}:${entry.termId}`);
  }

  for (const group of groups) {
    const [classId, termId] = group.split(':');
    const classRecord = classes.get(classId);
    if (!classRecord) continue;

    const groupDemands = demands.filter(
      (demand) => demand.classRecord.id === classId && demand.term.id === termId,
    );
    const groupEntries = entries.filter(
      (entry) => entry.classId === classId && entry.termId === termId,
    );
    const coveredDays = new Set(groupEntries.map((entry) => entry.dayOfWeek));
    const missingDays = REQUIRED_SCHOOL_DAYS.filter((day) => !coveredDays.has(day));
    if (missingDays.length === 0) continue;

    const expectedLessons = groupDemands.length + groupEntries.length;
    const capacityDays: number[] = [];
    const slotDays: number[] = [];
    const teacherDays: number[] = [];

    if (expectedLessons < REQUIRED_SCHOOL_DAYS.length) {
      diagnostics.push({
        code: 'WEEKDAY_COVERAGE_CAPACITY_INSUFFICIENT',
        message: `${classRecord.name} não cobre ${formatSchoolDays(missingDays)} porque a carga semanal tem apenas ${expectedLessons} aula(s), menos que os cinco dias obrigatórios.`,
        classId,
        suggestions: ['Confira a carga semanal da matriz curricular.', 'Distribua pelo menos uma aula em cada dia obrigatório.'],
      });
      continue;
    }

    for (const day of missingDays) {
      const daySlotsByDemand = groupDemands.map((demand) => ({
        demand,
        slots: slotsForClass(allSlots, demand.classRecord).filter(
          (slot) =>
            slot.dayOfWeek === day &&
            timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes,
        ),
      }));
      const daySlots = daySlotsByDemand.flatMap((item) => item.slots);

      if (daySlots.length === 0) {
        slotDays.push(day);
        continue;
      }

      const teacherAvailable = daySlotsByDemand.some(({ demand, slots }) =>
        slots.some((slot) => hasTeacherAvailability(input, demand, slot)),
      );
      if (!teacherAvailable) {
        teacherDays.push(day);
      } else {
        capacityDays.push(day);
      }
    }

    if (slotDays.length > 0) {
      diagnostics.push({
        code: 'WEEKDAY_SCHOOL_SLOT_REQUIRED',
        message: `${classRecord.name} não cobre ${formatSchoolDays(slotDays)} porque não há horário escolar compatível cadastrado para esse turno.`,
        classId,
        suggestions: ['Cadastre pelo menos um horário escolar compatível em cada dia obrigatório.', 'Confira o turno configurado na turma.'],
      });
    }
    if (teacherDays.length > 0) {
      diagnostics.push({
        code: 'WEEKDAY_TEACHER_AVAILABILITY_REQUIRED',
        message: `${classRecord.name} não cobre ${formatSchoolDays(teacherDays)} porque os professores atribuídos não têm disponibilidade nesses dias.`,
        classId,
        suggestions: ['Cadastre ou amplie a disponibilidade semanal dos professores.', 'Revise as atribuições da turma.'],
      });
    }
    if (capacityDays.length > 0) {
      diagnostics.push({
        code: 'WEEKDAY_COVERAGE_CAPACITY_INSUFFICIENT',
        message: `${classRecord.name} não cobre ${formatSchoolDays(capacityDays)}: a carga semanal não é suficiente ou os horários compatíveis estão ocupados por outra restrição.`,
        classId,
        suggestions: ['Confira a carga semanal da matriz curricular.', 'Distribua mais slots no turno ou revise conflitos de turma, professor e sala.'],
      });
    }
  }

  return diagnostics;
}

function calculatePenalties(entries: GeneratorEntry[]): TimetableGeneratorResult['penalties'] {
  const sameSubjectDays = new Set<string>();
  let sameSubjectSameDay = 0;
  for (const entry of entries) {
    const key = `${entry.classId}:${entry.subjectId}:${entry.termId}:${entry.dayOfWeek}`;
    if (sameSubjectDays.has(key)) sameSubjectSameDay += 1;
    sameSubjectDays.add(key);
  }

  const teacherGaps = entries.reduce((total, entry, index) => {
    const sameDay = entries.filter((other, otherIndex) => otherIndex !== index && other.teacherProfileId === entry.teacherProfileId && other.dayOfWeek === entry.dayOfWeek && other.termId === entry.termId);
    return total + (sameDay.some((other) => timeToMinutes(other.endTime) < timeToMinutes(entry.startTime)) ? 1 : 0);
  }, 0);

  const roomChanges = entries.reduce((total, entry, index) => {
    const previous = entries[index - 1];
    return total + (previous && previous.teacherProfileId === entry.teacherProfileId && previous.dayOfWeek === entry.dayOfWeek && previous.roomId !== entry.roomId ? 1 : 0);
  }, 0);

  return { teacherGaps, sameSubjectSameDay, roomChanges };
}

export function generateTimetable(input: TimetableGeneratorInput): TimetableGeneratorResult {
  const seed = input.seed ?? `${input.institutionId}:${input.academicYearId}`;
  const diagnostics: GeneratorDiagnostic[] = [];
  const terms = new Map(input.terms.filter((term) => term.academicYearId === input.academicYearId).map((term) => [term.id, term]));
  const selectedTermIds = new Set(input.termIds ?? [...terms.keys()]);
  const classes = new Map(input.classes.filter((record) => record.institutionId === input.institutionId && record.academicYearId === input.academicYearId).map((record) => [record.id, record]));
  const offerings = input.subjectOfferings.filter((offering) => offering.institutionId === input.institutionId && classes.has(offering.classId) && selectedTermIds.has(offering.termId) && terms.has(offering.termId));
  const curriculumByKey = new Map(input.curriculumItems.map((item) => [`${item.classId}:${item.subjectId}`, item]));
  const demands: Demand[] = [];

  for (const classRecord of classes.values()) {
    for (const curriculum of input.curriculumItems.filter((item) => item.classId === classRecord.id && item.weeklyLessons > 0)) {
      for (const term of terms.values()) {
        if (!selectedTermIds.has(term.id)) continue;
        const offering = offerings.find(
          (item) =>
            item.classId === classRecord.id &&
            item.subjectId === curriculum.subjectId &&
            item.termId === term.id,
        );

        if (!offering) {
          const subjectLabel = input.subjectLabels?.[curriculum.subjectId] ?? curriculum.subjectId;
          diagnostics.push({
            code: 'OFFERING_REQUIRED',
            message: `${classRecord.name}: a matéria ${subjectLabel} precisa de uma atribuição antes da publicação.`,
            classId: classRecord.id,
            subjectId: curriculum.subjectId,
            suggestions: [
              'Atribua um professor à matéria em Matérias das turmas.',
              'Mantenha a grade como estrutura até a atribuição ser concluída.',
            ],
          });
        }
      }
    }
  }

  for (const offering of offerings) {
    const curriculum = curriculumByKey.get(`${offering.classId}:${offering.subjectId}`);
    const classRecord = classes.get(offering.classId);
    const term = terms.get(offering.termId);
    if (!curriculum || !classRecord || !term) {
      diagnostics.push({ code: 'CURRICULUM_OR_SCOPE_MISMATCH', message: `Offering ${offering.id} is outside the selected class, curriculum or academic year.`, suggestions: ['Apply a curriculum item to the class.', 'Review the offering and academic year.'] });
      continue;
    }
    const teacherSkills = input.teacherSubjects.filter(
      (skill) =>
        skill.institutionId === input.institutionId &&
        skill.teacherProfileId === offering.teacherProfileId,
    );
    const qualified =
      teacherSkills.length === 0 ||
      teacherSkills.some(
        (skill) =>
          skill.active &&
          skill.subjectId === offering.subjectId,
      );
    if (!qualified) {
      diagnostics.push({ code: 'TEACHER_SUBJECT_NOT_AUTHORIZED', message: `${offering.teacherProfileId} is not enabled for subject ${offering.subjectId}.`, classId: offering.classId, subjectId: offering.subjectId, teacherProfileId: offering.teacherProfileId, suggestions: ['Enable the subject for this teacher.', 'Choose another qualified teacher.'] });
      continue;
    }
    const lockedCount = (input.lockedEntries ?? []).filter(
      (entry) =>
        entry.institutionId === input.institutionId &&
        entry.academicYearId === input.academicYearId &&
        entry.termId === offering.termId &&
        entry.subjectOfferingId === offering.id &&
        entry.locked,
    ).length;
    const remainingLessons = Math.max(0, curriculum.weeklyLessons - lockedCount);
    for (let occurrence = 0; occurrence < remainingLessons; occurrence += 1) {
      demands.push({ classRecord, curriculum, offering, term, occurrence });
    }
  }

  const entries: GeneratorEntry[] = [...(input.lockedEntries ?? [])].filter((entry) => entry.institutionId === input.institutionId && entry.academicYearId === input.academicYearId && selectedTermIds.has(entry.termId));
  const allSlots = input.schoolTimeSlots.filter((slot) => slot.active && slot.institutionId === input.institutionId);
  const coveredDays = new Map<string, Set<number>>();
  if (input.requireWeekdayCoverage) {
    for (const entry of entries) {
      const key = `${entry.classId}:${entry.termId}`;
      const days = coveredDays.get(key) ?? new Set<number>();
      days.add(entry.dayOfWeek);
      coveredDays.set(key, days);
    }
  }

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      if (timetableEntriesConflict(entries[leftIndex], entries[rightIndex], terms)) {
        diagnostics.push({ code: 'LOCKED_ENTRY_CONFLICT', message: 'Entradas fixadas possuem conflito de turma, professor ou sala.', suggestions: ['Revise uma das entradas fixadas antes de gerar novamente.'] });
      }
    }
  }

  const rankedDemands = demands.map((demand) => {
    const possible = slotsForClass(allSlots, demand.classRecord).filter((slot) => slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5)).filter((slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes).filter((slot) => hasTeacherAvailability(input, demand, slot));
    return { demand, possibleCount: possible.length };
  }).sort((left, right) => left.possibleCount - right.possibleCount || right.demand.curriculum.weeklyLessons - left.demand.curriculum.weeklyLessons || compareIds(left.demand.offering.id, right.demand.offering.id, seed) || left.demand.occurrence - right.demand.occurrence);

  for (const ranked of rankedDemands) {
    const demand = ranked.demand;
    const candidates: Candidate[] = [];
    for (const slot of slotsForClass(allSlots, demand.classRecord)) {
      if (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) < demand.curriculum.lessonDurationMinutes) continue;
      if (!hasTeacherAvailability(input, demand, slot)) continue;
      if (entries.some((entry) => entry.classId === demand.classRecord.id && occupiedBy(entry, { slot, roomId: null }, demand, terms))) continue;
      if (entries.some((entry) => entry.teacherProfileId === demand.offering.teacherProfileId && occupiedBy(entry, { slot, roomId: null }, demand, terms))) continue;
      const roomIds = candidateRooms(input, entries, demand, { slot, roomId: null }, terms);
      for (const roomId of roomIds) candidates.push({ slot, roomId: roomId === (null as unknown as string) ? null : roomId });
    }
    candidates.sort((left, right) => {
      if (input.requireWeekdayCoverage) {
        const key = `${demand.classRecord.id}:${demand.term.id}`;
        const days = coveredDays.get(key) ?? new Set<number>();
        const leftFillsMissingDay = REQUIRED_SCHOOL_DAYS.includes(left.slot.dayOfWeek as (typeof REQUIRED_SCHOOL_DAYS)[number]) && !days.has(left.slot.dayOfWeek);
        const rightFillsMissingDay = REQUIRED_SCHOOL_DAYS.includes(right.slot.dayOfWeek as (typeof REQUIRED_SCHOOL_DAYS)[number]) && !days.has(right.slot.dayOfWeek);
        if (leftFillsMissingDay !== rightFillsMissingDay) return leftFillsMissingDay ? -1 : 1;
      }
      return left.slot.dayOfWeek - right.slot.dayOfWeek || left.slot.slotNumber - right.slot.slotNumber || compareIds(left.roomId ?? '', right.roomId ?? '', seed);
    });
    const chosen = candidates[0];
    if (!chosen) {
      diagnostics.push(buildDiagnostics(input, demand, ranked.possibleCount === 0 ? 'no compatible slot is available' : 'all compatible slots are occupied'));
      continue;
    }
    entries.push({ institutionId: input.institutionId, academicYearId: input.academicYearId, termId: demand.term.id, classId: demand.classRecord.id, subjectOfferingId: demand.offering.id, teacherProfileId: demand.offering.teacherProfileId, subjectId: demand.offering.subjectId, roomId: chosen.roomId, dayOfWeek: chosen.slot.dayOfWeek, startTime: chosen.slot.startTime, endTime: chosen.slot.endTime, locked: false });
    if (input.requireWeekdayCoverage) {
      const key = `${demand.classRecord.id}:${demand.term.id}`;
      const days = coveredDays.get(key) ?? new Set<number>();
      days.add(chosen.slot.dayOfWeek);
      coveredDays.set(key, days);
    }
  }

  if (input.requireWeekdayCoverage) {
    diagnostics.push(...buildWeekdayCoverageDiagnostics(input, classes, demands, entries, allSlots));
  }

  const penalties = calculatePenalties(entries);
  const hardConflicts = diagnostics.length;
  const invalid = diagnostics.some((diagnostic) => diagnostic.code === 'LOCKED_ENTRY_CONFLICT');
  return { valid: hardConflicts === 0, status: hardConflicts === 0 ? 'VALID' : invalid ? 'INVALID' : 'UNSATISFIED', entries, hardConflicts, score: Math.max(0, 100 - penalties.teacherGaps - penalties.sameSubjectSameDay * 2 - penalties.roomChanges), penalties, diagnostics, seed };
}

export function timetableTermsOverlap(left: GeneratorTerm, right: GeneratorTerm): boolean {
  return termsOverlap(left, right);
}

export function timetableEntriesConflict(left: GeneratorEntry, right: GeneratorEntry, termsById: Map<string, GeneratorTerm>): boolean {
  if (left.dayOfWeek !== right.dayOfWeek || !overlaps(left.startTime, left.endTime, right.startTime, right.endTime)) return false;
  const leftTerm = termsById.get(left.termId);
  const rightTerm = termsById.get(right.termId);
  if (!leftTerm || !rightTerm || !termsOverlap(leftTerm, rightTerm)) return false;
  return left.classId === right.classId || left.teacherProfileId === right.teacherProfileId || (left.roomId !== null && left.roomId === right.roomId);
}
