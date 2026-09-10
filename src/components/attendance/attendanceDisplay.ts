import type {
  AttendanceStatus,
  AttendanceSummary,
} from '../../services/attendanceService';
import {
  getLocalDateInputValue,
  isAcademicTermDateWithinRange,
} from '../../lib/academicTermDates';

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

export function formatAttendanceTime(
  value: string,
): string {
  return value.slice(0, 5);
}

export function getTodayDateInputValue(): string {
  return getLocalDateInputValue();
}

export function isAttendanceDateWithinPeriod(
  value: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  if (!startDate || !endDate) {
    return true;
  }

  return isAcademicTermDateWithinRange(
    value,
    startDate,
    endDate,
  );
}

export function getDateForAttendancePeriod(
  today: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  if (!startDate || !endDate) {
    return today;
  }

  if (today.slice(0, 10) < startDate.slice(0, 10)) {
    return startDate.slice(0, 10);
  }

  if (today.slice(0, 10) > endDate.slice(0, 10)) {
    return endDate.slice(0, 10);
  }

  return today;
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
