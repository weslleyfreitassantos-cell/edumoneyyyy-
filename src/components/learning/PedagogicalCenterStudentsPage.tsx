import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherLearningClasses, useTeacherLearningStudents } from '../../hooks/useLearningCenter';
import { humanizeSkill } from '../../lib/learningPresentation';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterStudentsPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const classId = params.get('class') ?? '';
  const classes = useTeacherLearningClasses(currentInstitutionId ?? undefined, profile?.id);
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const scopedStudents = useMemo(
    () => (students.data ?? []).filter((student) => !classId || student.class_id === classId),
    [classId, students.data],
  );
  const selectedClass = classes.data?.find((item) => item.id === classId);

  return (
    <div className="space-y-6">
      <PedagogicalCenterHeader subtitle="Encontre um aluno, entenda o sinal e escolha a próxima ação." />
      <section aria-label="Contexto dos alunos" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="block max-w-md text-sm font-bold dark:text-white">
          Turma
          <select
            aria-label="Turma dos alunos"
            value={classId}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set('class', event.target.value);
              else next.delete('class');
              setParams(next);
            }}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white"
          >
            <option value="">Todas as turmas do seu escopo</option>
            {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">{selectedClass ? `Mostrando os alunos de ${selectedClass.name}.` : 'A lista mostra somente alunos das turmas em que você leciona.'}</p>
      </section>
      <section aria-label="Alunos em acompanhamento" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Alunos em acompanhamento</h2>
            <p className="mt-1 text-sm text-slate-500">Abra um aluno para revisar sinais, desempenho e próxima ação.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{scopedStudents.length}</span>
        </div>
        {students.isLoading ? <PageState>Carregando alunos...</PageState> : students.isError ? <PageState error>Não foi possível carregar os alunos do seu escopo.</PageState> : scopedStudents.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scopedStudents.map((student) => (
              <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700">
                <div className="flex items-start justify-between gap-3"><p className="font-semibold dark:text-white">{student.full_name}</p><span className="text-xs font-bold text-[#005bbf]">{Math.round(student.average_mastery)}%</span></div>
                <p className="mt-1 text-xs text-slate-500">{student.class_name}</p>
                <p className={`mt-3 text-xs font-semibold ${student.open_error_count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{student.open_error_count > 0 ? `${student.open_error_count} ponto(s) para fortalecer` : 'Nenhum ponto urgente'}</p>
                {student.target_skill_title ? <p className="mt-1 text-xs text-slate-500">Objetivo: {humanizeSkill(null, student.target_skill_title)}</p> : null}
                <span className="mt-3 inline-flex text-xs font-bold text-[#005bbf]">Ver desempenho</span>
              </Link>
            ))}
          </div>
        ) : <PageState>{classId ? 'Esta turma não tem alunos ativos no seu escopo.' : 'Nenhum aluno ativo foi encontrado nas turmas em que você leciona.'}</PageState>}
      </section>
    </div>
  );
}
