import {
  ClipboardList,
  Divide,
  Percent,
  TimerReset,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { GradeSummary } from '../../services/gradeService';
import {
  formatGradeSummaryAverage,
  formatPercent,
} from './gradeDisplay';

function Metric({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis
      ? 'rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30'
      : 'rounded-lg border border-[#dfe3e8] bg-white p-4 dark:border-slate-700 dark:bg-slate-800'}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#005bbf] dark:bg-slate-800 dark:text-blue-300">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-[#727785] dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-lg font-bold text-[#181c20] dark:text-slate-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function GradeSummaryCard({
  summary,
}: {
  summary: GradeSummary;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        label="Média ponderada"
        value={formatPercent(summary.weightedAveragePercent)}
        emphasis
        icon={
          <Percent
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Média simples"
        value={formatGradeSummaryAverage(summary)}
        icon={
          <Divide
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Avaliações registradas"
        value={summary.gradedCount}
        icon={
          <ClipboardList
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />

      <Metric
        label="Avaliações pendentes"
        value={summary.pendingCount}
        icon={
          <TimerReset
            className="h-4 w-4"
            aria-hidden="true"
          />
        }
      />
    </div>
  );
}
