export const ACADEMIC_LEVEL_VALUES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '1 EM',
  '2 EM',
  '3 EM',
] as const;

export type AcademicLevel = (typeof ACADEMIC_LEVEL_VALUES)[number];

export interface AcademicLevelOption {
  value: AcademicLevel;
  label: string;
  stage: 'Ensino Fundamental' | 'Ensino Médio';
}

export const ACADEMIC_LEVEL_OPTIONS: readonly AcademicLevelOption[] = [
  ...ACADEMIC_LEVEL_VALUES.slice(0, 9).map((value) => ({
    value,
    label: `${value}º ano`,
    stage: 'Ensino Fundamental' as const,
  })),
  ...ACADEMIC_LEVEL_VALUES.slice(9).map((value) => ({
    value,
    label: `${value.charAt(0)}ª série do Ensino Médio`,
    stage: 'Ensino Médio' as const,
  })),
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ºª°]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeAcademicLevel(value: string | null | undefined): AcademicLevel | null {
  if (!value?.trim()) return null;

  const normalized = normalizeText(value);
  const highSchoolMatch = normalized.match(
    /\b([1-3])\b.*(?:\bem\b|ensino medio|medio)/,
  );

  if (highSchoolMatch) {
    return `${highSchoolMatch[1]} EM` as AcademicLevel;
  }

  const fundamentalMatch = normalized.match(/\b([1-9])\b/);
  return fundamentalMatch
    ? (fundamentalMatch[1] as AcademicLevel)
    : null;
}

export function getAcademicLevelLabel(value: string | null | undefined): string {
  const normalized = normalizeAcademicLevel(value);
  return ACADEMIC_LEVEL_OPTIONS.find((option) => option.value === normalized)?.label
    ?? value
    ?? 'Série não informada';
}
