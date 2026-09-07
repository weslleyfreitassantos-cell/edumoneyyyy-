import type { ReactNode } from 'react';

interface ActionGroupProps {
  children: ReactNode;
  className?: string;
}

export function ActionGroup({
  children,
  className = '',
}: ActionGroupProps) {
  return (
    <div
      className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-[#dfe3e8] bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-800/60 ${className}`}
    >
      {children}
    </div>
  );
}
