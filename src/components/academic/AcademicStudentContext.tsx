import type { ReactNode } from 'react';

interface AcademicStudentContextProps {
  studentName: string;
  registrationNumber?: string | null;
  className?: string | null;
  academicYearName?: string | null;
  children?: ReactNode;
}

export default function AcademicStudentContext({
  studentName,
  registrationNumber,
  className,
  academicYearName,
  children,
}: AcademicStudentContextProps) {
  const details = [
    registrationNumber ? `RA ${registrationNumber}` : null,
    className ?? 'Sem matrícula ativa',
    academicYearName,
  ].filter(Boolean);

  return (
    <section
      aria-label="Contexto acadêmico"
      className="rounded-xl border border-[#dfe3e8] bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-[#181c20] dark:text-slate-100">
            {studentName}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[#727785] dark:text-slate-400">
            {details.map((detail, index) => (
              <span key={`${detail}-${index}`}>
                {index > 0 && <span aria-hidden="true">· </span>}
                {detail}
              </span>
            ))}
          </p>
        </div>

        {children && <div className="w-full shrink-0 sm:w-auto sm:min-w-64">{children}</div>}
      </div>
    </section>
  );
}
