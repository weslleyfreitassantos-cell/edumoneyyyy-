import { LoaderCircle } from 'lucide-react';

export default function LoadingIndicator({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 text-sm font-medium text-slate-500">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#005bbf]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
