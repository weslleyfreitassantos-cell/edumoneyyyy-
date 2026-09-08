interface StatusBadgeProps {
  active: boolean | null;
  activeLabel?: string;
  inactiveLabel?: string;
  unknownLabel?: string;
}

const baseClassName = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold';

export default function StatusBadge({
  active,
  activeLabel = 'Ativo',
  inactiveLabel = 'Inativo',
  unknownLabel = 'Status não informado',
}: StatusBadgeProps) {
  if (active === null) {
    return (
      <span className={`${baseClassName} border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
        {unknownLabel}
      </span>
    );
  }

  return (
    <span
      className={
        active
          ? `${baseClassName} border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200`
          : `${baseClassName} border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`
      }
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
