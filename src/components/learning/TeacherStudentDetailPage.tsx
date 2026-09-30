import { ArrowLeft, BookOpen, CheckCircle2, CircleAlert, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherStudentKnowledgeGraph } from '../../hooks/useAdaptiveLearning';
import {
  useAssignLearningPackage,
  useLearningPackages,
  useTeacherLearningStudentDetail,
  useTeacherLearningStudents,
} from '../../hooks/useLearningCenter';
import { TeacherKnowledgeGraphPanel } from './KnowledgeGraphPanels';

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const detail = useTeacherLearningStudentDetail(currentInstitutionId ?? undefined, studentId);
  const knowledgeGraph = useTeacherStudentKnowledgeGraph(currentInstitutionId ?? undefined, studentId);
  const packages = useLearningPackages(currentInstitutionId ?? undefined);
  const assign = useAssignLearningPackage(currentInstitutionId ?? undefined);
  const [packageId, setPackageId] = useState('');

  if (detail.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando acompanhamento...</div>;
  if (detail.isError || !detail.data) return <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Este aluno não está no seu escopo pedagógico.</section>;

  const data = detail.data;
  const assignSelected = () => {
    if (!packageId || !studentId) return;
    assign.mutate({ packageId, studentId }, { onSuccess: () => setPackageId('') });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/teacher/pedagogical-center" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ArrowLeft className="h-4 w-4" />Central Pedagógica</Link>
        <span className="text-xs text-slate-500">Acompanhamento restrito às suas turmas</span>
      </div>
      <header className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Detalhe do aluno</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{data.student.full_name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">{data.student.class_name}</p>
      </header>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <TeacherKnowledgeGraphPanel
            skills={knowledgeGraph.data}
            isLoading={knowledgeGraph.isLoading}
            isError={knowledgeGraph.isError}
          />
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#005bbf]" /><h2 className="font-bold dark:text-white">Habilidades e domínio</h2></div>
            {data.progress.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{data.progress.map((item) => <article key={item.canonical_skill_id} className="rounded-lg border p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><p className="font-semibold dark:text-white">{item.skill_title}</p><span className="text-xs font-bold text-slate-500">{Math.round(item.mastery_estimate)}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-[#005bbf]" style={{ width: `${Math.min(100, Math.max(0, item.mastery_estimate))}%` }} /></div><p className="mt-2 text-xs text-slate-500">{item.state} · {item.evidence_count} evidência(s)</p></article>)}</div> : <p className="mt-4 text-sm text-slate-500">Ainda não há evidências de aprendizagem.</p>}
          </section>
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2"><CircleAlert className="h-5 w-5 text-amber-600" /><h2 className="font-bold dark:text-white">Pontos para revisar</h2><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{data.open_errors.length}</span></div>
            {data.open_errors.length ? <ul className="mt-4 space-y-2">{data.open_errors.map((item) => <li key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">{item.error_count} erro(s) · última tentativa {new Date(item.last_missed_at).toLocaleDateString('pt-BR')}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nenhuma lacuna aberta no momento.</p>}
          </section>
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-bold dark:text-white">Sessões e resultados</h2>
            {data.guided_sessions.length ? <div className="mt-4 space-y-3">{data.guided_sessions.slice(0, 3).map((session) => <article key={session.id} className="rounded-lg border p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold dark:text-white">{session.target_skill_title}</p><p className="mt-1 text-xs text-slate-500">{session.steps.filter((step) => step.status === 'COMPLETED').length}/{session.steps.length} etapas concluídas</p></div><span className="text-xs font-bold text-[#005bbf]">{session.status}</span></div></article>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma sessão guiada registrada.</p>}
            {data.recent_attempts.length ? <div className="mt-5 divide-y dark:divide-slate-700">{data.recent_attempts.map((attempt) => <div key={attempt.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold dark:text-white">{attempt.activity_title}</p><p className="text-xs text-slate-500">{new Date(attempt.completed_at).toLocaleDateString('pt-BR')}</p></div><span className="font-bold text-slate-700 dark:text-slate-200">{attempt.score}/{attempt.total_points}</span></div>)}</div> : null}
          </section>
        </main>
        <aside className="space-y-5">
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="font-bold dark:text-white">Próxima ação</h2></div><p className="mt-3 text-sm text-slate-500">Atribua uma trilha curta ou crie uma prática de reforço para este aluno.</p><select value={packageId} onChange={(event) => setPackageId(event.target.value)} className="mt-4 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white"><option value="">Escolha uma trilha</option>{packages.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" onClick={assignSelected} disabled={!packageId || assign.isPending} className="mt-3 w-full rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{assign.isPending ? 'Atribuindo...' : 'Atribuir ao aluno'}</button><Link to="/teacher/pedagogical-center#nova-atividade" className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-bold text-[#005bbf]">Criar reforço</Link></section>
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-[#005bbf]" /><h2 className="font-bold dark:text-white">Outros alunos</h2></div><div className="mt-3 space-y-2">{students.data?.filter((item) => item.student_id !== studentId).slice(0, 8).map((item) => <Link key={item.student_id} to={`/teacher/pedagogical-center/students/${item.student_id}`} className="block rounded-lg border p-3 text-sm hover:border-[#005bbf] dark:border-slate-700"><p className="font-semibold dark:text-white">{item.full_name}</p><p className="text-xs text-slate-500">{item.class_name}</p></Link>)}</div></section>
        </aside>
      </div>
      <span className="sr-only">Professor atual: {profile?.full_name ?? 'Professor'}</span>
    </div>
  );
}
