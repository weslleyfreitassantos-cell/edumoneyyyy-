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
      className={`inline-flex max-w-full flex-wrap items-center justify-end gap-1 rounded-lg border border-[#dfe3e8] bg-[#f7f9fc] p-1 dark:border-slate-700 dark:bg-slate-800/80 ${className}`}
    >
      {children}
    </div>
  );
}
