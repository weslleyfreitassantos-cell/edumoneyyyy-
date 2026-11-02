import { BookOpenCheck, ClipboardList, Clock3, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherLearningActivities, useTeacherLearningAttempts, useTeacherLearningClasses } from '../../hooks/useLearningCenter';
import type { LearningActivity } from '../../services/learningCenterService';
import { PageState } from './PedagogicalCenterNav';

function subjectName(activity: LearningActivity) {
  const subject = Array.isArray(activity.subjects) ? activity.subjects[0] : activity.subjects;
  return subject?.name ?? 'Matéria';
}

function classNames(activity: LearningActivity) {
  return (activity.learning_assignments ?? []).map((assignment) => {
    const classroom = Array.isArray(assignment.classes) ? assignment.classes[0] : assignment.classes;
    return classroom?.name;
  }).filter((name): name is string => Boolean(name));
}

export default function TeacherClassroomPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const classes = useTeacherLearningClasses(currentInstitutionId ?? undefined, profile?.id);
  const activities = useTeacherLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const attempts = useTeacherLearningAttempts(currentInstitutionId ?? undefined, profile?.id);
  const activityRows = activities.data ?? [];
  const latestAttempts = attempts.data ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Aprendizagem e recursos</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Sala de Aula</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Organize atividades por turma, acompanhe tentativas recentes e prepare novas práticas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/teacher/classroom/activities/new" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"><Plus size={17} /> Criar atividade</Link>
          <Link to="/teacher/pedagogical-center/activities" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-[#005bbf] dark:border-slate-700 dark:bg-slate-900 dark:text-white"><ClipboardList size={17} /> Gerenciar atividades</Link>
        </div>
      </header>

      <section aria-label="Resumo da sala de aula" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><UsersRound size={17} className="text-[#005bbf]" /> Turmas vinculadas</div><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{classes.data?.length ?? '—'}</p></article>
        <article className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><BookOpenCheck size={17} className="text-[#005bbf]" /> Atividades criadas</div><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{activityRows.length}</p></article>
        <article className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><Clock3 size={17} className="text-[#005bbf]" /> Tentativas recentes</div><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{latestAttempts.length}</p></article>
      </section>

      <section className="space-y-3" aria-labelledby="classroom-classes-heading">
        <div><h2 id="classroom-classes-heading" className="text-lg font-bold text-slate-900 dark:text-white">Minhas turmas</h2><p className="mt-1 text-sm text-slate-500">As turmas são carregadas a partir dos seus vínculos ativos.</p></div>
        {classes.isLoading ? <PageState>Carregando turmas...</PageState> : classes.isError ? <PageState error>Não foi possível carregar suas turmas.</PageState> : classes.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{classes.data.map((classroom) => {
          const assigned = activityRows.filter((activity) => (activity.learning_assignments ?? []).some((assignment) => assignment.class_id === classroom.id));
          return <article key={classroom.id} className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">{classroom.name}</h3><p className="mt-1 text-sm text-slate-500">{assigned.length} atividade(s) atribuída(s)</p><div className="mt-3 flex flex-wrap gap-2"><Link to="/teacher/classroom/activities/new" className="text-sm font-bold text-[#005bbf] hover:underline">Criar atividade</Link>{assigned.length ? <Link to="/teacher/pedagogical-center/activities" className="text-sm font-bold text-slate-600 hover:underline dark:text-slate-300">Ver atividades</Link> : null}</div></article>;
        })}</div> : <PageState>Não há turmas ativas vinculadas ao seu perfil.</PageState>}
      </section>

      <section className="space-y-3" aria-labelledby="classroom-activity-heading">
        <div><h2 id="classroom-activity-heading" className="text-lg font-bold text-slate-900 dark:text-white">Atividades recentes</h2><p className="mt-1 text-sm text-slate-500">Rascunhos continuam privados para o professor; publicações aparecem somente às turmas atribuídas.</p></div>
        {activities.isLoading ? <PageState>Carregando atividades...</PageState> : activities.isError ? <PageState error>Não foi possível carregar as atividades.</PageState> : activityRows.length ? <div className="space-y-3">{activityRows.slice(0, 12).map((activity) => {
          const assignedClasses = classNames(activity);
          const activityAttempts = latestAttempts.filter((attempt) => attempt.activity_id === activity.id);
          return <article key={activity.id} className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">{subjectName(activity)} · {activity.activity_type}</p><h3 className="mt-1 font-bold text-slate-900 dark:text-white">{activity.title}</h3><p className="mt-1 text-sm text-slate-500">{activity.learning_questions?.length ?? 0} questão(ões) · {assignedClasses.length ? assignedClasses.join(', ') : 'Ainda sem turma'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${activity.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : activity.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{activity.status === 'PUBLISHED' ? 'Publicada' : activity.status === 'ARCHIVED' ? 'Arquivada' : 'Rascunho'}</span></div><p className="mt-3 text-xs text-slate-500">{activityAttempts.length} tentativa(s) entre as 20 mais recentes.</p></article>;
        })}</div> : <PageState>Você ainda não criou atividades. Crie uma atividade para começar a organizar as práticas das turmas.</PageState>}
      </section>
    </main>
  );
}
