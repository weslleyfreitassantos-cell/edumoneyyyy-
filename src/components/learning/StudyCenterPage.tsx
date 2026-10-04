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
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useStudentAdaptiveTarget } from '../../hooks/useAdaptiveLearning';
import {
  useGuidedLearningSessionV2,
  useLearningSkills,
  useLearningStudent,
  useLearningUnits,
  usePublishedLearningActivities,
  useStartGuidedLearningSessionV2,
  useStudentLearningSubjects,
  useLearningSimulations,
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

function subjectMatchesArea(subjectName: string, area: string | null | undefined): boolean {
  if (!area) return false;
  const normalizedName = subjectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const normalizedArea = area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  return normalizedName.includes(normalizedArea) || normalizedArea.includes(normalizedName);
}

export default function StudyCenterPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [startingSubjectId, setStartingSubjectId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const simulations = useLearningSimulations(currentInstitutionId ?? undefined);
  const guidedSession = useGuidedLearningSessionV2(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const startGuidedSession = useStartGuidedLearningSessionV2(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const adaptiveTarget = useStudentAdaptiveTarget(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubjectId);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, selectedUnitId);

  const selectedSubject = (subjects.data ?? []).find((item) => item.id === selectedSubjectId);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubjectId),
    [activities.data, selectedSubjectId],
  );
  const filteredSubjects = useMemo(() => {
    const normalizedSearch = search.toLocaleLowerCase('pt-BR').trim();
    if (!normalizedSearch) return subjects.data ?? [];
    return (subjects.data ?? []).filter((subject) => subject.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  }, [search, subjects.data]);
  const hasActiveGuidedSession = ['ACTIVE', 'PAUSED'].includes(guidedSession.data?.status ?? '');
  const hasEnemSimulation = (simulations.data ?? []).some(
    (simulation) => simulation.source_year || simulation.title.toLocaleLowerCase('pt-BR').includes('enem'),
  );

  const selectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedUnitId('');
    setStartError(null);
  };

  const startSubject = async (subject: { id: string; name: string }) => {
    setStartError(null);
    selectSubject(subject.id);
    const activity = (activities.data ?? []).find((item) => item.subject_id === subject.id);
    if (activity) {
      navigate(`/student/study/activity/${activity.id}`);
      return;
    }

    if (
      adaptiveTarget.data?.canonicalSkillId &&
      subjectMatchesArea(subject.name, adaptiveTarget.data.target.subjectArea)
    ) {
      setStartingSubjectId(subject.id);
      try {
        await startGuidedSession.mutateAsync(adaptiveTarget.data.canonicalSkillId);
        navigate('/student/study/guided');
      } catch {
        setStartError('Não foi possível abrir esta matéria agora. Tente novamente.');
      } finally {
        setStartingSubjectId(null);
      }
    }
  };

  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      <header className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm dark:border-blue-900/60 dark:from-blue-950/40 dark:to-slate-900 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Central de Estudos</p>
            <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100 sm:text-3xl">O que você quer estudar?</h1>
            <p className="mt-2 text-sm text-blue-900 dark:text-blue-200">Escolha uma matéria e avance no seu ritmo.</p>
          </div>
          {hasActiveGuidedSession ? (
            <Link to="/student/study/guided" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">
              <PlayCircle className="h-4 w-4" />Continuar estudo
            </Link>
          ) : null}
        </div>
      </header>

      <section id="study-subjects" aria-label="Matérias" className="space-y-4 scroll-mt-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Escolha uma matéria</h2>
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
            const isSelected = selectedSubjectId === subject.id;
            const isStarting = startingSubjectId === subject.id;
            return (
              <button
                key={subject.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => void startSubject(subject)}
                disabled={startGuidedSession.isPending || isStarting}
                className={`group flex min-h-28 items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#005bbf] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-wait disabled:opacity-70 dark:bg-slate-900 ${isSelected ? 'border-[#005bbf] ring-2 ring-blue-100 dark:ring-blue-900/60' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200"><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900 dark:text-white">{subject.name}</span><span className="mt-1 block text-xs font-semibold text-[#005bbf]">{isStarting ? 'Abrindo...' : 'Estudar'}</span></span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-[#005bbf]" />
              </button>
            );
          })}
        </div>
        {startError ? <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{startError}</p> : null}
      </section>

      {selectedSubject ? (
        <section aria-label={`Estudo de ${selectedSubject.name}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Matéria selecionada</p>
              <h2 className="mt-1 text-xl font-bold dark:text-white">{selectedSubject.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Continue de onde parou ou escolha um conteúdo.</p>
            </div>
            {subjectActivities[0] ? <Link to={`/student/study/activity/${subjectActivities[0].id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">Continuar</Link> : null}
          </div>
          {units.isLoading ? <p className="mt-5 text-sm text-slate-500">Carregando conteúdos...</p> : null}
          {units.data?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{units.data.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnitId === unit.id} className={`rounded-lg border p-3 text-left text-sm transition hover:border-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'dark:border-slate-700 dark:text-slate-200'}`}><span className="font-semibold">{unit.title}</span>{unit.description ? <span className="mt-1 block text-xs text-slate-500">{unit.description}</span> : null}</button>)}</div> : null}
          {selectedUnitId && skills.data?.length ? <div className="mt-4"><p className="text-sm font-bold dark:text-white">Conteúdos para praticar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{skills.data.map((skill) => <li key={skill.id} className="rounded-lg border p-3 text-sm dark:border-slate-700 dark:text-slate-200">{skill.title}</li>)}</ul></div> : null}
          {subjectActivities.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold dark:text-white">Atividades disponíveis</p>{subjectActivities.slice(0, 4).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">A próxima atividade desta matéria será preparada para você.</p>}
        </section>
      ) : null}

      <section aria-label="Preparação para o ENEM" className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Preparação para o ENEM</p>
            <h2 className="mt-1 text-xl font-bold text-indigo-950 dark:text-indigo-100">Simulado ENEM</h2>
            <p className="mt-1 text-sm text-indigo-900 dark:text-indigo-200">Questões oficiais para testar seus conhecimentos por área.</p>
          </div>
          <Link to="/student/study/simulation" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800"><PlayCircle className="h-4 w-4" />Começar simulado</Link>
        </div>
        {!simulations.isLoading && !hasEnemSimulation ? <p className="mt-3 text-xs text-indigo-800 dark:text-indigo-300">O próximo simulado será disponibilizado pela escola.</p> : null}
      </section>
    </div>
  );
}
