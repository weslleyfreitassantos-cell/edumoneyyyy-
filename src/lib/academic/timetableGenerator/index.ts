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
  status: 'VALID' | 'UNSATISFIED';
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
  return input.teacherAvailability.some((availability) =>
    availability.active &&
    availability.institutionId === input.institutionId &&
    availability.teacherProfileId === demand.offering.teacherProfileId &&
    availability.dayOfWeek === slot.dayOfWeek &&
    timeToMinutes(availability.startTime) <= timeToMinutes(slot.startTime) &&
    timeToMinutes(availability.endTime) >= timeToMinutes(slot.endTime),
  );
}

function candidateRooms(input: TimetableGeneratorInput, entries: GeneratorEntry[], demand: Demand, candidate: Candidate, terms: Map<string, GeneratorTerm>): string[] {
  const rooms = input.rooms.filter((room) => room.active && room.institutionId === input.institutionId);
  if (rooms.length === 0) return [null as unknown as string];
  return rooms
    .filter((room) => !entries.some((entry) => entry.roomId === room.id && occupiedBy(entry, candidate, demand, terms)))
    .map((room) => room.id);
}

function buildDiagnostics(input: TimetableGeneratorInput, demand: Demand, reason: string): GeneratorDiagnostic {
  return {
    code: 'UNSATISFIED',
    message: `${demand.classRecord.name}: subject ${demand.curriculum.subjectId} requires ${demand.curriculum.weeklyLessons} lessons; ${reason}`,
    classId: demand.classRecord.id,
    subjectId: demand.curriculum.subjectId,
    teacherProfileId: demand.offering.teacherProfileId,
    suggestions: ['Expand teacher availability.', 'Add or adjust school time slots.', 'Review the teacher assignment or weekly workload.'],
  };
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

  for (const offering of offerings) {
    const curriculum = curriculumByKey.get(`${offering.classId}:${offering.subjectId}`);
    const classRecord = classes.get(offering.classId);
    const term = terms.get(offering.termId);
    if (!curriculum || !classRecord || !term) {
      diagnostics.push({ code: 'CURRICULUM_OR_SCOPE_MISMATCH', message: `Offering ${offering.id} is outside the selected class, curriculum or academic year.`, suggestions: ['Apply a curriculum item to the class.', 'Review the offering and academic year.'] });
      continue;
    }
    const qualified = input.teacherSubjects.some((skill) => skill.active && skill.institutionId === input.institutionId && skill.teacherProfileId === offering.teacherProfileId && skill.subjectId === offering.subjectId);
    if (!qualified) {
      diagnostics.push({ code: 'TEACHER_SUBJECT_NOT_AUTHORIZED', message: `${offering.teacherProfileId} is not enabled for subject ${offering.subjectId}.`, classId: offering.classId, subjectId: offering.subjectId, teacherProfileId: offering.teacherProfileId, suggestions: ['Enable the subject for this teacher.', 'Choose another qualified teacher.'] });
      continue;
    }
    for (let occurrence = 0; occurrence < curriculum.weeklyLessons; occurrence += 1) {
      demands.push({ classRecord, curriculum, offering, term, occurrence });
    }
  }

  const entries: GeneratorEntry[] = [...(input.lockedEntries ?? [])].filter((entry) => entry.institutionId === input.institutionId && entry.academicYearId === input.academicYearId && selectedTermIds.has(entry.termId));
  const allSlots = input.schoolTimeSlots.filter((slot) => slot.active && slot.institutionId === input.institutionId);

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      if (timetableEntriesConflict(entries[leftIndex], entries[rightIndex], terms)) {
        diagnostics.push({ code: 'LOCKED_ENTRY_CONFLICT', message: 'Entradas fixadas possuem conflito de turma, professor ou sala.', suggestions: ['Revise uma das entradas fixadas antes de gerar novamente.'] });
      }
    }
  }

  const rankedDemands = demands.map((demand) => {
    const possible = allSlots.filter((slot) => demand.classRecord.shift === null || slot.shift === demand.classRecord.shift).filter((slot) => slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5)).filter((slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) >= demand.curriculum.lessonDurationMinutes).filter((slot) => hasTeacherAvailability(input, demand, slot));
    return { demand, possibleCount: possible.length };
  }).sort((left, right) => left.possibleCount - right.possibleCount || right.demand.curriculum.weeklyLessons - left.demand.curriculum.weeklyLessons || compareIds(left.demand.offering.id, right.demand.offering.id, seed) || left.demand.occurrence - right.demand.occurrence);

  for (const ranked of rankedDemands) {
    const demand = ranked.demand;
    const candidates: Candidate[] = [];
    for (const slot of allSlots) {
      if (demand.classRecord.shift !== null && slot.shift !== demand.classRecord.shift) continue;
      if (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) < demand.curriculum.lessonDurationMinutes) continue;
      if (!hasTeacherAvailability(input, demand, slot)) continue;
      if (entries.some((entry) => entry.classId === demand.classRecord.id && occupiedBy(entry, { slot, roomId: null }, demand, terms))) continue;
      if (entries.some((entry) => entry.teacherProfileId === demand.offering.teacherProfileId && occupiedBy(entry, { slot, roomId: null }, demand, terms))) continue;
      const roomIds = candidateRooms(input, entries, demand, { slot, roomId: null }, terms);
      for (const roomId of roomIds) candidates.push({ slot, roomId: roomId === (null as unknown as string) ? null : roomId });
    }
    candidates.sort((left, right) => left.slot.dayOfWeek - right.slot.dayOfWeek || left.slot.slotNumber - right.slot.slotNumber || compareIds(left.roomId ?? '', right.roomId ?? '', seed));
    const chosen = candidates[0];
    if (!chosen) {
      diagnostics.push(buildDiagnostics(input, demand, ranked.possibleCount === 0 ? 'no compatible slot is available' : 'all compatible slots are occupied'));
      continue;
    }
    entries.push({ institutionId: input.institutionId, academicYearId: input.academicYearId, termId: demand.term.id, classId: demand.classRecord.id, subjectOfferingId: demand.offering.id, teacherProfileId: demand.offering.teacherProfileId, subjectId: demand.offering.subjectId, roomId: chosen.roomId, dayOfWeek: chosen.slot.dayOfWeek, startTime: chosen.slot.startTime, endTime: chosen.slot.endTime, locked: false });
  }

  const penalties = calculatePenalties(entries);
  const hardConflicts = diagnostics.length;
  return { valid: hardConflicts === 0, status: hardConflicts === 0 ? 'VALID' : 'UNSATISFIED', entries, hardConflicts, score: Math.max(0, 100 - penalties.teacherGaps - penalties.sameSubjectSameDay * 2 - penalties.roomChanges), penalties, diagnostics, seed };
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
