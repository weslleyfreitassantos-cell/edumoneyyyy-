import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherLearningScopedClasses, useTeacherLearningStudents, useTeacherLearningSubjects } from '../../hooks/useLearningCenter';
import { humanizeSkill } from '../../lib/learningPresentation';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterStudentsPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const subjects = useTeacherLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const subjectId = params.get('subject') ?? '';
  const selectedSubject = subjects.data?.find((item) => item.id === subjectId);
  const activeSubjectId = selectedSubject?.id ?? (subjectId ? '' : subjects.data?.[0]?.id ?? '');
  const classes = useTeacherLearningScopedClasses(currentInstitutionId ?? undefined, profile?.id, activeSubjectId || undefined);
  const classId = params.get('class') ?? '';
  const selectedClass = classes.data?.find((item) => item.id === classId);
  const activeClassId = selectedClass?.id ?? (classId ? '' : classes.data?.[0]?.id ?? '');
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined, activeClassId || undefined, activeSubjectId || undefined);
  const scopedStudents = useMemo(() => students.data ?? [], [students.data]);

  const setSubject = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('subject', value);
    else next.delete('subject');
    next.delete('class');
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <PedagogicalCenterHeader subtitle="Encontre um aluno e veja seu desempenho." />
      <section aria-label="Contexto dos alunos" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold dark:text-white">
            Disciplina
            <select aria-label="Disciplina dos alunos" value={activeSubjectId} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
              <option value="">Nenhuma disciplina vinculada</option>
              {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold dark:text-white">
            Turma
            <select aria-label="Turma dos alunos" value={activeClassId} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set('class', event.target.value); else next.delete('class'); setParams(next); }} disabled={!activeSubjectId} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 dark:bg-slate-900 dark:text-white">
              <option value="">Nenhuma turma vinculada</option>
              {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">{selectedClass && selectedSubject ? `Mostrando alunos de ${selectedSubject.name} em ${selectedClass.name}.` : 'A lista mostra somente alunos com vínculo ativo na disciplina e turma selecionadas.'}</p>
      </section>
      <section aria-label="Alunos" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Alunos</h2>
            <p className="mt-1 text-sm text-slate-500">Abra um aluno para ver seu desempenho.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{scopedStudents.length}</span>
        </div>
        {subjects.isLoading || classes.isLoading || students.isLoading ? <PageState>Carregando contexto dos alunos...</PageState> : subjects.isError || classes.isError || students.isError ? <PageState error>Não foi possível carregar os alunos do seu escopo.</PageState> : !activeSubjectId || !activeClassId ? <PageState>Nenhuma disciplina ou turma vinculada ao seu perfil.</PageState> : scopedStudents.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scopedStudents.map((student) => (
              <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}?class=${activeClassId}&subject=${activeSubjectId}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700">
                <div className="flex items-start justify-between gap-3"><p className="font-semibold dark:text-white">{student.full_name}</p><span className="text-xs font-bold text-[#005bbf]">{Math.round(student.average_mastery)}%</span></div>
                <p className="mt-1 text-xs text-slate-500">{student.class_name}</p>
                <p className={`mt-3 text-xs font-semibold ${student.open_error_count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{student.open_error_count > 0 ? `${student.open_error_count} ponto(s) para fortalecer` : 'Nenhum ponto urgente'}</p>
                {student.target_skill_title ? <p className="mt-1 text-xs text-slate-500">Objetivo: {humanizeSkill(null, student.target_skill_title)}</p> : null}
                <span className="mt-3 inline-flex text-xs font-bold text-[#005bbf]">Ver desempenho</span>
              </Link>
            ))}
          </div>
        ) : <PageState>Esta turma não tem alunos ativos no seu escopo.</PageState>}
      </section>
    </div>
  );
}
