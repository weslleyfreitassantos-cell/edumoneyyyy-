import {
  Atom,
  BookOpen,
  Calculator,
  ChevronRight,
  Dna,
  Dumbbell,
  FlaskConical,
  Globe2,
  Languages,
  Landmark,
  Palette,
  PlayCircle,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useGuidedLearningSessionV2,
  useLearningStudent,
  useStudentLearningSubjects,
  useEnemSimulationTemplates,
} from '../../hooks/useLearningCenter';

const subjectIcons: Record<string, LucideIcon> = {
  arte: Palette,
  biologia: Dna,
  'educacao fisica': Dumbbell,
  filosofia: BookOpen,
  fisica: Atom,
  geografia: Globe2,
  historia: Landmark,
  'lingua inglesa': Languages,
  'lingua portuguesa': Languages,
  matematica: Calculator,
  quimica: FlaskConical,
};

function subjectIcon(subject: string): LucideIcon {
  const normalized = subject
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

  return subjectIcons[normalized] ?? BookOpen;
}

export default function StudyCenterPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [search, setSearch] = useState('');

  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const enemTemplates = useEnemSimulationTemplates(currentInstitutionId ?? undefined);
  const guidedSession = useGuidedLearningSessionV2(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const filteredSubjects = useMemo(() => {
    const normalizedSearch = search.toLocaleLowerCase('pt-BR').trim();
    if (!normalizedSearch) return subjects.data ?? [];
    return (subjects.data ?? []).filter((subject) => subject.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  }, [search, subjects.data]);
  const hasActiveGuidedSession = ['ACTIVE', 'PAUSED'].includes(guidedSession.data?.status ?? '');
  const enemAreas = (enemTemplates.data ?? []).filter((template) => template.simulation_type === 'AREA');
  const enemSubjects = (enemTemplates.data ?? []).filter((template) => template.simulation_type === 'SUBJECT');
  const subjectCount = subjects.data?.length ?? 0;

  return (
    <div className="w-full space-y-8 overflow-x-hidden">
      <header className="overflow-hidden rounded-2xl border border-blue-900/20 bg-[#073b78] text-white shadow-sm dark:border-blue-800">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">O que você quer estudar?</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">Escolha uma matéria para continuar praticando ou reserve um momento para se preparar para o ENEM.</p>
          </div>
          {hasActiveGuidedSession ? (
            <Link to="/student/study/guided" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#073b78] shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <PlayCircle className="h-4 w-4" aria-hidden="true" />Continuar estudo
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 bg-black/10 px-5 py-3 text-xs font-semibold text-blue-100 sm:px-8">
          <span>{subjectCount} {subjectCount === 1 ? 'matéria disponível' : 'matérias disponíveis'}</span>
          <span>Aprenda no seu ritmo</span>
        </div>
      </header>

      <section aria-label="Preparação para o ENEM" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30 sm:p-6">
        <div className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300"><Landmark className="mt-0.5 h-5 w-5" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.16em]">Preparação para o ENEM</p><h2 className="mt-2 text-2xl font-bold text-indigo-950 dark:text-indigo-100">Práticas oficiais</h2><p className="mt-1 text-sm text-indigo-900 dark:text-indigo-200">Escolha uma área ou pratique uma matéria com questões oficiais disponíveis.</p></div></div>
        {enemTemplates.isLoading ? <p className="mt-5 text-sm text-indigo-800 dark:text-indigo-200">Verificando práticas disponíveis...</p> : null}
        {enemTemplates.isError ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-white/70 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-slate-900/40 dark:text-rose-200">Não foi possível verificar as práticas oficiais agora.</p> : null}
        {!enemTemplates.isLoading && enemTemplates.data?.length ? <div className="mt-5 space-y-5">
          {enemAreas.length ? <div><h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Simulados por área</h3><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{enemAreas.map((template) => <Link key={template.id} to={`/student/study/simulation?simulation=${template.id}`} className="rounded-xl border border-indigo-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow-sm dark:border-indigo-800 dark:bg-slate-900"><p className="font-bold text-slate-900 dark:text-white">{template.title}</p><p className="mt-1 text-xs text-slate-500">{template.question_count} questões · {template.duration_minutes ?? 90} min</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300"><PlayCircle className="h-4 w-4" />Começar</span></Link>)}</div></div> : null}
          {enemSubjects.length ? <div><h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Práticas rápidas por matéria</h3><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{enemSubjects.map((template) => <Link key={template.id} to={`/student/study/simulation?simulation=${template.id}`} className="rounded-xl border border-indigo-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow-sm dark:border-indigo-800 dark:bg-slate-900"><p className="font-bold text-slate-900 dark:text-white">{template.title}</p><p className="mt-1 text-xs text-slate-500">{template.question_count} questões · {template.duration_minutes ?? 20} min</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300"><PlayCircle className="h-4 w-4" />Praticar</span></Link>)}</div></div> : null}
        </div> : null}
        {!enemTemplates.isLoading && !enemTemplates.data?.length ? <p className="mt-5 rounded-xl border border-dashed border-indigo-300 bg-white/60 p-4 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-slate-900/40 dark:text-indigo-200">As práticas aparecem aqui assim que o banco oficial passar pela validação de conteúdo e imagens.</p> : null}
      </section>

      <section id="study-subjects" aria-label="Matérias" className="space-y-4 scroll-mt-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Matérias</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Comece pelo conteúdo que você quer praticar hoje.</p>
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Pesquisar matéria</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Pesquisar matéria"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar matéria"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>

        {subjects.isLoading ? <p className="text-sm text-slate-500">Carregando matérias...</p> : null}
        {subjects.isError ? <p role="alert" className="text-sm text-red-700">Não foi possível carregar suas matérias.</p> : null}
        {!subjects.isLoading && !subjects.isError && filteredSubjects.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Nenhuma matéria encontrada.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((subject) => {
            const Icon = subjectIcon(subject.name);
            return (
              <Link
                key={subject.id}
                to={`/student/study/subject/${subject.id}`}
                className="group flex min-h-32 items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#005bbf] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:bg-slate-900 dark:border-slate-700"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900 dark:text-white">{subject.name}</span><span className="mt-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">Abrir matéria</span></span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-[#005bbf]" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
