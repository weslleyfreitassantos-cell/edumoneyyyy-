import type { ReactNode } from 'react';

import ProfileHeroAvatar from './ProfileHeroAvatar';

interface DashboardLoadingShellProps {
  areaLabel: string;
  heading: string;
  fullName: string;
  avatarUrl?: string | null;
  fallback: ReactNode;
  statusLabel: string;
}

export default function DashboardLoadingShell({
  areaLabel,
  heading,
  fullName,
  avatarUrl,
  fallback,
  statusLabel,
}: DashboardLoadingShellProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#005bbf] to-[#1a73e8] p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              {areaLabel}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {heading}
            </h1>
          </div>
          <ProfileHeroAvatar
            avatarUrl={avatarUrl}
            fullName={fullName}
            fallback={fallback}
          />
        </div>
      </section>

      <section role="status" aria-label={statusLabel} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={`metric-${index}`}
              className="h-24 animate-pulse rounded-xl border border-[#dfe3e8] bg-white motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={`panel-${index}`}
              className="h-56 animate-pulse rounded-xl border border-[#dfe3e8] bg-white motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
