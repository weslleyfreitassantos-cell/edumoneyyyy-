import { AlertTriangle, ArrowRight, BarChart3, BookOpen, ChevronDown, UsersRound } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherClassKnowledgeHeatmap } from '../../hooks/useAdaptiveLearning';
import { useTeacherLearningScopedClasses, useTeacherLearningStudents, useTeacherLearningSubjects } from '../../hooks/useLearningCenter';
import { humanizeSkill, humanizeSubjectArea } from '../../lib/learningPresentation';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterOverviewPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const subjects = useTeacherLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const subjectId = params.get('subject') ?? '';
  const selectedSubject = subjects.data?.find((item) => item.id === subjectId);
  const activeSubjectId = selectedSubject?.id ?? (subjectId ? '' : subjects.data?.[0]?.id ?? '');
  const classes = useTeacherLearningScopedClasses(currentInstitutionId ?? undefined, profile?.id, activeSubjectId || undefined);
  const classId = params.get('class') ?? '';
  const selectedClassFromParams = classes.data?.find((item) => item.id === classId);
  const activeClassId = selectedClassFromParams?.id ?? (classId ? '' : classes.data?.[0]?.id ?? '');
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined, activeClassId || undefined, activeSubjectId || undefined);
  const heatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, activeClassId || undefined, activeSubjectId || undefined);
  const scopedStudents = useMemo(
    () => students.data ?? [],
    [students.data],
  );
  const attention = scopedStudents.filter(
    (student) => student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT',
  );
  const averageMastery = scopedStudents.length
    ? Math.round(scopedStudents.reduce((total, student) => total + student.average_mastery, 0) / scopedStudents.length)
    : 0;
  const difficultTopics = (heatmap.data ?? []).filter((row) => row.needsReviewCount > 0).slice(0, 6);

  const setClass = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('class', value);
    else next.delete('class');
    setParams(next);
  };

  const setSubject = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('subject', value);
    else next.delete('subject');
    next.delete('class');
    setParams(next);
  };

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
        <PedagogicalCenterHeader subtitle="Uma leitura rápida da turma para decidir onde olhar primeiro." />
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Contexto pedagógico</p>
            <p className="mt-1 text-sm text-slate-500">Escolha a disciplina e a turma para ver somente os alunos e sinais do seu vínculo.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:w-[34rem]">
            <label className="relative block">
              <span className="sr-only">Disciplina em foco</span>
              <select aria-label="Disciplina em foco" value={activeSubjectId} onChange={(event) => setSubject(event.target.value)} className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Nenhuma disciplina vinculada</option>
                {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </label>
            <label className="relative block">
              <span className="sr-only">Turma selecionada</span>
              <select aria-label="Turma selecionada" value={activeClassId} onChange={(event) => setClass(event.target.value)} disabled={!activeSubjectId} className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Nenhuma turma vinculada</option>
                {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </label>
          </div>
        </div>
        {subjects.isLoading ? <PageState>Carregando suas disciplinas...</PageState> : subjects.isError ? <PageState error>Não foi possível carregar suas disciplinas.</PageState> : !activeSubjectId ? <PageState>Nenhuma disciplina ou turma vinculada ao seu perfil.</PageState> : <p className="mt-4 text-sm font-semibold text-[#005bbf]">Em foco: {selectedSubject?.name ?? 'Disciplina vinculada'}{activeClassId ? ` · ${classes.data?.find((item) => item.id === activeClassId)?.name ?? 'Turma vinculada'}` : ''}</p>}
      </section>

      <section aria-label="Resumo do desempenho" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><UsersRound className="h-5 w-5 text-[#005bbf]" aria-hidden="true" /><p className="mt-3 text-2xl font-bold dark:text-white">{scopedStudents.length}</p><p className="text-sm text-slate-500">alunos acompanhados</p></article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"><AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /><p className="mt-3 text-2xl font-bold text-amber-950 dark:text-amber-100">{attention.length}</p><p className="text-sm text-amber-800 dark:text-amber-200">precisam de atenção</p></article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"><BarChart3 className="h-5 w-5 text-emerald-600" aria-hidden="true" /><p className="mt-3 text-2xl font-bold text-emerald-950 dark:text-emerald-100">{averageMastery}%</p><p className="text-sm text-emerald-800 dark:text-emerald-200">progresso médio</p></article>
      </section>

      <section aria-label="Dificuldades da turma" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><BookOpen className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-bold dark:text-white">Dificuldades da turma</h2><p className="mt-1 text-sm text-slate-500">Tópicos que merecem mais prática, sem ranking entre alunos.</p></div></div>
        {!activeClassId ? <PageState>Escolha uma turma para ver seus tópicos mais difíceis.</PageState> : heatmap.isLoading ? <PageState>Carregando desempenho da turma...</PageState> : heatmap.isError ? <PageState error>Não foi possível carregar o desempenho desta turma.</PageState> : difficultTopics.length ? <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">{difficultTopics.map((row, index) => { const share = scopedStudents.length ? Math.round((row.needsReviewCount / scopedStudents.length) * 100) : 0; return <article key={`${row.subjectCode}-${row.skillCode}`} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">{humanizeSubjectArea(row.subjectCode)}</p><h3 className="mt-1 font-semibold dark:text-white">{humanizeSkill(row.skillCode)}</h3><div className="mt-2 flex items-center gap-2"><div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, share)}%` }} /></div><span className="shrink-0 text-xs text-slate-500">{row.needsReviewCount} para revisar</span></div></div></article>; })}</div> : <PageState>Esta turma ainda não tem tópicos que precisem de atenção.</PageState>}
      </section>

      <section aria-label="Alunos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Alunos</h2><p className="mt-1 text-sm text-slate-500">Abra um aluno para acompanhar o próximo passo.</p></div><Link to={`/teacher/pedagogical-center/students?class=${activeClassId}&subject=${activeSubjectId}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#005bbf]">Ver todos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div>
        {students.isLoading ? <PageState>Carregando alunos...</PageState> : students.isError ? <PageState error>Não foi possível carregar os alunos.</PageState> : !activeClassId ? <PageState>Escolha uma turma para ver seus alunos.</PageState> : scopedStudents.length ? <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">{scopedStudents.slice(0, 8).map((student) => { const mastery = Math.max(0, Math.min(100, Math.round(student.average_mastery))); const needsAttention = student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT'; return <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}?class=${activeClassId}&subject=${activeSubjectId}`} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:hover:bg-slate-800/50 sm:flex-row sm:items-center sm:gap-5"><span className="min-w-0 flex-1"><span className="block font-semibold dark:text-white">{student.full_name}</span><span className="mt-1 block text-xs text-slate-500">{student.class_name}</span></span><span className="flex min-w-44 items-center gap-3"><span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-[#005bbf]" style={{ width: `${mastery}%` }} /></span><span className="w-10 text-right text-xs font-bold text-slate-700 dark:text-slate-200">{mastery}%</span></span><span className={`shrink-0 text-xs font-bold ${needsAttention ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{needsAttention ? `${student.open_error_count || 1} para revisar` : 'Bom andamento'}</span><ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" /></Link>; })}</div> : <PageState>Não há alunos ativos nesta turma.</PageState>}
      </section>
    </div>
  );
}
