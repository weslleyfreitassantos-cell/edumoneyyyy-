export interface AcademicTermDateRange {
  id: string;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  active?: boolean | null;
}

export function getLocalDateInputValue(
  value: Date = new Date(),
): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isAcademicTermDateWithinRange(
  value: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  if (!startDate || !endDate) {
    return false;
  }

  const date = value.slice(0, 10);
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);

  return start <= date && date <= end;
}

export function getAcademicTermForDate<
  T extends AcademicTermDateRange,
>(
  terms: readonly T[],
  value: string = getLocalDateInputValue(),
): T | null {
  const activeTerms = terms.filter(
    (term) => term.active !== false,
  );

  return (
    activeTerms.find((term) =>
      isAcademicTermDateWithinRange(
        value,
        term.startDate,
        term.endDate,
      ),
    ) ??
    [...activeTerms]
      .filter((term) => term.startDate && term.endDate)
      .sort((left, right) =>
        left.startDate!.localeCompare(right.startDate!),
      )[0] ??
    activeTerms[0] ??
    null
  );
}
