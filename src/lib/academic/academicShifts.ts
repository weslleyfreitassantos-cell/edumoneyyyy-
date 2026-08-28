export const ACADEMIC_SHIFT_VALUES = [
  'MATUTINO',
  'VESPERTINO',
  'INTEGRAL',
  'NOTURNO',
] as const;

export type AcademicShift =
  (typeof ACADEMIC_SHIFT_VALUES)[number];

export interface AcademicShiftOption {
  value: AcademicShift;
  label: string;
  description: string;
}

export const ACADEMIC_SHIFT_OPTIONS: AcademicShiftOption[] = [
  {
    value: 'MATUTINO',
    label: 'Manhã',
    description: 'Aulas concentradas no período da manhã.',
  },
  {
    value: 'VESPERTINO',
    label: 'Tarde',
    description: 'Aulas concentradas no período da tarde.',
  },
  {
    value: 'INTEGRAL',
    label: 'Integral',
    description: 'Aulas distribuídas entre manhã e tarde.',
  },
  {
    value: 'NOTURNO',
    label: 'Noite',
    description: 'Aulas concentradas no período noturno.',
  },
];

const ACADEMIC_SHIFT_SET = new Set<string>(
  ACADEMIC_SHIFT_VALUES,
);

export function normalizeAcademicShift(
  shift: string | null | undefined,
): string {
  const normalized = (shift ?? '')
    .trim()
    .toLocaleUpperCase('pt-BR');

  if (normalized.includes('INTEGRAL')) return 'INTEGRAL';
  if (
    normalized.includes('VESPERT') ||
    normalized.includes('TARDE')
  ) {
    return 'VESPERTINO';
  }
  if (
    normalized.includes('NOTURN') ||
    normalized.includes('NOITE')
  ) {
    return 'NOTURNO';
  }
  if (
    normalized.includes('MATUT') ||
    normalized.includes('MANH')
  ) {
    return 'MATUTINO';
  }

  return normalized || 'MATUTINO';
}

export function toAcademicShift(
  shift: string | null | undefined,
): AcademicShift | null {
  if (!shift?.trim()) return null;

  const normalized = normalizeAcademicShift(shift);
  return ACADEMIC_SHIFT_SET.has(normalized)
    ? normalized as AcademicShift
    : null;
}

export function normalizeAcademicShifts(
  values: readonly unknown[] | null | undefined,
  fallback: readonly AcademicShift[] = ['MATUTINO'],
): AcademicShift[] {
  const normalized = new Set<AcademicShift>();

  for (const value of values ?? []) {
    if (typeof value !== 'string') continue;
    const shift = toAcademicShift(value);
    if (shift) normalized.add(shift);
  }

  const selected = ACADEMIC_SHIFT_VALUES.filter((shift) =>
    normalized.has(shift),
  );

  if (selected.length > 0) return selected;
  return [...fallback];
}

export function getAcademicShiftLabel(
  shift: string | null | undefined,
): string {
  const normalized = toAcademicShift(shift);
  return (
    ACADEMIC_SHIFT_OPTIONS.find((option) =>
      option.value === normalized,
    )?.label ?? shift?.trim() ?? 'Turno não informado'
  );
}
