import {
  Atom,
  ArrowRight,
  Brain,
  Calculator,
  BookOpen,
  Dna,
  Dumbbell,
  CheckCircle2,
  Circle,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Globe2,
  Languages,
  Landmark,
  Palette,
  PlayCircle,
  Search,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningProgress,
  useLearningSkills,
  useLearningStudent,
  useLearningUnits,
  useStudentLearningCollections,
  usePublishedLearningActivities,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';
import type { LearningActivity } from '../../services/learningCenterService';

function subjectName(activity: LearningActivity): string | undefined {
  return Array.isArray(activity.subjects)
    ? activity.subjects[0]?.name
    : activity.subjects?.name;
}

function statusLabel(status: string): string {
  if (status === 'MASTERED') return 'Dominado';
  if (status === 'IN_PROGRESS') return 'Em progresso';
  return 'Não iniciado';
}

const subjectIcons: Record<string, LucideIcon> = {
  arte: Palette,
  biologia: Dna,
  'educacao fisica': Dumbbell,
  filosofia: Brain,
  fisica: Atom,
  geografia: Globe2,
  historia: Landmark,
  'lingua inglesa': Languages,
  'lingua portuguesa': Languages,
  matematica: Calculator,
  quimica: FlaskConical,
  sociologia: UsersRound,
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
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const student = useLearningStudent(
    currentInstitutionId ?? undefined,
    profile?.id,
  );
  const subjects = useStudentLearningSubjects(
    currentInstitutionId ?? undefined,
    profile?.id,
  );
  const units = useLearningUnits(
    currentInstitutionId ?? undefined,
    selectedSubjectId,
  );
  const skills = useLearningSkills(
    currentInstitutionId ?? undefined,
    selectedUnitId,
  );
  const activities = usePublishedLearningActivities(
    currentInstitutionId ?? undefined,
    profile?.id,
  );
  const collections = useStudentLearningCollections(
    currentInstitutionId ?? undefined,
  );
  const progress = useLearningProgress(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );

  const normalizedSearch = search.toLocaleLowerCase('pt-BR').trim();
  const filteredSubjects = (subjects.data ?? []).filter((item) => {
    if (!normalizedSearch) return true;
    if (item.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)) {
      return true;
    }

    return (activities.data ?? []).some((activity) => {
      if (activity.subject_id !== item.id) return false;
      return `${activity.title} ${activity.description ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch);
    });
  });
  const selectedActivities = (activities.data ?? []).filter(
    (activity) =>
      (!selectedSubjectId || activity.subject_id === selectedSubjectId) &&
      (!selectedUnitId || activity.unit_id === selectedUnitId) &&
      (!normalizedSearch ||
        `${activity.title} ${activity.description ?? ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedSearch)),
  );
  const progressBySkill = useMemo(
    () => new Map((progress.data ?? []).map((item) => [item.skill_id, item])),
    [progress.data],
  );
  const progressSummary = useMemo(() => {
    const values = progress.data ?? [];
    return {
      mastered: values.filter((item) => item.status === 'MASTERED').length,
      inProgress: values.filter((item) => item.status === 'IN_PROGRESS').length,
      average: values.length
        ? Math.round(
            values.reduce((total, item) => total + item.mastery_percent, 0) /
              values.length,
          )
        : 0,
    };
  }, [progress.data]);

  const selectedSubject = (subjects.data ?? []).find(
    (subject) => subject.id === selectedSubjectId,
  );

  const selectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedUnitId('');
  };

  const clearSubject = () => {
    setSelectedSubjectId('');
    setSelectedUnitId('');
  };

  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      <header className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Olá, {profile?.full_name?.split(' ')[0] ?? 'aluno'}. O que vamos estudar hoje?
        </p>

        <div className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-4">
            <p className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              {progressSummary.average}%
            </p>
            <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs">
              domínio médio
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-4">
            <p className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              {activities.data?.length ?? 0}
            </p>
            <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs">
              práticas disponíveis
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-4">
            <p className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              {collections.data?.length ?? 0}
            </p>
            <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs">
              coleções
            </p>
          </div>
        </div>
      </header>

      <nav
        aria-label="Seções da Central de Estudos"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {[
          ['study-subjects', 'Matérias'],
          ['study-practice', 'Práticas'],
          ['study-resources', 'Coleções'],
          ['study-progress', 'Progresso'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#005bbf] hover:text-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {label}
          </a>
        ))}
      </nav>

      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          type="search"
          aria-label="Pesquisar matéria ou assunto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar matéria ou atividade"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Limpar pesquisa"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      <section id="study-subjects" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Minhas matérias</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Escolha uma matéria para continuar sua trilha.
            </p>
          </div>
          {selectedSubjectId && (
            <button
              type="button"
              onClick={clearSubject}
              className="shrink-0 text-xs font-bold text-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              Ver todas
            </button>
          )}
        </div>
        {subjects.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando matérias...</p>
        ) : subjects.isError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            Não foi possível carregar as matérias da sua turma.
          </p>
        ) : filteredSubjects.length ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {filteredSubjects.map((subject) => {
              const Icon = subjectIcon(subject.name);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => selectSubject(subject.id)}
                  aria-pressed={selectedSubjectId === subject.id}
                  className={`flex min-h-16 min-w-[220px] snap-start items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] sm:min-w-0 ${selectedSubjectId === subject.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  <Icon className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-semibold dark:text-white">{subject.name}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nenhuma matéria disponível no seu contexto.
          </p>
        )}
      </section>

      {selectedSubjectId && (
        <section id="study-trail" className="grid scroll-mt-24 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#005bbf]" />
              <div>
                <h2 className="font-bold dark:text-white">Minha trilha</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedSubject?.name}</p>
              </div>
            </div>
            {units.isLoading ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Carregando unidades...</p>
            ) : units.data?.length ? (
              <div className="mt-4 space-y-2">
                {units.data.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => setSelectedUnitId(unit.id)}
                    aria-pressed={selectedUnitId === unit.id}
                    className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] text-[#005bbf]' : 'border-slate-200 dark:border-slate-700 dark:text-slate-200'}`}
                  >
                    <span className="font-semibold">{unit.title}</span>
                    <span aria-hidden="true">{selectedUnitId === unit.id ? '−' : '+'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">A trilha desta matéria ainda está sendo preparada.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#005bbf]" />
              <h2 className="font-bold dark:text-white">Habilidades</h2>
            </div>
            {!selectedUnitId ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Escolha uma unidade para ver as habilidades.</p>
            ) : skills.isLoading ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Carregando habilidades...</p>
            ) : skills.data?.length ? (
              <div className="mt-4 space-y-3">
                {skills.data.map((skill) => {
                  const item = progressBySkill.get(skill.id);
                  return (
                    <div key={skill.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-semibold dark:text-white">
                          {item?.status === 'MASTERED' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-400" />}
                          <span className="break-words">{skill.title}</span>
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{statusLabel(item?.status ?? 'NOT_STARTED')}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="h-2 rounded-full bg-[#005bbf]" style={{ width: `${item?.mastery_percent ?? 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nenhuma habilidade cadastrada nesta unidade.</p>
            )}
          </div>
        </section>
      )}

      <section id="study-practice" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="font-bold dark:text-white">Práticas recomendadas</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Atividades para avançar no seu ritmo.</p>
            </div>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </div>
        {activities.isLoading || activities.isFetching ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Atualizando práticas...</p>
        ) : activities.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">Não foi possível carregar as práticas agora.</p>
        ) : selectedActivities.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedActivities.map((activity) => (
              <Link
                key={activity.id}
                to={`/student/study/activity/${activity.id}`}
                className="flex min-h-32 flex-col rounded-lg border border-slate-200 p-4 transition hover:border-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700"
              >
                <p className="font-semibold dark:text-white">{activity.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {subjectName(activity) ?? 'Prática'} · {activity.learning_questions?.length ?? 0} questões
                </p>
                <span className="mt-auto inline-flex items-center gap-2 pt-4 text-xs font-bold text-[#005bbf]">
                  <PlayCircle className="h-4 w-4" />
                  Começar atividade
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {selectedSubjectId
              ? 'Nenhuma atividade foi atribuída para esta matéria e sua turma ainda.'
              : 'As atividades atribuídas pelos seus professores aparecerão aqui.'}
          </p>
        )}
      </section>

      <section id="study-resources" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-[#005bbf]" />
            <div>
              <h2 className="font-bold dark:text-white">Explorar coleções</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Materiais selecionados pelos professores.</p>
            </div>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </div>
        {collections.isLoading ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Carregando coleções...</p>
        ) : collections.data?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {collections.data.map((collection) => (
              <article key={collection.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="font-semibold dark:text-white">{collection.title}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{collection.description ?? 'Conteúdos selecionados pelo professor.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(collection.learning_resources ?? []).map((resource) => (
                    <a key={resource.id} href={resource.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-[#005bbf] px-3 py-2 text-xs font-bold text-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="break-words">{resource.title}</span>
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Coleções e recursos curados pelos professores aparecerão aqui.</p>
        )}
      </section>

      <section id="study-progress" className="scroll-mt-24 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30 sm:p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#005bbf]" />
          <h2 className="font-bold text-blue-900 dark:text-blue-200">Meu progresso</h2>
        </div>
        {progress.isLoading || student.isLoading ? (
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">Calculando seu progresso...</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3 text-blue-900 dark:text-blue-200">
            <span><strong className="block text-xl">{progressSummary.average}%</strong><span className="text-xs">domínio médio</span></span>
            <span><strong className="block text-xl">{progressSummary.mastered}</strong><span className="text-xs">dominadas</span></span>
            <span><strong className="block text-xl">{progressSummary.inProgress}</strong><span className="text-xs">em progresso</span></span>
          </div>
        )}
      </section>
    </div>
  );
}
