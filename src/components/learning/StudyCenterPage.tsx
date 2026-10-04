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
  useStudentAdaptiveV3Plan,
  useStudentAdaptiveGuidance,
  useStudentAdaptiveTarget,
} from '../../hooks/useAdaptiveLearning';
import {
  useLearningProgress,
  useLearningCanonicalProgress,
  useLearningReviewsDue,
  useLearningSimulations,
  useLearningSimulationAttempts,
  useStudentLearningSimulationAssignments,
  useLearningDailyPlan,
  useLearningErrorNotebook,
  useLearningGamification,
  useStudentLearningPackages,
  useLearningSkills,
  useLearningStudent,
  useLearningUnits,
  useStudentLearningCollections,
  usePublishedLearningActivities,
  useStudentLearningSubjects,
  useGuidedLearningSession,
  useGuidedLearningSessionV2,
} from '../../hooks/useLearningCenter';
import type { LearningActivity } from '../../services/learningCenterService';
import { humanizePackageTitle, humanizeSkill, humanizeSubjectArea, packagePresentationKey } from '../../lib/learningPresentation';
import { StudentAdaptiveBridgeCard } from './KnowledgeGraphPanels';

function subjectName(activity: LearningActivity): string | undefined {
  return Array.isArray(activity.subjects)
    ? activity.subjects[0]?.name
    : activity.subjects?.name;
}

