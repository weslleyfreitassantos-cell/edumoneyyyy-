import { Link } from 'react-router-dom';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherLearningStudents } from '../../hooks/useLearningCenter';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterStudentsPage() {
  const { currentInstitutionId } = useInstitution();
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  return <div className="space-y-6"><PedagogicalCenterHeader subtitle="Abra um aluno para revisar sinais, mapa e próxima ação." /><section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Alunos em acompanhamento</h2>{students.isLoading ? <PageState>Carregando alunos...</PageState> : students.isError ? <PageState error>Não foi possível carregar seus alunos.</PageState> : students.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{students.data.map((student) => <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700"><div className="flex items-start justify-between gap-3"><p className="font-semibold dark:text-white">{student.full_name}</p><span className="text-xs font-bold text-[#005bbf]">{Math.round(student.average_mastery)}%</span></div><p className="mt-1 text-xs text-slate-500">{student.class_name}</p><p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{student.open_error_count} ponto(s) para fortalecer</p>{student.target_skill_title ? <p className="mt-1 text-xs text-slate-500">Objetivo: {student.target_skill_title}</p> : null}</Link>)}</div> : <PageState>Nenhum aluno disponível no seu escopo.</PageState>}</section></div>;
}
