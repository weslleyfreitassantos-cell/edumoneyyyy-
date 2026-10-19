import {
  toAcademicShift,
  type AcademicShift,
} from './academicShifts';

export function normalizeClassName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

const CLASS_SHIFT_SUFFIX: Record<AcademicShift, string> = {
  MATUTINO: 'M',
  VESPERTINO: 'V',
  INTEGRAL: 'I',
  NOTURNO: 'N',
};

export function getClassShiftSuffix(
  shift: string | null | undefined,
): string | null {
  const normalizedShift = toAcademicShift(shift);
  return normalizedShift ? CLASS_SHIFT_SUFFIX[normalizedShift] : null;
}

export function classLetter(index: number): string {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function classNameForLetter(
  baseName: string,
  letter: string,
  shift?: string | null,
): string {
  const sectionName = baseName.includes('{letra}')
    ? baseName.replaceAll('{letra}', letter)
    : `${baseName} ${letter}`;
  const shiftSuffix = getClassShiftSuffix(shift);

  return shiftSuffix && !normalizeClassName(sectionName).endsWith(` ${shiftSuffix.toLocaleLowerCase('pt-BR')}`)
    ? `${sectionName} ${shiftSuffix}`
    : sectionName;
}

export function getClassDisplayName(
  name: string,
  shift?: string | null,
): string {
  const normalizedName = name.trim();
  const shiftSuffix = getClassShiftSuffix(shift);

  if (!normalizedName || !shiftSuffix) return normalizedName;

  return normalizeClassName(normalizedName).endsWith(` ${shiftSuffix.toLocaleLowerCase('pt-BR')}`)
    ? normalizedName
    : `${normalizedName} ${shiftSuffix}`;
}

export function buildClassBatchNames(
  baseName: string,
  count: number,
  shift?: string | null,
): string[] {
  const normalizedBaseName = baseName.trim();

  if (!normalizedBaseName) {
    throw new Error('Informe o nome-base das turmas.');
  }

  if (!Number.isInteger(count) || count < 1 || count > 26) {
    throw new Error('A quantidade de turmas deve estar entre 1 e 26.');
  }

  return Array.from({ length: count }, (_, index) =>
    classNameForLetter(normalizedBaseName, classLetter(index), shift),
  );
}

export function buildAvailableClassBatchNames(
  baseName: string,
  count: number,
  existingNames: readonly string[],
  shift?: string | null,
): string[] {
  const normalizedBaseName = baseName.trim();
  const normalizedExistingNames = new Set(existingNames.map(normalizeClassName));
  const names: string[] = [];

  for (let index = 0; index < 26 && names.length < count; index += 1) {
    const letter = classLetter(index);
    const candidate = classNameForLetter(normalizedBaseName, letter, shift);
    const legacyCandidate = classNameForLetter(normalizedBaseName, letter);

    // Older records could use the unsuffixed base name. Treat it as the
    // first section so a later automatic creation continues with B.
    const legacyFirstSectionIsUsed = index === 0 &&
      normalizedExistingNames.has(normalizeClassName(normalizedBaseName));

    if (
      legacyFirstSectionIsUsed ||
      normalizedExistingNames.has(normalizeClassName(candidate)) ||
      (Boolean(getClassShiftSuffix(shift)) &&
        normalizedExistingNames.has(normalizeClassName(legacyCandidate)))
    ) {
      continue;
    }

    names.push(candidate);
  }

  if (names.length !== count) {
    throw new Error('Não há letras de turma disponíveis para esta série e turno.');
  }

  return names;
}
