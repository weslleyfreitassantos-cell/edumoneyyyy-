import { ArrowLeft, CheckCircle2, CircleAlert, RotateCw } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useTeacherGuidedLearningAttempts,
  useTeacherLearningStudentDetail,
  useTeacherLearningStudents,
  useTeacherLearningSubjects,
} from '../../hooks/useLearningCenter';
import { useTeacherStudentKnowledgeGraph } from '../../hooks/useAdaptiveLearning';

function masteryPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value <= 1 ? value * 100 : value)));
}

function progressLabel(state: string) {
  switch (state) {
    case 'MASTERED':
      return 'Consolidado';
    case 'DEVELOPING':
    case 'PRACTICING':
    case 'IN_PROGRESS':
      return 'Em desenvolvimento';
    case 'NEEDS_REVIEW':
      return 'Precisa revisar';
    case 'INTRODUCED':
      return 'Evidência inicial';
    default:
      return 'Sem evidência suficiente';
  }
}

function guidedSessionStatus(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Em andamento';
    case 'PAUSED':
      return 'Pausada';
    case 'NEEDS_TEACHER_SUPPORT':
      return 'Precisa do professor';
    case 'COMPLETED':
      return 'Concluída';
    case 'CANCELLED':
      return 'Cancelada';
    default:
      return 'Acompanhamento';
  }
}

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params] = useSearchParams();
  const classId = params.get('class') ?? '';
  const subjectId = params.get('subject') ?? '';
  const subjects = useTeacherLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const subjectName = subjects.data?.find((item) => item.id === subjectId)?.name ?? 'Disciplina em foco';
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined, classId || undefined, subjectId || undefined);
  const detail = useTeacherLearningStudentDetail(currentInstitutionId ?? undefined, studentId, classId || undefined, subjectId || undefined);
  const guidedAttempts = useTeacherGuidedLearningAttempts(currentInstitutionId ?? undefined, studentId, classId || undefined, subjectId || undefined);
  const knowledgeGraph = useTeacherStudentKnowledgeGraph(currentInstitutionId ?? undefined, studentId, classId || undefined, subjectId || undefined);
  const skills = knowledgeGraph.data ?? [];
  const evidencedSkills = useMemo(
    () => skills.filter((skill) => skill.evidenceCount > 0 && skill.state !== 'UNKNOWN'),
    [skills],
  );
  const subjectGroups = useMemo(() => {
    const groups = new Map<string, { subjectName: string; skills: typeof evidencedSkills }>();
    for (const skill of evidencedSkills) {
      const current = groups.get(skill.subjectCode) ?? { subjectName: skill.subjectName, skills: [] };
      current.skills.push(skill);
      groups.set(skill.subjectCode, current);
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      average: Math.round(group.skills.reduce((total, skill) => total + masteryPercent(skill.mastery), 0) / group.skills.length),
      reviewSkills: group.skills.filter((skill) => skill.state === 'NEEDS_REVIEW'),
      allMastered: group.skills.every((skill) => skill.state === 'MASTERED'),
    }));
  }, [evidencedSkills]);
  const recentAttempts = useMemo(() => {
    const activityAttempts = (detail.data?.recent_attempts ?? []).map((attempt) => ({
      ...attempt,
      source: 'ACTIVITY' as const,
    }));
    return [...activityAttempts, ...(guidedAttempts.data ?? [])]
      .sort((left, right) => Date.parse(right.completed_at) - Date.parse(left.completed_at))
      .slice(0, 5);
  }, [detail.data?.recent_attempts, guidedAttempts.data]);

  if (!studentId || !classId || !subjectId) return <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Este aluno só pode ser aberto com uma disciplina e turma dentro do seu escopo pedagógico.</section>;
  if (detail.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando desempenho...</div>;
  if (detail.isError || !detail.data) {
    const denied = detail.error?.message.includes('LEARNING_TEACHER_SUBJECT_SCOPE_DENIED') ?? false;
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p>{denied ? 'Este aluno não está no seu escopo pedagógico.' : 'Não foi possível carregar o acompanhamento agora.'}</p>
        {!denied ? <button type="button" onClick={() => void detail.refetch()} className="mt-3 inline-flex items-center gap-2 font-semibold underline"><RotateCw className="h-4 w-4" />Tentar novamente</button> : null}
      </section>
    );
  }

  const data = detail.data;
  const otherStudents = students.data?.filter((item) => item.student_id !== studentId).slice(0, 8) ?? [];
  const overallMastery = subjectGroups.length
    ? Math.round(subjectGroups.reduce((total, group) => total + group.average, 0) / subjectGroups.length)
    : null;
  const activeSessions = data.guided_sessions.filter((session) => session.status !== 'CANCELLED');

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/teacher/pedagogical-center" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Desempenho</Link>
        <span className="text-xs text-slate-500">Acompanhamento restrito às suas turmas</span>
      </div>
      <header className="rounded-2xl border border-blue-900/20 bg-[#073b78] p-5 text-white shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Desempenho do aluno</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.student.full_name}</h1><p className="mt-1 text-sm text-blue-100">{data.student.class_name} · {subjectName}</p></div>
          <div className="flex gap-6 border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div><p className="text-2xl font-bold">{knowledgeGraph.isLoading ? '...' : knowledgeGraph.isError ? 'Indisponível' : overallMastery === null ? 'Sem dados suficientes' : `${overallMastery}%`}</p><p className="text-xs text-blue-200">domínio com evidência registrada</p></div>
            <div><p className="text-2xl font-bold">{data.open_errors.length}</p><p className="text-xs text-blue-200">para revisar</p></div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          <section aria-label="Desempenho por matéria" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div>
              <h2 className="font-bold dark:text-white">Desempenho em {subjectName}</h2>
              <p className="mt-1 text-sm text-slate-500">Visão restrita à disciplina e turma do seu vínculo. O domínio considera apenas habilidades com evidências registradas.</p>
            </div>
            {knowledgeGraph.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando desempenho...</p> : knowledgeGraph.isError ? <div role="alert" className="mt-4 text-sm text-red-700"><p>Não foi possível carregar o desempenho por matéria.</p><button type="button" onClick={() => void knowledgeGraph.refetch()} className="mt-2 inline-flex items-center gap-2 font-semibold underline"><RotateCw className="h-4 w-4" />Tentar novamente</button></div> : subjectGroups.length ? (
              <div className="mt-5 space-y-3">
                {subjectGroups.map((group) => <details key={group.subjectName} className="group rounded-xl border border-slate-200 dark:border-slate-700"><summary className="flex cursor-pointer list-none items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]"><span className="min-w-0 flex-1"><span className="block font-bold dark:text-white">{group.subjectName}</span><span className={`mt-1 block text-xs font-semibold ${group.reviewSkills.length ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{group.reviewSkills.length ? `Vale revisar ${group.reviewSkills[0].skillTitle}` : group.allMastered ? 'Habilidades consolidadas' : 'Progresso registrado'}</span></span><span className="w-28 shrink-0"><span className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>Domínio</span><span>{group.average}%</span></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-[#005bbf]" style={{ width: `${group.average}%` }} /></span></span><span className="text-slate-400 transition group-open:rotate-180">⌄</span></summary><div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800"><ul className="space-y-2">{group.skills.map((skill) => <li key={`${skill.subjectCode}-${skill.skillCode}`} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-slate-600 dark:text-slate-300">{skill.skillTitle}</span><span className="text-right text-xs font-semibold text-slate-500">{progressLabel(skill.state)} · {masteryPercent(skill.mastery)}% · {skill.evidenceCount} evidência(s)</span></li>)}</ul></div></details>)}
              </div>
            ) : skills.length ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Sem dados suficientes para calcular domínio. Há conteúdo curricular neste escopo, mas ainda não há evidências válidas registradas.</p> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Não há habilidades curriculares vinculadas a esta disciplina neste escopo; por isso, o domínio não pode ser calculado.</p>}
          </section>

          <section aria-label="Estudo guiado" className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" /><h2 className="font-bold text-slate-900 dark:text-white">Estudo guiado</h2><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">{activeSessions.length}</span></div>
            {activeSessions.length ? <ul className="mt-4 divide-y divide-blue-100 dark:divide-blue-900/60">{activeSessions.slice(0, 6).map((session) => {
              const completedSteps = session.steps.filter((step) => step.status === 'COMPLETED' || step.status === 'SKIPPED').length;
              const activeStep = session.steps.find((step) => step.status === 'ACTIVE');
              return <li key={session.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-slate-900 dark:text-white">{session.target_skill_title}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{completedSteps} de {session.steps.length} etapas concluídas{activeStep ? ` · etapa atual: ${activeStep.title}` : ''}</p></div><span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-slate-900 dark:text-blue-200">{guidedSessionStatus(session.status)}</span></div></li>;
            })}</ul> : <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Nenhuma sessão guiada registrada para esta disciplina e turma.</p>}
          </section>

          <section aria-label="Vale revisar" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6">
            <div className="flex items-center gap-2"><CircleAlert className="h-5 w-5 text-amber-600" aria-hidden="true" /><h2 className="font-bold text-amber-950 dark:text-amber-100">Vale revisar</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{data.open_errors.length}</span></div>
            {data.open_errors.length ? <ul className="mt-4 space-y-2">{data.open_errors.map((item) => <li key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">{item.error_count} erro(s) · última tentativa {new Date(item.last_missed_at).toLocaleDateString('pt-BR')}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nenhum ponto de revisão registrado neste escopo.</p>}
          </section>

          <section aria-label="Atividades recentes" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <h2 className="font-bold dark:text-white">Atividades recentes</h2>
            {guidedAttempts.isError ? <div role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300"><p>Não foi possível consultar as tentativas do Estudo Guiado. As demais atividades continuam visíveis.</p><button type="button" onClick={() => void guidedAttempts.refetch()} className="mt-2 inline-flex items-center gap-2 font-semibold underline"><RotateCw className="h-4 w-4" />Tentar novamente</button></div> : null}
            {guidedAttempts.isLoading && !recentAttempts.length ? <p className="mt-4 text-sm text-slate-500">Carregando atividades...</p> : recentAttempts.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">{recentAttempts.map((attempt) => <div key={`${attempt.source}-${attempt.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 text-sm"><div className="min-w-0"><p className="font-semibold dark:text-white">{attempt.activity_title}</p><p className="mt-1 text-xs text-slate-500">{attempt.source === 'GUIDED' ? 'Estudo guiado' : 'Atividade'} · {new Date(attempt.completed_at).toLocaleDateString('pt-BR')}</p></div><span className="shrink-0 font-bold text-slate-700 dark:text-slate-200">{attempt.score}/{attempt.total_points}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma tentativa concluída neste escopo ainda.</p>}
          </section>
        </main>

        <aside className="min-w-0">
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="font-bold dark:text-white">Outros alunos</h2></div>{otherStudents.length ? <div className="mt-3 space-y-2">{otherStudents.map((item) => <Link key={item.student_id} to={`/teacher/pedagogical-center/students/${item.student_id}?class=${classId}&subject=${subjectId}`} className="block rounded-lg border p-3 text-sm hover:border-[#005bbf] dark:border-slate-700"><p className="font-semibold dark:text-white">{item.full_name}</p><p className="text-xs text-slate-500">{item.class_name}</p></Link>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhum outro aluno disponível.</p>}</section>
        </aside>
      </div>
    </div>
  );
}
