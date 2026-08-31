import { normalizeAcademicShift } from './automaticPreparation';
import {
  DEFAULT_TIMETABLE_POLICY,
} from '../timetablePolicy';

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
  studentCount?: number;
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

export interface GeneratorScheduleBreak {
  institutionId: string;
  shift: string;
  dayOfWeek: number;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface GeneratorRoom {
  id: string;
  institutionId: string;
  classId?: string | null;
  active: boolean;
  capacity?: number | null;
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
  schoolScheduleBreaks?: GeneratorScheduleBreak[];
  rooms: GeneratorRoom[];
  lockedEntries?: GeneratorEntry[];
  subjectLabels?: Record<string, string>;
  requireWeekdayCoverage?: boolean;
  schoolDays?: number[];
  maxLessonsPerDay?: number;
  maxTeacherLessonsPerDay?: number;
  maxTeacherLessonsPerWeek?: number;
  maxConsecutiveSubjectLessons?: number;
  maxSubjectLessonsPerDay?: number;
  requireTeacherAvailability?: boolean;
  requireRoomForGeneration?: boolean;
  allowSharedRooms?: boolean;
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

const MAX_CONSECUTIVE_SUBJECT_LESSONS = 2;

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

  if (teacherAvailability.length === 0) {
    return input.requireTeacherAvailability !== true;
  }

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

function schoolDays(input: TimetableGeneratorInput): number[] {
  const configured = input.schoolDays?.filter((day) => Number.isInteger(day) && day >= 1 && day <= 6);
  return configured && configured.length > 0 ? configured : DEFAULT_TIMETABLE_POLICY.schoolDays;
}

function slotOverlapsScheduleBreak(
  slot: Pick<GeneratorTimeSlot, 'dayOfWeek' | 'startTime' | 'endTime'>,
  classRecord: GeneratorClass,
  breaks: GeneratorScheduleBreak[],
): boolean {
  if (!classRecord.shift) return false;
  const normalizedShift = normalizeAcademicShift(classRecord.shift);
  return breaks.some(
    (scheduleBreak) =>
      scheduleBreak.active &&
      scheduleBreak.institutionId === classRecord.institutionId &&
      normalizeAcademicShift(scheduleBreak.shift) === normalizedShift &&
      scheduleBreak.dayOfWeek === slot.dayOfWeek &&
      overlaps(
        slot.startTime,
        slot.endTime,
        scheduleBreak.startTime,
        scheduleBreak.endTime,
      ),
  );
}

function slotsAvailableForClass(
  input: TimetableGeneratorInput,
  allSlots: GeneratorTimeSlot[],
  classRecord: GeneratorClass,
): GeneratorTimeSlot[] {
  return slotsForClass(allSlots, classRecord).filter(
    (slot) =>
      !slotOverlapsScheduleBreak(
        slot,
        classRecord,
        input.schoolScheduleBreaks ?? [],
      ),
  );
}

function exceedsConsecutiveSubjectLimit(
  input: TimetableGeneratorInput,
  entries: GeneratorEntry[],
  demand: Demand,
  slot: GeneratorTimeSlot,
  terms: Map<string, GeneratorTerm>,
): boolean {
  const compatibleSlots = input.schoolTimeSlots
    .filter(
      (schoolSlot) =>
        schoolSlot.active &&
        schoolSlot.institutionId === input.institutionId &&
        schoolSlot.dayOfWeek === slot.dayOfWeek &&
        normalizeAcademicShift(schoolSlot.shift) === normalizeAcademicShift(slot.shift),
    )
    .sort((left, right) => left.slotNumber - right.slotNumber);
  const subjectSlots = new Set<number>([slot.slotNumber]);

  for (const entry of entries) {
    if (
      entry.classId !== demand.classRecord.id ||
      entry.subjectId !== demand.curriculum.subjectId ||
      entry.dayOfWeek !== slot.dayOfWeek
    ) {
      continue;
    }

    const existingTerm = terms.get(entry.termId);
    if (!existingTerm || !termsOverlap(existingTerm, demand.term)) continue;

    const matchingSlot = compatibleSlots.find(
      (schoolSlot) =>
        schoolSlot.startTime === entry.startTime &&
        schoolSlot.endTime === entry.endTime,
    );
    if (matchingSlot) subjectSlots.add(matchingSlot.slotNumber);
  }

  let consecutiveLessons = 1;
  for (let slotNumber = slot.slotNumber - 1; subjectSlots.has(slotNumber); slotNumber -= 1) {
    consecutiveLessons += 1;
  }
  for (let slotNumber = slot.slotNumber + 1; subjectSlots.has(slotNumber); slotNumber += 1) {
    consecutiveLessons += 1;
  }

  return consecutiveLessons > (input.maxConsecutiveSubjectLessons ?? MAX_CONSECUTIVE_SUBJECT_LESSONS);
}

function buildDiagnostics(input: TimetableGeneratorInput, demand: Demand, reason: string): GeneratorDiagnostic {
  const subjectLabel = input.subjectLabels?.[demand.curriculum.subjectId] ?? demand.curriculum.subjectId;
  return {
    code: 'UNSATISFIED',
    message: `${demand.classRecord.name}: ${subjectLabel} precisa de ${demand.curriculum.weeklyLessons} aulas; ${reason}`,
    classId: demand.classRecord.id,
    subjectId: demand.curriculum.subjectId,
    teacherProfileId: demand.offering.teacherProfileId,
      suggestions: ['Expand teacher availability.', 'Add or adjust school time slots.', 'Distribute the subject across different periods; no more than two consecutive lessons are allowed.', 'Review the teacher assignment or weekly workload.'],
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
  const requiredDays = schoolDays(input);

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
    const missingDays = requiredDays.filter((day) => !coveredDays.has(day));
    if (missingDays.length === 0) continue;

    const expectedLessons = groupDemands.length + groupEntries.length;
    const capacityDays: number[] = [];
    const slotDays: number[] = [];
    const breakDays: number[] = [];
    const teacherDays: number[] = [];

    if (expectedLessons < requiredDays.length) {
      diagnostics.push({
        code: 'WEEKDAY_COVERAGE_CAPACITY_INSUFFICIENT',
        message: `${classRecord.name} não cobre ${formatSchoolDays(missingDays)} porque a carga semanal tem apenas ${expectedLessons} aula(s), menos que os ${requiredDays.length} dias configurados.`,
        classId,
        suggestions: ['Confira a carga semanal da matriz curricular.', 'Distribua pelo menos uma aula em cada dia letivo configurado.'],
      });
      continue;
    }

    for (const day of missingDays) {
      const rawDaySlotsByDemand = groupDemands.map((demand) => ({
        demand,
        slots: slotsForClass(allSlots, demand.classRecord).filter(
          (slot) =>
            slot.dayOfWeek === day &&
            timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes,
        ),
      }));
      const daySlotsByDemand = groupDemands.map((demand) => ({
        demand,
        slots: slotsAvailableForClass(input, allSlots, demand.classRecord).filter(
          (slot) =>
            slot.dayOfWeek === day &&
            timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes,
        ),
      }));
      const daySlots = daySlotsByDemand.flatMap((item) => item.slots);

      if (daySlots.length === 0) {
        if (rawDaySlotsByDemand.some((item) => item.slots.length > 0)) {
          breakDays.push(day);
        } else {
          slotDays.push(day);
        }
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
        suggestions: ['Cadastre pelo menos um horário escolar compatível em cada dia letivo.', 'Confira o turno configurado na turma.'],
      });
    }
    if (breakDays.length > 0) {
      diagnostics.push({
        code: 'WEEKDAY_SCHEDULE_BREAK_REQUIRED',
        message: `${classRecord.name} não cobre ${formatSchoolDays(breakDays)} porque os horários disponíveis estão bloqueados por intervalo ou almoço do turno.`,
        classId,
        suggestions: ['Revise os intervalos e o almoço em Política acadêmica.', 'Cadastre mais horários de aula fora desses bloqueios.'],
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
  const allSlots = input.schoolTimeSlots.filter((slot) => slot.active && slot.institutionId === input.institutionId && schoolDays(input).includes(slot.dayOfWeek));
  for (const entry of entries) {
    const classRecord = classes.get(entry.classId);
    if (
      classRecord &&
      slotOverlapsScheduleBreak(entry, classRecord, input.schoolScheduleBreaks ?? [])
    ) {
      diagnostics.push({
        code: 'LOCKED_ENTRY_DURING_SCHEDULE_BREAK',
        message: `${classRecord.name} possui uma aula fixada durante um intervalo ou almoço configurado.`,
        classId: entry.classId,
        suggestions: ['Mova a aula fixada para fora do intervalo.', 'Revise os bloqueios em Política acadêmica.'],
      });
    }
  }
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

  const pendingDemands = [...demands];
  const unscheduledDemands: Array<{
    demand: Demand;
    possibleCount: number;
    blockedByConsecutiveSubjectLimit: boolean;
  }> = [];
  const entryDemands = new WeakMap<GeneratorEntry, Demand>();
  type EntryIndex = Map<string, GeneratorEntry[]>;
  const entriesByClassDay: EntryIndex = new Map();
  const entriesByClassSubjectDay: EntryIndex = new Map();
  const entriesByTeacherDay: EntryIndex = new Map();
  const entriesByTeacher: EntryIndex = new Map();
  const entriesByRoomDay: EntryIndex = new Map();

  const addToIndex = (index: EntryIndex, key: string, entry: GeneratorEntry): void => {
    const bucket = index.get(key) ?? [];
    bucket.push(entry);
    index.set(key, bucket);
  };

  const removeFromIndex = (index: EntryIndex, key: string, entry: GeneratorEntry): void => {
    const bucket = index.get(key);
    if (!bucket) return;
    const entryIndex = bucket.indexOf(entry);
    if (entryIndex >= 0) bucket.splice(entryIndex, 1);
    if (bucket.length === 0) index.delete(key);
  };

  const indexEntry = (entry: GeneratorEntry): void => {
    addToIndex(entriesByClassDay, `${entry.classId}:${entry.dayOfWeek}`, entry);
    addToIndex(entriesByClassSubjectDay, `${entry.classId}:${entry.subjectId}:${entry.dayOfWeek}`, entry);
    addToIndex(entriesByTeacherDay, `${entry.teacherProfileId}:${entry.dayOfWeek}`, entry);
    addToIndex(entriesByTeacher, entry.teacherProfileId, entry);
    if (entry.roomId !== null) addToIndex(entriesByRoomDay, `${entry.roomId}:${entry.dayOfWeek}`, entry);
  };

  const unindexEntry = (entry: GeneratorEntry): void => {
    removeFromIndex(entriesByClassDay, `${entry.classId}:${entry.dayOfWeek}`, entry);
    removeFromIndex(entriesByClassSubjectDay, `${entry.classId}:${entry.subjectId}:${entry.dayOfWeek}`, entry);
    removeFromIndex(entriesByTeacherDay, `${entry.teacherProfileId}:${entry.dayOfWeek}`, entry);
    removeFromIndex(entriesByTeacher, entry.teacherProfileId, entry);
    if (entry.roomId !== null) removeFromIndex(entriesByRoomDay, `${entry.roomId}:${entry.dayOfWeek}`, entry);
  };

  const rebuildIndexes = (): void => {
    entriesByClassDay.clear();
    entriesByClassSubjectDay.clear();
    entriesByTeacherDay.clear();
    entriesByTeacher.clear();
    entriesByRoomDay.clear();
    entries.forEach(indexEntry);
  };

  const addEntry = (entry: GeneratorEntry): void => {
    entries.push(entry);
    indexEntry(entry);
  };

  const removeEntry = (entry: GeneratorEntry): void => {
    const entryIndex = entries.indexOf(entry);
    if (entryIndex < 0) return;
    entries.splice(entryIndex, 1);
    unindexEntry(entry);
  };

  entries.forEach(indexEntry);
  const requiredDays = schoolDays(input);

  const overlappingEntries = (index: EntryIndex, key: string, demand: Demand): GeneratorEntry[] =>
    (index.get(key) ?? []).filter((entry) => {
      const existingTerm = terms.get(entry.termId);
      return Boolean(existingTerm && termsOverlap(existingTerm, demand.term));
    });

  const classDayEntries = (demand: Demand, dayOfWeek: number): GeneratorEntry[] =>
    overlappingEntries(entriesByClassDay, `${demand.classRecord.id}:${dayOfWeek}`, demand);

  const classSubjectDayEntries = (demand: Demand, dayOfWeek: number): GeneratorEntry[] =>
    overlappingEntries(entriesByClassSubjectDay, `${demand.classRecord.id}:${demand.curriculum.subjectId}:${dayOfWeek}`, demand);

  const teacherDayEntries = (demand: Demand, dayOfWeek: number): GeneratorEntry[] =>
    overlappingEntries(entriesByTeacherDay, `${demand.offering.teacherProfileId}:${dayOfWeek}`, demand);

  const teacherEntries = (demand: Demand): GeneratorEntry[] =>
    overlappingEntries(entriesByTeacher, demand.offering.teacherProfileId, demand);

  const roomDayEntries = (roomId: string, demand: Demand, dayOfWeek: number): GeneratorEntry[] =>
    overlappingEntries(entriesByRoomDay, `${roomId}:${dayOfWeek}`, demand);

  const classDayLoadIndexed = (demand: Demand, dayOfWeek: number): number => classDayEntries(demand, dayOfWeek).length;
  const subjectDayLoadIndexed = (demand: Demand, dayOfWeek: number): number => classSubjectDayEntries(demand, dayOfWeek).length;
  const teacherDayLoadIndexed = (demand: Demand, dayOfWeek: number): number => teacherDayEntries(demand, dayOfWeek).length;
  const teacherWeekLoadIndexed = (demand: Demand): number => teacherEntries(demand).length;
  const consecutiveSubjectLimitExceeded = (demand: Demand, slot: GeneratorTimeSlot): boolean =>
    exceedsConsecutiveSubjectLimit(input, classSubjectDayEntries(demand, slot.dayOfWeek), demand, slot, terms);

  const findCandidates = (demand: Demand): { candidates: Candidate[]; possibleCount: number; blockedByConsecutiveSubjectLimit: boolean } => {
    const candidates: Candidate[] = [];
    let blockedByConsecutiveSubjectLimit = false;
    const possible = slotsAvailableForClass(input, allSlots, demand.classRecord)
      .filter((slot) => slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5))
      .filter((slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes)
      .filter((slot) => hasTeacherAvailability(input, demand, slot));

    for (const slot of possible) {
      if (candidateConflicts(demand, { slot, roomId: null }).length > 0) continue;
      if (classDayLoadIndexed(demand, slot.dayOfWeek) >= (input.maxLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxLessonsPerDay)) continue;
      if (subjectDayLoadIndexed(demand, slot.dayOfWeek) >= (input.maxSubjectLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxSubjectLessonsPerDay)) continue;
      if (teacherDayLoadIndexed(demand, slot.dayOfWeek) >= (input.maxTeacherLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerDay)) continue;
      if (teacherWeekLoadIndexed(demand) >= (input.maxTeacherLessonsPerWeek ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerWeek)) continue;
      if (consecutiveSubjectLimitExceeded(demand, slot)) {
        blockedByConsecutiveSubjectLimit = true;
        continue;
      }
      const roomIds = roomOptionsForDemand(demand, slot);
      for (const roomId of roomIds) candidates.push({ slot, roomId: roomId === (null as unknown as string) ? null : roomId });
    }
    return { candidates, possibleCount: possible.length, blockedByConsecutiveSubjectLimit };
  };

  const possibleSlotsForDemand = (demand: Demand): GeneratorTimeSlot[] =>
    slotsAvailableForClass(input, allSlots, demand.classRecord)
      .filter((slot) => slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5))
      .filter((slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes)
      .filter((slot) => hasTeacherAvailability(input, demand, slot));

  const roomOptionsForDemand = (demand: Demand, slot?: GeneratorTimeSlot): Array<string | null> => {
    const rooms = input.rooms.filter((room) => room.active && room.institutionId === input.institutionId);
    if (rooms.length === 0) return input.requireRoomForGeneration ? [] : [null];
    const assignedRooms = rooms.filter((room) => room.classId === demand.classRecord.id);
    const availableRooms = assignedRooms.length > 0
      ? assignedRooms
      : input.allowSharedRooms === false
        ? []
        : rooms.filter((room) => !room.classId);
    if (availableRooms.length === 0 && input.requireRoomForGeneration !== true) return [null];
    return availableRooms
      .filter((room) => room.capacity == null || demand.classRecord.studentCount == null || room.capacity >= demand.classRecord.studentCount)
      .filter((room) => !slot || roomDayEntries(room.id, demand, slot.dayOfWeek).every((entry) => !occupiedBy(entry, { slot, roomId: room.id }, demand, terms)))
      .map((room) => room.id);
  };

  const candidateConflicts = (demand: Demand, candidate: Candidate): GeneratorEntry[] =>
    [...new Set([
      ...classDayEntries(demand, candidate.slot.dayOfWeek),
      ...teacherDayEntries(demand, candidate.slot.dayOfWeek),
      ...(candidate.roomId === null ? [] : roomDayEntries(candidate.roomId, demand, candidate.slot.dayOfWeek)),
    ])].filter((entry) =>
      occupiedBy(entry, candidate, demand, terms) &&
      (
        entry.classId === demand.classRecord.id ||
        entry.teacherProfileId === demand.offering.teacherProfileId ||
        (candidate.roomId !== null && entry.roomId === candidate.roomId)
      ),
    );

  const candidateFitsLimits = (demand: Demand, candidate: Candidate): boolean =>
    classDayLoadIndexed(demand, candidate.slot.dayOfWeek) < (input.maxLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxLessonsPerDay) &&
    subjectDayLoadIndexed(demand, candidate.slot.dayOfWeek) < (input.maxSubjectLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxSubjectLessonsPerDay) &&
    teacherDayLoadIndexed(demand, candidate.slot.dayOfWeek) < (input.maxTeacherLessonsPerDay ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerDay) &&
    teacherWeekLoadIndexed(demand) < (input.maxTeacherLessonsPerWeek ?? DEFAULT_TIMETABLE_POLICY.maxTeacherLessonsPerWeek) &&
    !consecutiveSubjectLimitExceeded(demand, candidate.slot);

  function demandKey(demand: Demand): string {
    return `${demand.offering.id}:${demand.term.id}:${demand.occurrence}`;
  }

  function reservationKey(kind: 'class' | 'teacher' | 'room', id: string, demand: Demand, slot: GeneratorTimeSlot): string {
    return `${kind}:${id}:${demand.term.id}:${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}`;
  }

  const MAX_REPAIR_DEPTH = 8;
  const MAX_REPAIR_ATTEMPTS = 20000;
  let repairAttempts = 0;

  const tryRepairDemand = (
    demand: Demand,
    depth: number,
    trail: Set<string>,
    reservations: Set<string>,
  ): boolean => {
    if (depth > MAX_REPAIR_DEPTH || repairAttempts >= MAX_REPAIR_ATTEMPTS) return false;
    const currentKey = demandKey(demand);
    if (trail.has(currentKey)) return false;

    const nextTrail = new Set(trail).add(currentKey);
    const possible = possibleSlotsForDemand(demand).sort((left, right) =>
      classDayLoadIndexed(demand, left.dayOfWeek) - classDayLoadIndexed(demand, right.dayOfWeek) ||
      left.dayOfWeek - right.dayOfWeek ||
      left.slotNumber - right.slotNumber,
    );

    for (const slot of possible) {
      for (const roomId of roomOptionsForDemand(demand)) {
        repairAttempts += 1;
        const candidate: Candidate = { slot, roomId };
        if (
          reservations.has(reservationKey('class', demand.classRecord.id, demand, slot)) ||
          reservations.has(reservationKey('teacher', demand.offering.teacherProfileId, demand, slot)) ||
          (roomId !== null && reservations.has(reservationKey('room', roomId, demand, slot)))
        ) continue;

        const conflicts = candidateConflicts(demand, candidate);
        if (conflicts.some((entry) => entry.locked)) continue;
        const movableConflicts = conflicts.filter((entry) => entryDemands.has(entry));
        if (movableConflicts.length !== conflicts.length) continue;

        const snapshot = [...entries];
        for (const conflict of movableConflicts) {
          removeEntry(conflict);
        }

        const nextReservations = new Set(reservations);
        nextReservations.add(reservationKey('class', demand.classRecord.id, demand, slot));
        nextReservations.add(reservationKey('teacher', demand.offering.teacherProfileId, demand, slot));
        if (roomId !== null) nextReservations.add(reservationKey('room', roomId, demand, slot));

        let repaired = true;
        for (const conflict of movableConflicts) {
          const conflictDemand = entryDemands.get(conflict);
          if (!conflictDemand || !tryRepairDemand(conflictDemand, depth + 1, nextTrail, nextReservations)) {
            repaired = false;
            break;
          }
        }

        if (repaired && candidateConflicts(demand, candidate).length === 0 && candidateFitsLimits(demand, candidate)) {
          const entry: GeneratorEntry = {
            institutionId: input.institutionId,
            academicYearId: input.academicYearId,
            termId: demand.term.id,
            classId: demand.classRecord.id,
            subjectOfferingId: demand.offering.id,
            teacherProfileId: demand.offering.teacherProfileId,
            subjectId: demand.offering.subjectId,
            roomId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            locked: false,
          };
          addEntry(entry);
          entryDemands.set(entry, demand);
          return true;
        }

        entries.length = 0;
        entries.push(...snapshot);
        rebuildIndexes();
      }
    }
    return false;
  };

  const dynamicRanking = pendingDemands.length <= 300;
  const staticOrder = dynamicRanking
    ? null
    : pendingDemands.map((demand) => ({
      demand,
      possibleCount: slotsAvailableForClass(input, allSlots, demand.classRecord)
        .filter((slot) => slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5))
        .filter((slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes)
        .filter((slot) => hasTeacherAvailability(input, demand, slot)).length,
    })).sort((left, right) => left.possibleCount - right.possibleCount || right.demand.curriculum.weeklyLessons - left.demand.curriculum.weeklyLessons || left.demand.classRecord.id.localeCompare(right.demand.classRecord.id) || compareIds(left.demand.offering.id, right.demand.offering.id, seed) || left.demand.occurrence - right.demand.occurrence);

  while (pendingDemands.length > 0) {
    // Re-rank smaller schedules after each allocation; larger schools use a
    // stable scarcity order to keep generation responsive.
    const rankedDemand = dynamicRanking
      ? pendingDemands
        .map((demand) => ({ demand, ...findCandidates(demand) }))
        .sort((left, right) => left.candidates.length - right.candidates.length || right.demand.curriculum.weeklyLessons - left.demand.curriculum.weeklyLessons || compareIds(left.demand.offering.id, right.demand.offering.id, seed) || left.demand.occurrence - right.demand.occurrence)[0]
      : (() => {
        const next = staticOrder?.find((item) => pendingDemands.includes(item.demand));
        return next ? { demand: next.demand, ...findCandidates(next.demand) } : undefined;
      })();
    if (!rankedDemand) break;
    const demand = rankedDemand.demand;
    const candidates = rankedDemand.candidates;
    candidates.sort((left, right) => {
      if (input.requireWeekdayCoverage) {
        const key = `${demand.classRecord.id}:${demand.term.id}`;
        const days = coveredDays.get(key) ?? new Set<number>();
        const leftFillsMissingDay = requiredDays.includes(left.slot.dayOfWeek) && !days.has(left.slot.dayOfWeek);
        const rightFillsMissingDay = requiredDays.includes(right.slot.dayOfWeek) && !days.has(right.slot.dayOfWeek);
        if (leftFillsMissingDay !== rightFillsMissingDay) return leftFillsMissingDay ? -1 : 1;
      }
      const seededTieBreak = dynamicRanking
        ? 0
        : compareIds(
          `${demand.classRecord.id}:${demand.offering.teacherProfileId}:${left.slot.dayOfWeek}:${left.slot.slotNumber}`,
          `${demand.classRecord.id}:${demand.offering.teacherProfileId}:${right.slot.dayOfWeek}:${right.slot.slotNumber}`,
          seed,
        );
      return classDayLoadIndexed(demand, left.slot.dayOfWeek) -
        classDayLoadIndexed(demand, right.slot.dayOfWeek) ||
        seededTieBreak ||
        left.slot.dayOfWeek - right.slot.dayOfWeek ||
        left.slot.slotNumber - right.slot.slotNumber ||
        compareIds(left.roomId ?? '', right.roomId ?? '', seed);
    });
    const chosen = candidates[0];
    if (!chosen) {
      unscheduledDemands.push({
        demand,
        possibleCount: rankedDemand.possibleCount,
        blockedByConsecutiveSubjectLimit: rankedDemand.blockedByConsecutiveSubjectLimit,
      });
      pendingDemands.splice(pendingDemands.indexOf(demand), 1);
      continue;
    }
    const entry: GeneratorEntry = { institutionId: input.institutionId, academicYearId: input.academicYearId, termId: demand.term.id, classId: demand.classRecord.id, subjectOfferingId: demand.offering.id, teacherProfileId: demand.offering.teacherProfileId, subjectId: demand.offering.subjectId, roomId: chosen.roomId, dayOfWeek: chosen.slot.dayOfWeek, startTime: chosen.slot.startTime, endTime: chosen.slot.endTime, locked: false };
    addEntry(entry);
    entryDemands.set(entry, demand);
    if (input.requireWeekdayCoverage) {
      const key = `${demand.classRecord.id}:${demand.term.id}`;
      const days = coveredDays.get(key) ?? new Set<number>();
      days.add(chosen.slot.dayOfWeek);
      coveredDays.set(key, days);
    }
    pendingDemands.splice(pendingDemands.indexOf(demand), 1);
  }

  for (const unscheduled of unscheduledDemands) {
    const repaired = tryRepairDemand(unscheduled.demand, 0, new Set(), new Set());
    if (repaired) continue;
    diagnostics.push(buildDiagnostics(
      input,
      unscheduled.demand,
      unscheduled.blockedByConsecutiveSubjectLimit
        ? 'the subject cannot be scheduled more than two lessons consecutively'
        : unscheduled.possibleCount === 0
          ? 'no compatible slot is available'
          : 'all compatible slots are occupied',
    ));
  }

  if (input.requireWeekdayCoverage) {
    diagnostics.push(...buildWeekdayCoverageDiagnostics(input, classes, demands, entries, allSlots));
  }

  const penalties = calculatePenalties(entries);
  const hardConflicts = diagnostics.length;
  const invalid = diagnostics.some((diagnostic) => diagnostic.code === 'LOCKED_ENTRY_CONFLICT' || diagnostic.code === 'LOCKED_ENTRY_DURING_SCHEDULE_BREAK');
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
