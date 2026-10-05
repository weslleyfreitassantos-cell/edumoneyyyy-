import { AlertTriangle, BarChart3, BookOpen, ChevronDown, Eye, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { DataTable, type Column } from '../../components/DataTable';
import { ListPagination, ListSearch, normalizeListSearch } from '../../components/ListControls';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherClassKnowledgeHeatmap } from '../../hooks/useAdaptiveLearning';
import { useTeacherLearningScopedClasses, useTeacherLearningStudents, useTeacherLearningSubjects } from '../../hooks/useLearningCenter';
import { humanizeSkill, humanizeSubjectArea } from '../../lib/learningPresentation';
import type { LearningTeacherStudent } from '../../services/learningCenterService';
import { PageState } from './PedagogicalCenterNav';

const PAGE_SIZE = 6;

type TeacherPerformanceRow = LearningTeacherStudent & {
  id: string;
  mastery: number;
  status: string;
};

function normalizeStudentSearch(value: string): string {
  return normalizeListSearch(value).replace(/\s+/g, ' ');
}

function studentStatus(student: LearningTeacherStudent, mastery: number): string {
  if (student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT') {
    return 'Precisa de atenção';
  }
  return mastery >= 70 ? 'Bom andamento' : 'Em desenvolvimento';
}

export default function PedagogicalCenterOverviewPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const subjects = useTeacherLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const subjectId = params.get('subject') ?? '';
  const selectedSubject = subjects.data?.find((item) => item.id === subjectId);
  const activeSubjectId = selectedSubject?.id ?? (subjectId ? '' : subjects.data?.[0]?.id ?? '');
  const classes = useTeacherLearningScopedClasses(currentInstitutionId ?? undefined, profile?.id, activeSubjectId || undefined);
  const classId = params.get('class') ?? '';
  const selectedClass = classes.data?.find((item) => item.id === classId);
  const activeClassId = selectedClass?.id ?? (classId ? '' : classes.data?.[0]?.id ?? '');
  const activeSubject = subjects.data?.find((item) => item.id === activeSubjectId);
  const activeClass = classes.data?.find((item) => item.id === activeClassId);
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined, activeClassId || undefined, activeSubjectId || undefined);
  const heatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, activeClassId || undefined, activeSubjectId || undefined);
  const scopedStudents = students.data ?? [];
  const performanceRows = useMemo<TeacherPerformanceRow[]>(
    () => scopedStudents.map((student) => {
      const mastery = Math.max(0, Math.min(100, Math.round(student.average_mastery)));
      return { ...student, id: `${student.student_id}-${student.class_id}`, mastery, status: studentStatus(student, mastery) };
    }),
    [scopedStudents],
  );
  const normalizedSearch = normalizeStudentSearch(searchTerm);
  const filteredRows = useMemo(
    () => performanceRows.filter((student) => normalizeStudentSearch(student.full_name).includes(normalizedSearch)),
    [normalizedSearch, performanceRows],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const attention = scopedStudents.filter(
    (student) => student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT',
  );
  const averageMastery = scopedStudents.length
    ? Math.round(scopedStudents.reduce((total, student) => total + student.average_mastery, 0) / scopedStudents.length)
    : 0;
  const difficultTopics = (heatmap.data ?? []).filter((row) => row.needsReviewCount > 0).slice(0, 6);
  const columns: Column<TeacherPerformanceRow>[] = [
    { key: 'full_name', label: 'Nome' },
    { key: 'class_name', label: 'Turma' },
    { key: 'mastery', label: 'Progresso', render: (value) => `${value}%` },
    { key: 'status', label: 'Situação' },
  ];

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const setSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const setClass = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('class', value);
    else next.delete('class');
    setParams(next);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const setSubject = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('subject', value);
    else next.delete('subject');
    next.delete('class');
    setParams(next);
    setSearchTerm('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Contexto pedagógico</p>
            <p className="mt-1 text-sm text-slate-500">Escolha a disciplina e a turma para ver somente os alunos e sinais do seu vínculo.</p>
          </div>
          <div className="grid gap-3 sm:w-[34rem] sm:grid-cols-2">
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
        {subjects.isLoading ? <PageState>Carregando suas disciplinas...</PageState> : subjects.isError ? <PageState error>Não foi possível carregar suas disciplinas.</PageState> : !activeSubjectId ? <PageState>Nenhuma disciplina ou turma vinculada ao seu perfil.</PageState> : <p className="mt-4 text-sm font-semibold text-[#005bbf]">Em foco: {activeSubject?.name ?? 'Disciplina vinculada'}{activeClassId ? ` · ${activeClass?.name ?? 'Turma vinculada'}` : ''}</p>}
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

      <section aria-label="Alunos" className="space-y-4">
        <ListSearch id="teacher-performance-search" label="Buscar aluno" placeholder="Nome do aluno" value={searchTerm} onChange={setSearch} />
        {students.isError ? <PageState error>Não foi possível carregar os alunos.</PageState> : !activeClassId ? <PageState>Nenhum aluno encontrado para esta turma.</PageState> : <DataTable
          title="Alunos"
          data={pageRows}
          columns={columns}
          isLoading={students.isLoading || students.isFetching}
          emptyMessage={searchTerm.trim() ? 'Nenhum aluno encontrado.' : 'Nenhum aluno encontrado para esta turma.'}
          renderActions={(student) => <Link to={`/teacher/pedagogical-center/students/${student.student_id}?class=${activeClassId}&subject=${activeSubjectId}`} aria-label={`Ver desempenho de ${student.full_name}`} title={`Ver desempenho de ${student.full_name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Eye className="h-4 w-4" aria-hidden="true" /></Link>}
        />}
        {activeClassId && !students.isError ? <ListPagination page={currentPage} pageSize={PAGE_SIZE} totalItems={filteredRows.length} onPageChange={setCurrentPage} /> : null}
      </section>
    </div>
  );
}