function statusLabel(status: string): string {
  if (status === 'MASTERED') return 'Dominado';
  if (status === 'IN_PROGRESS' || status === 'LEARNING' || status === 'PRACTICING') return 'Em progresso';
  if (status === 'NEEDS_REVIEW') return 'Precisa de revisão';
  if (status === 'INTRODUCED') return 'Introduzido';
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
  const [showSecondaryStudyAreas, setShowSecondaryStudyAreas] = useState(false);

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
    showSecondaryStudyAreas,
  );
  const progress = useLearningProgress(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const canonicalProgress = useLearningCanonicalProgress(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const reviewsDue = useLearningReviewsDue(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const dailyPlan = useLearningDailyPlan(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const gamification = useLearningGamification(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const errorNotebook = useLearningErrorNotebook(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const simulations = useLearningSimulations(currentInstitutionId ?? undefined, showSecondaryStudyAreas);
  const simulationAttempts = useLearningSimulationAttempts(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const simulationAssignments = useStudentLearningSimulationAssignments(
    currentInstitutionId ?? undefined,
    student.data?.id,
    showSecondaryStudyAreas,
  );
  const packages = useStudentLearningPackages(currentInstitutionId ?? undefined, student.data?.id);
  const guidedSessionV2 = useGuidedLearningSessionV2(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const guidedSession = useGuidedLearningSession(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const adaptiveTarget = useStudentAdaptiveTarget(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const adaptiveGuidance = useStudentAdaptiveGuidance(
    currentInstitutionId ?? undefined,
    student.data?.id,
    adaptiveTarget.data?.institutionSkillId,
  );
  const adaptiveV3Plan = useStudentAdaptiveV3Plan(
    currentInstitutionId ?? undefined,
    student.data?.id,
    adaptiveTarget.data?.canonicalSkillId,
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
  const canonicalSummary = useMemo(() => {
    const values = canonicalProgress.data ?? [];
    return {
      strengthened: values.filter((item) => item.state === 'MASTERED').length,
      developing: values.filter((item) => ['INTRODUCED', 'LEARNING', 'PRACTICING'].includes(item.state)).length,
      review: values.filter((item) => item.state === 'NEEDS_REVIEW').length,
      evidence: values.reduce((total, item) => total + item.evidence_count, 0),
      hasEvidence: values.some((item) => item.evidence_count > 0),
    };
  }, [canonicalProgress.data]);

  const enemSimulations = useMemo(
    () => (simulations.data ?? []).filter((simulation) => simulation.source_year || simulation.title.toLocaleLowerCase('pt-BR').includes('enem')),
    [simulations.data],
  );
  const areaSimulations = useMemo(
    () => enemSimulations.filter((simulation) => simulation.simulation_type === 'AREA'),
    [enemSimulations],
  );
  const historicalSimulations = useMemo(
    () => enemSimulations.filter((simulation) => simulation.simulation_type === 'HISTORICAL_EXAM'),
    [enemSimulations],
  );
  const recentSimulationAttempts = useMemo(
    () => (simulationAttempts.data ?? []).filter((attempt) => attempt.status === 'COMPLETED').slice(0, 3),
    [simulationAttempts.data],
  );

  const todayActions = useMemo(() => {
    const actions: Array<{ id: string; title: string; detail: string; href: string; action: string }> = [];
    if (guidedSessionV2.data?.status === 'ACTIVE') {
      actions.push({
        id: `guided:${guidedSessionV2.data.id}`,
        title: guidedSessionV2.data.current_step?.position === undefined
          ? 'Continuar seu estudo guiado'
          : `Continuar etapa ${(guidedSessionV2.data.current_step.position ?? 0) + 1}`,
        detail: 'Siga a próxima atividade indicada para você.',
        href: '/student/study/guided',
        action: 'Continuar',
      });
    } else {
      for (const item of dailyPlan.data?.learning_daily_plan_items ?? []) {
        const href = item.activity_id
          ? `/student/study/activity/${item.activity_id}${item.step_id ? `?guidedStep=${item.step_id}` : ''}`
          : item.lesson_id
            ? `/student/study/lesson/${item.lesson_id}/${item.step_id ?? ''}`
            : '/student/study#study-subjects';
        actions.push({
          id: `plan:${item.id}`,
          title: item.title,
          detail: `${item.estimated_minutes} min · ${item.status === 'COMPLETED' ? 'Concluído' : 'Próxima atividade'}`,
          href,
          action: item.status === 'COMPLETED' ? 'Revisar' : 'Começar',
        });
      }
    }
    for (const review of reviewsDue.data ?? []) {
      actions.push({
        id: `review:${review.id}`,
        title: humanizeSkill(review.canonical_skill_id, review.skill_title),
        detail: 'Revisão recomendada para fortalecer este conceito.',
        href: '/student/study/guided',
        action: 'Revisar',
      });
    }
    for (const error of errorNotebook.data ?? []) {
      actions.push({
        id: `error:${error.id}`,
        title: humanizeSkill(error.canonical_skill_id),
        detail: `Você teve dificuldade neste conceito em ${error.error_count} tentativa(s).`,
        href: `/student/study/error/${error.id}`,
        action: 'Praticar',
      });
    }
    if (!actions.length && adaptiveTarget.data) {
      actions.push({
        id: `target:${adaptiveTarget.data.institutionSkillId}`,
        title: `Começar em ${humanizeSubjectArea(adaptiveTarget.data.target.subjectArea)}`,
        detail: 'Uma atividade curta para conhecer seu próximo tópico.',
        href: '/student/study/guided',
        action: 'Começar',
      });
    }
    if (!actions.length && selectedActivities[0]) {
      const activity = selectedActivities[0];
      actions.push({
        id: `activity:${activity.id}`,
        title: activity.title,
        detail: `${subjectName(activity) ?? 'Atividade'} · ${activity.learning_questions?.length ?? 0} questões`,
        href: `/student/study/activity/${activity.id}`,
        action: 'Começar',
      });
    }
    return actions.slice(0, 4);
  }, [adaptiveTarget.data, dailyPlan.data, errorNotebook.data, guidedSessionV2.data, reviewsDue.data, selectedActivities]);

  const displayPackages = useMemo(() => {
    const seen = new Set<string>();
    return (packages.data ?? []).flatMap((assignment) => {
      const item = Array.isArray(assignment.learning_packages) ? assignment.learning_packages[0] : assignment.learning_packages;
      if (!item) return [];
      const key = packagePresentationKey(item.title, item.subject_area);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ assignment, item }];
    }).slice(0, 4);
  }, [packages.data]);

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
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm dark:border-blue-900/60 dark:from-blue-950/40 dark:to-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Seu próximo passo</p>
              <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">Continue de onde parou</h1>
              <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
                Olá, {profile?.full_name?.split(' ')[0] ?? 'aluno'}. O que vamos estudar hoje?
              </p>
            </div>
            {guidedSessionV2.data?.status === 'ACTIVE' ? (
              <Link to="/student/study/guided" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">
                Continuar estudo
              </Link>
            ) : (
              <a href="#study-subjects" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-bold text-[#005bbf]">
                Explorar matérias
              </a>
            )}
          </div>
        </div>

      </header>

      {guidedSession.data?.status === 'NEEDS_TEACHER_SUPPORT' && (
        <section aria-label="Apoio do professor" className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20 sm:p-5">
          <h2 className="font-bold text-red-950 dark:text-red-100">Seu estudo guiado precisa de apoio</h2>
          <p className="mt-1 text-sm text-red-900 dark:text-red-200">O lock-in foi tentado três vezes sem confirmação. O professor pode revisar seu caminho e indicar um reforço.</p>
          <Link to="/student/study#study-practice" className="mt-3 inline-flex rounded-lg border border-red-700 px-3 py-2 text-xs font-bold text-red-800 dark:text-red-100">Voltar às práticas</Link>
        </section>
      )}

      <section
        aria-label="Para hoje"
        className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">
              {guidedSessionV2.data?.status === 'ACTIVE' ? 'Para hoje · estudo guiado' : 'Para hoje'}
            </p>
            <h2 className="mt-1 text-lg font-bold text-blue-950 dark:text-blue-100">
              {todayActions.length ? 'Sua próxima ação' : 'Nada pendente por enquanto'}
            </h2>
            <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
              {todayActions.length ? 'Reunimos em um só lugar o que merece sua atenção agora.' : 'Quando houver uma nova atividade ou revisão, ela aparecerá aqui.'}
            </p>
          </div>
          {gamification.data && (
            <div className="flex gap-2 text-xs font-bold text-blue-900 dark:text-blue-100">
              <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 dark:border-blue-800 dark:bg-blue-950/60">{gamification.data.xp} XP</span>
              <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 dark:border-blue-800 dark:bg-blue-950/60">{gamification.data.current_streak} dias</span>
            </div>
          )}
        </div>
        {dailyPlan.isLoading ? <p className="mt-4 text-sm text-blue-800 dark:text-blue-300">Organizando suas próximas ações...</p> : todayActions.length ? <ol className="mt-4 grid gap-2 sm:grid-cols-2">{todayActions.map((item, index) => <li key={item.id} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-blue-950/50"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-[#005bbf] dark:bg-blue-900/60 dark:text-blue-100">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.title}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{item.detail}</p></div><Link to={item.href} className="shrink-0 text-xs font-bold text-[#005bbf]">{item.action}</Link></li>)}</ol> : <a href="#study-subjects" className="mt-4 inline-flex text-sm font-bold text-[#005bbf]">Explorar matérias</a>}
      </section>

      <section id="study-progress" aria-label="Seu progresso" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Seu progresso</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Seu desempenho organiza o que você já fortaleceu e o que pode praticar agora.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{canonicalSummary.evidence ? `${canonicalSummary.evidence} atividade(s) analisada(s)` : 'Acompanhamento começando'}</span>
        </div>
        {canonicalProgress.isLoading ? <p className="mt-4 text-sm text-slate-500">Conhecendo seu perfil...</p> : canonicalSummary.hasEvidence ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20"><p className="text-xl font-bold text-emerald-800 dark:text-emerald-200">{canonicalSummary.strengthened}</p><p className="text-xs text-emerald-900 dark:text-emerald-300">Fortalecidas</p></div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20"><p className="text-xl font-bold text-blue-800 dark:text-blue-200">{canonicalSummary.developing}</p><p className="text-xs text-blue-900 dark:text-blue-300">Em desenvolvimento</p></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-xl font-bold text-amber-800 dark:text-amber-200">{canonicalSummary.review}</p><p className="text-xs text-amber-900 dark:text-amber-300">Para revisar</p></div>
          </div>
        ) : <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Continuamos conhecendo seu perfil de aprendizagem.</p>}
      </section>

      {adaptiveTarget.data ? (
        <section aria-label="Objetivo atual" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Seu caminho agora</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Objetivo</p><p className="mt-1 font-bold text-indigo-950 dark:text-indigo-100">{humanizeSubjectArea(adaptiveTarget.data.target.subjectArea)}</p></div>
            <div><p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Agora</p><p className="mt-1 font-semibold text-indigo-950 dark:text-indigo-100">Diagnóstico da próxima habilidade</p></div>
            <div><p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Depois</p><p className="mt-1 font-semibold text-indigo-950 dark:text-indigo-100">Prática orientada pelas suas respostas</p></div>
          </div>
        </section>
      ) : null}

      {!showSecondaryStudyAreas ? (
        <section aria-label="Mais áreas de estudo" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold dark:text-white">Mais áreas de estudo</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Abra simulados e materiais quando quiser explorar além do conteúdo recomendado.</p>
            </div>
            <button type="button" onClick={() => setShowSecondaryStudyAreas(true)} className="inline-flex min-h-10 items-center rounded-lg border border-[#005bbf] px-3 py-2 text-xs font-bold text-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">Explorar</button>
          </div>
        </section>
      ) : null}

      <section aria-label="Conteúdo recomendado" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Conteúdo recomendado</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Percursos disponíveis automaticamente para sua etapa.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{displayPackages.length}</span>
        </div>
        {displayPackages.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {displayPackages.map(({ assignment, item }) => <article key={assignment.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><p className="font-semibold dark:text-white">{humanizePackageTitle(item.title, item.subject_area)}</p><p className="mt-1 text-xs text-slate-500">{humanizeSubjectArea(item.subject_area)} · {item.learning_package_steps?.length ?? 0} etapas</p><p className="mt-2 text-xs font-semibold text-[#005bbf]">{assignment.due_at ? `Entrega até ${new Date(assignment.due_at).toLocaleDateString('pt-BR')}` : 'Disponível para começar'}</p><ol className="mt-3 space-y-2">{item.learning_package_steps?.slice(0, 4).map((step) => <li key={step.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{step.position + 1}. {step.title}</span>{step.lesson_id ? <Link to={`/student/study/lesson/${step.lesson_id}`} className="shrink-0 font-bold text-[#005bbf]">Abrir</Link> : step.activity_id ? <Link to={`/student/study/activity/${step.activity_id}`} className="shrink-0 font-bold text-[#005bbf]">Praticar</Link> : null}</li>)}</ol></article>)}
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Nenhum conteúdo recomendado disponível ainda.</p>}
      </section>

      {showSecondaryStudyAreas ? (
        <>
      <section aria-label="Preparação ENEM" className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Preparação ENEM</p><h2 className="mt-1 font-bold text-blue-950 dark:text-blue-100">Estude com propósito</h2><p className="mt-1 text-xs text-blue-900 dark:text-blue-200">Simulados oficiais importados permanecem separados da nota escolar.</p></div>
          {simulations.data?.length ? <Link to="/student/study/simulation" className="text-xs font-bold text-[#005bbf]">Abrir simulados</Link> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to={simulations.data?.[0] ? `/student/study/simulation?simulation=${simulations.data[0].id}` : '/student/study/simulation'} className="rounded-lg border border-blue-200 bg-white p-3 text-sm font-bold text-blue-950 transition hover:border-[#005bbf] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">Continuar simulado<span className="mt-1 block text-xs font-normal text-blue-800 dark:text-blue-200">Retome uma tentativa em aberto.</span></Link>
          <Link to={simulations.data?.find((item) => item.simulation_type === 'MINI') ? `/student/study/simulation?simulation=${simulations.data.find((item) => item.simulation_type === 'MINI')!.id}` : '/student/study/simulation'} className="rounded-lg border border-blue-200 bg-white p-3 text-sm font-bold text-blue-950 transition hover:border-[#005bbf] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">Simulado rápido<span className="mt-1 block text-xs font-normal text-blue-800 dark:text-blue-200">Uma prática curta para começar.</span></Link>
          <Link to={areaSimulations.length ? `/student/study/simulation?simulation=${areaSimulations[0].id}` : '/student/study/simulation'} className="rounded-lg border border-blue-200 bg-white p-3 text-sm font-bold text-blue-950 transition hover:border-[#005bbf] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">Por área<span className="mt-1 block text-xs font-normal text-blue-800 dark:text-blue-200">{areaSimulations.length ? `${areaSimulations.length} prática(s) disponível(is)` : 'Práticas por área em preparação.'}</span></Link>
          <a href="#historical-exams" className="rounded-lg border border-blue-200 bg-white p-3 text-sm font-bold text-blue-950 transition hover:border-[#005bbf] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">Provas anteriores<span className="mt-1 block text-xs font-normal text-blue-800 dark:text-blue-200">Acesse apenas provas completas.</span></a>
        </div>
      </section>

      <section aria-label="Simulados" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-bold dark:text-white">Simulados</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pratique sem transformar acertos em nota oficial.</p></div>
          {simulations.data?.length ? <Link to="/student/study/simulation" className="text-xs font-bold text-[#005bbf]">Abrir simulado</Link> : null}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{simulations.data?.length ? `${simulations.data[0].title} · ${simulations.data[0].learning_simulation_questions?.length ?? 0} questões` : 'Nenhum simulado disponível ainda.'}</p>
      </section>

      <section aria-label="Simulados atribuídos" className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-blue-950 dark:text-blue-100">Simulados atribuídos</h2><p className="mt-1 text-xs text-blue-900 dark:text-blue-200">O que seu professor liberou para sua turma.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-100">{simulationAssignments.data?.length ?? 0}</span></div>
        {simulationAssignments.isLoading ? <p className="mt-4 text-sm text-blue-900 dark:text-blue-200">Carregando atribuições...</p> : simulationAssignments.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{simulationAssignments.data.slice(0, 6).map((assignment) => <Link key={assignment.assignment_id} to={`/student/study/simulation?simulation=${assignment.simulation_id}`} className="rounded-lg border border-blue-200 bg-white p-4 transition hover:border-[#005bbf] dark:border-blue-900/60 dark:bg-blue-950/40"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-blue-950 dark:text-blue-100">{assignment.title}</p><span className="shrink-0 text-xs font-bold text-[#005bbf]">{assignment.assignment_status === 'COMPLETED' ? 'Concluído' : assignment.assignment_status === 'IN_PROGRESS' ? 'Em andamento' : 'Novo'}</span></div><p className="mt-1 text-xs text-blue-900 dark:text-blue-200">Professor: {assignment.assigned_by_name ?? 'Professor'}</p>{assignment.due_at ? <p className="mt-2 text-xs font-semibold text-blue-800 dark:text-blue-200">Entrega até {new Date(assignment.due_at).toLocaleDateString('pt-BR')}</p> : null}</Link>)}</div> : <p className="mt-4 text-sm text-blue-900 dark:text-blue-200">Nenhum simulado atribuído no momento.</p>}
      </section>

      <section id="historical-exams" aria-label="Provas anteriores" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Provas anteriores</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ano, aplicação e dia aparecem somente quando o corpus oficial está completo.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{historicalSimulations.length}</span></div>
        {historicalSimulations.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{historicalSimulations.map((simulation) => <Link key={simulation.id} to={`/student/study/simulation?simulation=${simulation.id}`} className="rounded-lg border p-3 transition hover:border-[#005bbf] dark:border-slate-700"><p className="font-semibold dark:text-white">{simulation.title}</p><p className="mt-1 text-xs text-slate-500">{simulation.source_year ?? 'Ano não informado'} · {simulation.question_count || simulation.learning_simulation_questions?.length || 0} questões</p></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma prova histórica completa está publicada ainda. O catálogo oficial está sendo processado sem promover conjuntos parciais como prova completa.</p>}
      </section>

      <section aria-label="Histórico de simulados" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Últimos resultados</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seu histórico de prática, sem ranking público.</p></div><span className="text-xs font-semibold text-slate-500">{recentSimulationAttempts.length}</span></div>
        {recentSimulationAttempts.length ? <ul className="mt-4 divide-y dark:divide-slate-700">{recentSimulationAttempts.map((attempt) => { const simulation = Array.isArray(attempt.learning_simulations) ? attempt.learning_simulations[0] : attempt.learning_simulations; return <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="min-w-0 truncate dark:text-slate-200">{simulation?.title ?? 'Simulado'}<small className="mt-0.5 block text-xs text-slate-500">{new Date(attempt.completed_at ?? attempt.started_at).toLocaleDateString('pt-BR')} · {attempt.duration_seconds ? `${Math.round(attempt.duration_seconds / 60)} min` : 'duração não informada'}</small></span><strong className="text-[#005bbf]">{attempt.correct_count}/{attempt.total_questions} · {attempt.score}%</strong></li>; })}</ul> : <p className="mt-4 text-sm text-slate-500">Conclua um simulado para ver seu histórico aqui.</p>}
      </section>

        </>
      ) : null}

      {(adaptiveV3Plan.data || adaptiveV3Plan.isLoading) ? (
        <StudentAdaptiveBridgeCard
          plan={adaptiveV3Plan.data}
          isLoading={adaptiveV3Plan.isLoading}
        />
      ) : null}

      {adaptiveGuidance.data && (
        <section
          aria-label="Seu próximo passo"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-bold text-blue-950 dark:text-blue-100">Seu próximo passo</h2>
              <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">{adaptiveGuidance.data.message}</p>
              {adaptiveGuidance.data.steps.length > 0 && (
                <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-100">
                  {adaptiveGuidance.data.steps.map((step, index) => (
                    <li key={step.id} className="inline-flex items-center gap-2">
                      <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 dark:border-blue-800 dark:bg-blue-950/60">
                        {step.title}
                      </span>
                      {index < adaptiveGuidance.data.steps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      )}

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
              const subjectActivityCount = (activities.data ?? []).filter((activity) => activity.subject_id === subject.id).length;
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => selectSubject(subject.id)}
                  aria-pressed={selectedSubjectId === subject.id}
                  className={`flex min-h-16 min-w-[220px] snap-start items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] sm:min-w-0 ${selectedSubjectId === subject.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  <Icon className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold dark:text-white">{subject.name}</span><span className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400">{subjectActivityCount ? `${subjectActivityCount} atividade(s) para começar` : 'Explore os tópicos disponíveis'}</span></span>
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

    </div>
  );
}
