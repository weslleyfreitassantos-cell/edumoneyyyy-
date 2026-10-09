import {
  Atom,
  BookOpen,
  Calculator,
  ChevronRight,
  Dna,
  Download,
  Dumbbell,
  FlaskConical,
  Globe2,
  Languages,
  Landmark,
  Palette,
  PencilLine,
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

const officialEnemDownloads = [
  {
    year: 2025,
    archiveUrl: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/2025',
    days: [
      {
        label: '1º dia · Caderno azul',
        examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf',
        answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D1_CD1.pdf',
        coverUrl: '/assets/enem-covers/2025-d1-cd1.png',
      },
      {
        label: '2º dia · Caderno amarelo',
        examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D2_CD5.pdf',
        answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2025_GB_impresso_D2_CD5.pdf',
        coverUrl: '/assets/enem-covers/2025-d2-cd5.png',
      },
    ],
  },
  {
    year: 2024,
    archiveUrl: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/2024',
    days: [
      {
        label: '1º dia · Caderno azul',
        examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D1_CD1.pdf',
        answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D1_CD1.pdf',
        coverUrl: '/assets/enem-covers/2024-d1-cd1.png',
      },
      {
        label: '2º dia · Caderno amarelo',
        examUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D2_CD5.pdf',
        answerKeyUrl: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D2_CD5.pdf',
        coverUrl: '/assets/enem-covers/2024-d2-cd5.png',
      },
    ],
  },
];

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
        <div className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300"><Landmark className="mt-0.5 h-5 w-5" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.16em]">Preparação para o ENEM</p><h2 className="mt-2 text-2xl font-bold text-indigo-950 dark:text-indigo-100">Práticas oficiais</h2><p className="mt-1 text-sm text-indigo-900 dark:text-indigo-200">Escolha uma área ou pratique uma matéria com questões oficiais disponíveis. Exercícios do Enem de 2009 até 2025.</p></div></div>
        {enemTemplates.isLoading ? <p className="mt-5 text-sm text-indigo-800 dark:text-indigo-200">Verificando práticas disponíveis...</p> : null}
        {enemTemplates.isError ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-white/70 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-slate-900/40 dark:text-rose-200">Não foi possível verificar as práticas oficiais agora.</p> : null}
        {!enemTemplates.isLoading && enemTemplates.data?.length ? <div className="mt-5 space-y-5">
          {enemAreas.length ? <div><h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Simulados por área</h3><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{enemAreas.map((template) => <Link key={template.id} to={`/student/study/simulation?simulation=${template.id}`} className="rounded-xl border border-indigo-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow-sm dark:border-indigo-800 dark:bg-slate-900"><p className="font-bold text-slate-900 dark:text-white">{template.title}</p><p className="mt-1 text-xs text-slate-500">{template.question_count} questões · {template.duration_minutes ?? 90} min</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300"><PlayCircle className="h-4 w-4" />Começar</span></Link>)}</div></div> : null}
          {enemSubjects.length ? <div><h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Práticas rápidas por matéria</h3><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{enemSubjects.map((template) => <Link key={template.id} to={`/student/study/simulation?simulation=${template.id}`} className="rounded-xl border border-indigo-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow-sm dark:border-indigo-800 dark:bg-slate-900"><p className="font-bold text-slate-900 dark:text-white">{template.title}</p><p className="mt-1 text-xs text-slate-500">{template.question_count} questões · {template.duration_minutes ?? 20} min</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300"><PlayCircle className="h-4 w-4" />Praticar</span></Link>)}</div></div> : null}
        </div> : null}
        {!enemTemplates.isLoading && !enemTemplates.data?.length ? <p className="mt-5 rounded-xl border border-dashed border-indigo-300 bg-white/60 p-4 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-slate-900/40 dark:text-indigo-200">As práticas aparecem aqui assim que o banco oficial passar pela validação de conteúdo e imagens.</p> : null}
        <section aria-labelledby="official-enem-downloads-title" className="mt-6 border-t border-indigo-200 pt-5 dark:border-indigo-800">
          <div className="flex items-start gap-2"><Download className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden="true" /><div><h3 id="official-enem-downloads-title" className="text-base font-bold text-indigo-950 dark:text-indigo-100">Provas e gabaritos oficiais</h3><p className="mt-1 text-sm text-indigo-900 dark:text-indigo-200">Baixe os cadernos oficiais do ENEM diretamente do portal do INEP.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {officialEnemDownloads.map((edition) => (
              <article key={edition.year} className="rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3"><h4 className="font-bold text-slate-900 dark:text-white">ENEM {edition.year}</h4><a href={edition.archiveUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">Ver todos</a></div>
                <div className="mt-3 space-y-3">
                  {edition.days.map((day) => (
                    <div key={day.label} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <a href={day.examUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${day.label} do ENEM ${edition.year}`} className="shrink-0 self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
                        <img src={day.coverUrl} alt={`Capa ${day.label} do ENEM ${edition.year}`} loading="lazy" decoding="async" className="h-32 w-24 rounded-md border border-slate-200 object-cover object-top shadow-sm dark:border-slate-700" />
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{day.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2"><a href={day.examUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white hover:bg-[#004d9f]"><Download className="h-3.5 w-3.5" aria-hidden="true" />Baixar prova</a><a href={day.answerKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"><Download className="h-3.5 w-3.5" aria-hidden="true" />Baixar gabarito</a></div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section aria-label="Módulo de redação" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#005bbf] shadow-sm dark:bg-slate-900 dark:text-blue-200">
              <PencilLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-200">Prática de escrita</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Redação</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Escreva, organize seus argumentos e revise seu texto.</p>
            </div>
          </div>
          <Link to="/student/study/writing" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#004d9f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200">
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Abrir módulo
          </Link>
        </div>
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
