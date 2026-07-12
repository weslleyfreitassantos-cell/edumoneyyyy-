import {
  CalendarCheck,
  Clock3,
  Percent,
  UserX,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { AttendanceSummary } from '../../services/attendanceService';
import {
  formatAttendanceRate,
} from './attendanceDisplay';

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#dfe3e8] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-[#727785]">
            {label}
          </p>
          <p className="mt-1 text-lg font-bold text-[#181c20]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceSummaryCard({
  summary,
}: {
  summary: AttendanceSummary;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        label="Presença"
        value={formatAttendanceRate(summary)}
        icon={
          <Percent
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Registros"
        value={summary.totalRecords}
        icon={
          <CalendarCheck
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Ausências"
        value={summary.absentRecords}
        icon={
          <UserX
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Atrasos"
        value={summary.lateRecords}
        icon={
          <Clock3
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />
    </div>
  );
}
