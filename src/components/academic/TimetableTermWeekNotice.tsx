import {
  getDateForWeekDay,
  getTimetableWeekTermRelation,
  type TimetableWeekTermRelation,
} from '../../lib/academic/timetableOccurrences';

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function getNoticeCopy(
  relation: TimetableWeekTermRelation,
  termName: string | null | undefined,
  termStartDate: string,
  termEndDate: string,
): { title: string; description: string } | null {
  const periodLabel = termName ? ` do ${termName}` : ' do período atual';

  if (relation === 'CROSSES_START') {
    return {
      title: `Esta semana cruza o início${periodLabel}`,
      description: `As aulas só aparecem a partir de ${formatDate(termStartDate)}. As datas anteriores pertencem a outro período.`,
    };
  }

  if (relation === 'CROSSES_END') {
    return {
      title: `Esta semana cruza o fim${periodLabel}`,
      description: `As aulas só aparecem até ${formatDate(termEndDate)}. As datas seguintes pertencem a outro período.`,
    };
  }

  if (relation === 'BEFORE' || relation === 'AFTER') {
    return {
      title: `Esta semana está fora${periodLabel}`,
      description: `O período válido vai de ${formatDate(termStartDate)} a ${formatDate(termEndDate)}. Navegue até uma semana dentro desse intervalo para ver as aulas.`,
    };
  }

  return null;
}

export default function TimetableTermWeekNotice({
  weekStartDate,
  termName,
  termStartDate,
  termEndDate,
}: {
  weekStartDate: string;
  termName?: string | null;
  termStartDate?: string | null;
  termEndDate?: string | null;
}) {
  if (!termStartDate || !termEndDate) {
    return null;
  }

  const copy = getNoticeCopy(
    getTimetableWeekTermRelation(weekStartDate, termStartDate, termEndDate),
    termName,
    termStartDate,
    termEndDate,
  );

  if (!copy) {
    return null;
  }

  return (
    <aside
      className="rounded-xl border border-[#f2c46d] bg-[#fff8e7] px-4 py-3 text-sm text-[#8a4b08]"
      data-testid="timetable-term-week-notice"
      role="note"
    >
      <p className="font-bold">{copy.title}</p>
      <p className="mt-1 text-xs leading-5">{copy.description}</p>
      <p className="mt-1 text-xs font-medium">
        Semana: {formatDate(weekStartDate)} a {formatDate(getDateForWeekDay(weekStartDate, 6))}
      </p>
    </aside>
  );
}
