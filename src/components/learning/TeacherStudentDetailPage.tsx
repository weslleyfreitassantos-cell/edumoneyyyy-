import { ArrowLeft, CheckCircle2, CircleAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherStudentKnowledgeGraph } from '../../hooks/useAdaptiveLearning';
import {
  useTeacherLearningStudentDetail,
  useTeacherLearningStudents,
} from '../../hooks/useLearningCenter';

function masteryPercent(value: number) {
  return Math.round(value <= 1 ? value * 100 : value);
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
    default:
      return 'Em acompanhamento';
  }
}

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const { currentInstitutionId } = useInstitution();
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const detail = useTeacherLearningStudentDetail(currentInstitutionId ?? undefined, studentId);
  const knowledgeGraph = useTeacherStudentKnowledgeGraph(currentInstitutionId ?? undefined, studentId);

  if (detail.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando desempenho...</div>;
  if (detail.isError || !detail.data) return <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Este aluno não está no seu escopo pedagógico.</section>;

  const data = detail.data;
  const skills = knowledgeGraph.data ?? [];
  const otherStudents = students.data?.filter((item) => item.student_id !== studentId).slice(0, 8) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/teacher/pedagogical-center" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Desempenho</Link>
        <span className="text-xs text-slate-500">Acompanhamento restrito às suas turmas</span>
      </div>
      <header className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Desempenho do aluno</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{data.student.full_name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">{data.student.class_name}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <section aria-label="Desempenho por matéria" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div>
              <h2 className="font-bold dark:text-white">Desempenho por matéria</h2>
              <p className="mt-1 text-sm text-slate-500">Veja onde o aluno está avançando e quais conteúdos merecem atenção.</p>
            </div>
            {knowledgeGraph.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando desempenho...</p> : knowledgeGraph.isError ? <p className="mt-4 text-sm text-red-700">Não foi possível carregar o desempenho por matéria.</p> : skills.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {skills.map((skill) => {
                  const percent = masteryPercent(skill.mastery);
                  return <article key={`${skill.subjectCode}-${skill.skillCode}`} className="rounded-lg border p-4 dark:border-slate-700"><p className="text-xs font-bold uppercase text-[#005bbf]">{skill.subjectName}</p><h3 className="mt-1 font-semibold dark:text-white">{skill.skillTitle}</h3><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{progressLabel(skill.state)}</span><strong className="text-slate-800 dark:text-slate-100">{percent}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-[#005bbf]" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></article>;
                })}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">Ainda não há dados de desempenho para este aluno.</p>}
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2"><CircleAlert className="h-5 w-5 text-amber-600" /><h2 className="font-bold dark:text-white">Pontos para revisar</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{data.open_errors.length}</span></div>
            {data.open_errors.length ? <ul className="mt-4 space-y-2">{data.open_errors.map((item) => <li key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">{item.error_count} erro(s) · última tentativa {new Date(item.last_missed_at).toLocaleDateString('pt-BR')}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nenhum ponto precisa de revisão no momento.</p>}
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-bold dark:text-white">Atividades recentes</h2>
            {data.recent_attempts.length ? <div className="mt-4 divide-y dark:divide-slate-700">{data.recent_attempts.map((attempt) => <div key={attempt.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold dark:text-white">{attempt.activity_title}</p><p className="text-xs text-slate-500">{new Date(attempt.completed_at).toLocaleDateString('pt-BR')}</p></div><span className="font-bold text-slate-700 dark:text-slate-200">{attempt.score}/{attempt.total_points}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma atividade concluída recentemente.</p>}
          </section>
        </main>

        <aside>
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="font-bold dark:text-white">Outros alunos</h2></div>{otherStudents.length ? <div className="mt-3 space-y-2">{otherStudents.map((item) => <Link key={item.student_id} to={`/teacher/pedagogical-center/students/${item.student_id}`} className="block rounded-lg border p-3 text-sm hover:border-[#005bbf] dark:border-slate-700"><p className="font-semibold dark:text-white">{item.full_name}</p><p className="text-xs text-slate-500">{item.class_name}</p></Link>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhum outro aluno disponível.</p>}</section>
        </aside>
      </div>
    </div>
  );
}
