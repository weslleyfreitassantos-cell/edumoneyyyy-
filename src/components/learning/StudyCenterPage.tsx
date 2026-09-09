import {
  Atom,
  Brain,
  Calculator,
  BookOpen,
  Dna,
  Dumbbell,
  CheckCircle2,
  Circle,
  GraduationCap,
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

  const filteredSubjects = (subjects.data ?? []).filter((item) =>
    item.name
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const selectedActivities = (activities.data ?? []).filter(
    (activity) =>
      (!selectedSubjectId || activity.subject_id === selectedSubjectId) &&
      (!selectedUnitId || activity.unit_id === selectedUnitId),
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

  const selectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedUnitId('');
    void activities.refetch();
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-[#005bbf]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">
              Aluno
            </p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Central de Estudos
            </h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Olá, {profile?.full_name?.split(' ')[0] ?? 'aluno'}. O que vamos estudar hoje?
        </p>
      </header>

      <label className="flex max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          aria-label="Pesquisar matéria ou assunto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar matéria ou assunto"
          className="w-full bg-transparent text-sm outline-none dark:text-white"
        />
      </label>

      <section>
        <h2 className="mb-3 font-bold dark:text-white">Minhas matérias</h2>
        {subjects.isLoading ? (
          <p className="text-sm text-slate-500">Carregando matérias...</p>
        ) : subjects.isError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar as matérias da sua turma.
          </p>
        ) : filteredSubjects.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubjects.map((subject) => {
              const Icon = subjectIcon(subject.name);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => selectSubject(subject.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition ${selectedSubjectId === subject.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  <Icon className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
                  <span className="font-semibold dark:text-white">{subject.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
            Nenhuma matéria disponível no seu contexto.
          </p>
        )}
      </section>

      {selectedSubjectId && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#005bbf]" />
              <h2 className="font-bold dark:text-white">Minha trilha</h2>
            </div>
            {units.isLoading ? (
              <p className="mt-4 text-sm text-slate-500">Carregando unidades...</p>
            ) : units.data?.length ? (
              <div className="mt-4 space-y-2">
                {units.data.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm ${selectedUnitId === unit.id ? 'border-[#005bbf] text-[#005bbf]' : 'border-slate-200 dark:border-slate-700 dark:text-slate-200'}`}
                  >
                    <span className="font-semibold">{unit.title}</span>
                    <span aria-hidden="true">{selectedUnitId === unit.id ? '−' : '+'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">A trilha desta matéria ainda está sendo preparada.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#005bbf]" />
              <h2 className="font-bold dark:text-white">Habilidades</h2>
            </div>
            {!selectedUnitId ? (
              <p className="mt-4 text-sm text-slate-500">Escolha uma unidade para ver as habilidades.</p>
            ) : skills.isLoading ? (
              <p className="mt-4 text-sm text-slate-500">Carregando habilidades...</p>
            ) : skills.data?.length ? (
              <div className="mt-4 space-y-3">
                {skills.data.map((skill) => {
                  const item = progressBySkill.get(skill.id);
                  return (
                    <div key={skill.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold dark:text-white">
                          {item?.status === 'MASTERED' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-400" />}
                          {skill.title}
                        </span>
                        <span className="text-xs text-slate-500">{statusLabel(item?.status ?? 'NOT_STARTED')}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="h-2 rounded-full bg-[#005bbf]" style={{ width: `${item?.mastery_percent ?? 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Nenhuma habilidade cadastrada nesta unidade.</p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold dark:text-white">Práticas recomendadas</h2>
        </div>
        {activities.isLoading || activities.isFetching ? (
          <p className="mt-3 text-sm text-slate-500">Atualizando práticas...</p>
        ) : activities.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-600">Não foi possível carregar as práticas agora.</p>
        ) : selectedActivities.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedActivities.map((activity) => (
              <Link
                key={activity.id}
                to={`/student/study/activity/${activity.id}`}
                className="rounded-lg border border-slate-200 p-4 hover:border-[#005bbf] dark:border-slate-700"
              >
                <p className="font-semibold dark:text-white">{activity.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {subjectName(activity) ?? 'Prática'} · {activity.learning_questions?.length ?? 0} questões
                </p>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#005bbf]">
                  <PlayCircle className="h-4 w-4" />
                  Começar atividade
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {selectedSubjectId
              ? 'Nenhuma atividade foi atribuída para esta matéria e sua turma ainda.'
              : 'As atividades atribuídas pelos seus professores aparecerão aqui.'}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-[#005bbf]" />
          <h2 className="font-bold dark:text-white">Explorar coleções</h2>
        </div>
        {collections.isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Carregando coleções...</p>
        ) : collections.data?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {collections.data.map((collection) => (
              <article key={collection.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="font-semibold dark:text-white">{collection.title}</p>
                <p className="mt-1 text-sm text-slate-500">{collection.description ?? 'Conteúdos selecionados pelo professor.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(collection.learning_resources ?? []).map((resource) => (
                    <a key={resource.id} href={resource.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] px-3 py-2 text-xs font-bold text-[#005bbf]">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {resource.title}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Coleções e recursos curados pelos professores aparecerão aqui.</p>
        )}
      </section>

      <section className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#005bbf]" />
          <h2 className="font-bold text-blue-900 dark:text-blue-200">Meu progresso</h2>
        </div>
        {progress.isLoading || student.isLoading ? (
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">Calculando seu progresso...</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-blue-900 dark:text-blue-200">
            <span><strong className="text-xl">{progressSummary.average}%</strong> domínio médio</span>
            <span><strong className="text-xl">{progressSummary.mastered}</strong> dominadas</span>
            <span><strong className="text-xl">{progressSummary.inProgress}</strong> em progresso</span>
          </div>
        )}
      </section>
    </div>
  );
}
