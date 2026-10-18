import type { LucideIcon } from 'lucide-react';
import { Accessibility, BookOpen, Download, GraduationCap, LayoutDashboard, Puzzle, TrendingUp, Youtube } from 'lucide-react';

export const inclusiveEducationMenuIcons: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  pei: GraduationCap,
  'aee-paee': Accessibility,
  activities: BookOpen,
  exercises: Puzzle,
  materials: Download,
  progress: TrendingUp,
  videos: Youtube,
};

export function InclusiveEducationBrand({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-20 w-20 sm:h-24 sm:w-24' : size === 'sm' ? 'h-8 w-8' : 'h-12 w-12';
  return <span className={`inline-grid shrink-0 place-items-center rounded-2xl bg-white/90 p-1.5 shadow-sm ${dimensions}`} role="img" aria-label="Marca Educação Inclusiva Tec Escola">
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#8cc8ee" strokeWidth="3" />
      <g fill="none" strokeWidth="8" strokeLinecap="round">
        <path d="M50 7v18" stroke="#e34d65" /><path d="M93 50H75" stroke="#2f9ed7" /><path d="M50 93V75" stroke="#f2bd3f" /><path d="M7 50h18" stroke="#73ad45" />
      </g>
      <g fill="#075fc4"><circle cx="50" cy="31" r="6" /><path d="M42 42c3-8 13-8 16 0l5 18H37z" /></g>
      <g fill="#b14b9b"><circle cx="69" cy="50" r="5" /><path d="M62 59c4-7 10-7 14 0l3 12H59z" /></g>
      <g fill="#48a99e"><circle cx="31" cy="50" r="5" /><path d="M24 59c4-7 10-7 14 0l3 12H21z" /></g>
      <circle cx="50" cy="68" r="10" fill="#fff" stroke="#075fc4" strokeWidth="3" /><path d="M45 68h10M50 63v10" stroke="#075fc4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </span>;
}
