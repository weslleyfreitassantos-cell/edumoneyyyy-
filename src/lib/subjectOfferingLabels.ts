export interface SubjectOfferingLabelInput {
  subjectName: string;
  className: string;
  termName?: string | null;
}

export function formatSubjectOfferingLabel({
  subjectName,
  className,
  termName,
}: SubjectOfferingLabelInput): string {
  const normalizedClassName = className.trim();
  const classLabel = /^turma(?:\s|$)/i.test(normalizedClassName)
    ? normalizedClassName
    : `Turma ${normalizedClassName}`;

  return [subjectName.trim(), classLabel, termName?.trim()]
    .filter(Boolean)
    .join(' · ');
}
