import { AlertTriangle, ArrowRight, BarChart3, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherClassKnowledgeHeatmap } from '../../hooks/useAdaptiveLearning';
import { useTeacherLearningClasses, useTeacherLearningStudents } from '../../hooks/useLearningCenter';
import { humanizeSkill, humanizeSubjectArea } from '../../lib/learningPresentation';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterOverviewPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const classes = useTeacherLearningClasses(currentInstitutionId ?? undefined, profile?.id);
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const classId = params.get('class') ?? '';
  const [selectedClass, setSelectedClass] = useState(classId);
  const heatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, selectedClass || undefined);
  const scopedStudents = useMemo(
    () => (students.data ?? []).filter((student) => !selectedClass || student.class_id === selectedClass),
    [selectedClass, students.data],
  );
  const attention = scopedStudents.filter(
    (student) => student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT',
  );
  const averageMastery = scopedStudents.length
    ? Math.round(scopedStudents.reduce((total, student) => total + student.average_mastery, 0) / scopedStudents.length)
    : 0;
  const difficultTopics = (heatmap.data ?? []).filter((row) => row.needsReviewCount > 0).slice(0, 6);

  const setClass = (value: string) => {
    setSelectedClass(value);
    const next = new URLSearchParams(params);
    if (value) next.set('class', value);
    else next.delete('class');
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <PedagogicalCenterHeader subtitle="Entenda como a turma está e abra um aluno para acompanhar seu progresso." />

      <section aria-label="Escolha a turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="block max-w-md text-sm font-bold dark:text-white">
          Turma
          <select aria-label="Turma selecionada" value={selectedClass} onChange={(event) => setClass(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
            <option value="">Todas as turmas</option>
            {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </section>

      <section aria-label="Resumo do desempenho" className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><UsersRound className="h-5 w-5 text-[#005bbf]" /><p className="mt-3 text-2xl font-bold dark:text-white">{scopedStudents.length}</p><p className="text-sm text-slate-500">alunos acompanhados</p></article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{attention.length}</p><p className="text-sm text-slate-500">precisam de atenção</p></article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><BarChart3 className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{averageMastery}%</p><p className="text-sm text-slate-500">progresso médio</p></article>
      </section>

      <section aria-label="Dificuldades da turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-bold dark:text-white">Dificuldades da turma</h2><p className="mt-1 text-sm text-slate-500">Tópicos que merecem mais prática, sem ranking entre alunos.</p></div>
        </div>
        {!selectedClass ? <PageState>Escolha uma turma para ver seus tópicos mais difíceis.</PageState> : heatmap.isLoading ? <PageState>Carregando desempenho da turma...</PageState> : heatmap.isError ? <PageState error>Não foi possível carregar o desempenho desta turma.</PageState> : difficultTopics.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{difficultTopics.map((row) => <article key={`${row.subjectCode}-${row.skillCode}`} className="rounded-lg border p-4 dark:border-slate-700"><p className="text-xs font-bold uppercase text-[#005bbf]">{humanizeSubjectArea(row.subjectCode)}</p><h3 className="mt-1 font-semibold dark:text-white">{humanizeSkill(row.skillCode)}</h3><p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{row.needsReviewCount} aluno(s) precisam revisar</p></article>)}</div> : <PageState>Esta turma ainda não tem tópicos que precisem de atenção.</PageState>}
      </section>

      <section aria-label="Alunos" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Alunos</h2><p className="mt-1 text-sm text-slate-500">Abra um aluno para ver seu desempenho e evolução.</p></div><Link to={`/teacher/pedagogical-center/students${selectedClass ? `?class=${selectedClass}` : ''}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Ver todos <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        {students.isLoading ? <PageState>Carregando alunos...</PageState> : students.isError ? <PageState error>Não foi possível carregar os alunos.</PageState> : scopedStudents.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{scopedStudents.slice(0, 8).map((student) => <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold dark:text-white">{student.full_name}</p><p className="mt-1 text-xs text-slate-500">{student.class_name}</p></div><span className="text-xs font-bold text-[#005bbf]">Ver desempenho</span></div><p className={`mt-3 text-sm font-semibold ${student.open_error_count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{student.open_error_count > 0 ? `${student.open_error_count} ponto(s) para revisar` : 'Bom andamento'}</p></Link>)}</div> : <PageState>Não há alunos ativos nesta turma.</PageState>}
      </section>
    </div>
  );
}
