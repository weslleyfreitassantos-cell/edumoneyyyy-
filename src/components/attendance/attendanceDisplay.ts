import type {
  AttendanceStatus,
  AttendanceSummary,
} from '../../services/attendanceService';

export const ATTENDANCE_STATUS_LABELS: Record<
  AttendanceStatus,
  string
> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Atraso',
  EXCUSED: 'Justificada',
};

export function formatAttendanceDate(
  value: string,
): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export function getTodayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthStartDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(
    2,
    '0',
  );

  return `${year}-${month}-01`;
}

export function formatAttendanceRate(
  summary: AttendanceSummary,
): string {
  return `${summary.attendanceRate.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
}

export function getAttendanceStatusClassName(
  status: AttendanceStatus,
): string {
  if (status === 'PRESENT') {
    return 'bg-green-50 text-green-700 ring-green-200';
  }

  if (status === 'ABSENT') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  if (status === 'LATE') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  return 'bg-blue-50 text-[#005bbf] ring-blue-200';
}
