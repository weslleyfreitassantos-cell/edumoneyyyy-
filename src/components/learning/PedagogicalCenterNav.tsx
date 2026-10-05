import { Link, useLocation } from 'react-router-dom';

const links = [
  ['Turma', '/teacher/pedagogical-center'],
  ['Alunos', '/teacher/pedagogical-center/students'],
] as const;

export function PedagogicalCenterNav() {
  const location = useLocation();
  return <nav aria-label="Navegação de desempenho" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{links.map(([label, path]) => {
    const active = path === '/teacher/pedagogical-center'
      ? location.pathname === path
      : location.pathname.startsWith(path);
    return <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${active ? 'border-[#005bbf] bg-blue-50 text-[#005bbf] dark:bg-blue-950/40' : 'border-slate-200 bg-white text-slate-600 hover:border-[#005bbf] hover:text-[#005bbf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{label}</Link>;
  })}</nav>;
}

export function PedagogicalCenterHeader({ subtitle = 'Acompanhe sua turma e seus alunos.', showNav = true }: { subtitle?: string; showNav?: boolean }) {
  return <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Professor</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Desempenho</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>{showNav ? <div className="mt-4"><PedagogicalCenterNav /></div> : null}</header>;
}

export function PageState({ children, error = false }: { children: string; error?: boolean }) {
  return <p role={error ? 'alert' : undefined} className={`mt-4 text-sm ${error ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}>{children}</p>;
}
