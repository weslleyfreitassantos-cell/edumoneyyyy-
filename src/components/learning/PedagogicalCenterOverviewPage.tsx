import { AlertTriangle, ArrowRight, BarChart3, ClipboardList, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherGuidedInsightsV2, useTeacherClassKnowledgeHeatmap } from '../../hooks/useAdaptiveLearning';
import { useTeacherLearningActivities, useTeacherLearningClasses, useTeacherLearningStudents } from '../../hooks/useLearningCenter';
import { humanizeSkill, humanizeSubjectArea } from '../../lib/learningPresentation';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterOverviewPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const classes = useTeacherLearningClasses(currentInstitutionId ?? undefined, profile?.id);
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const activities = useTeacherLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const journeys = useTeacherGuidedInsightsV2(currentInstitutionId ?? undefined);
  const classId = params.get('class') ?? '';
  const [selectedClass, setSelectedClass] = useState(classId);
  const heatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, selectedClass || undefined);
  const scopedStudents = useMemo(() => (students.data ?? []).filter((student) => !selectedClass || student.class_id === selectedClass), [selectedClass, students.data]);
  const attention = scopedStudents.filter((student) => student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT');
  const publishedActivities = (activities.data ?? []).filter((activity) => activity.status === 'PUBLISHED');
  const setClass = (value: string) => {
    setSelectedClass(value);
    const next = new URLSearchParams(params);
    if (value) next.set('class', value); else next.delete('class');
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <PedagogicalCenterHeader subtitle="Veja como suas turmas estão e decida o que fazer em seguida." />
      <section aria-label="Contexto da turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="block max-w-md text-sm font-bold dark:text-white">Turma
          <select aria-label="Turma selecionada" value={selectedClass} onChange={(event) => setClass(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
            <option value="">Todas as turmas</option>
            {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">A turma fica na URL para permitir voltar e compartilhar este contexto.</p>
      </section>
      <section aria-label="Resumo da turma" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><UsersRound className="h-5 w-5 text-[#005bbf]" /><p className="mt-3 text-2xl font-bold dark:text-white">{scopedStudents.length}</p><p className="text-sm text-slate-500">alunos no seu escopo</p><Link to={`/teacher/pedagogical-center/students${selectedClass ? `?class=${selectedClass}` : ''}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Ver alunos <ArrowRight className="h-3.5 w-3.5" /></Link></article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{attention.length}</p><p className="text-sm text-slate-500">precisam de atenção</p><Link to={`/teacher/pedagogical-center/students${selectedClass ? `?class=${selectedClass}` : ''}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Abrir lista <ArrowRight className="h-3.5 w-3.5" /></Link></article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><BarChart3 className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{publishedActivities.length}</p><p className="text-sm text-slate-500">atividades publicadas</p><Link to="/teacher/pedagogical-center/activities" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Ver atividades <ArrowRight className="h-3.5 w-3.5" /></Link></article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><ClipboardList className="h-5 w-5 text-[#005bbf]" /><p className="mt-3 text-2xl font-bold dark:text-white">{journeys.data?.length ?? 0}</p><p className="text-sm text-slate-500">próximas decisões</p><Link to={`/teacher/pedagogical-center/students${selectedClass ? `?class=${selectedClass}` : ''}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Ver alunos <ArrowRight className="h-3.5 w-3.5" /></Link></article>
      </section>
      <section aria-label="Alunos que precisam de atenção" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Quem precisa de atenção</h2><p className="mt-1 text-sm text-slate-500">Sinais reais da turma para orientar a próxima intervenção.</p></div><Link to={`/teacher/pedagogical-center/students${selectedClass ? `?class=${selectedClass}` : ''}`} className="text-xs font-bold text-[#005bbf]">Ver todos</Link></div>
        {students.isLoading ? <PageState>Carregando sinais da turma...</PageState> : students.isError ? <PageState error>Não foi possível carregar os sinais desta turma.</PageState> : attention.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{attention.slice(0, 6).map((student) => <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold dark:text-white">{student.full_name}</p><p className="mt-1 text-xs text-slate-500">{student.class_name}</p></div><span className="text-xs font-bold text-amber-700 dark:text-amber-300">Ver desempenho</span></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{student.open_error_count ? `${student.open_error_count} ponto(s) para fortalecer` : 'Estudo guiado precisa de acompanhamento'}</p>{student.target_skill_title ? <p className="mt-1 text-xs text-slate-500">Foco: {humanizeSkill(null, student.target_skill_title)}</p> : null}</Link>)}</div> : <PageState>{selectedClass ? 'Esta turma não tem sinais urgentes agora.' : 'Suas turmas não têm sinais urgentes agora.'}</PageState>}
      </section>
      <section aria-label="Dificuldades coletivas" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Dificuldades coletivas</h2><p className="mt-1 text-sm text-slate-500">Veja quais tópicos merecem uma atividade de revisão.</p></div><Link to={`/teacher/pedagogical-center/map${selectedClass ? `?class=${selectedClass}` : ''}`} className="text-xs font-bold text-[#005bbf]">Abrir resultados</Link></div>
        {!selectedClass ? <PageState>Escolha uma turma para ver as dificuldades coletivas.</PageState> : heatmap.isLoading ? <PageState>Carregando resultados da turma...</PageState> : heatmap.isError ? <PageState error>Não foi possível carregar os resultados desta turma.</PageState> : heatmap.data?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{heatmap.data.slice(0, 6).map((row) => <Link key={`${row.subjectCode}-${row.skillCode}`} to={`/teacher/pedagogical-center/map?class=${selectedClass}`} className="rounded-lg border p-3 transition hover:border-[#005bbf] dark:border-slate-700"><p className="text-xs font-bold uppercase text-[#005bbf]">{humanizeSubjectArea(row.subjectCode)}</p><p className="mt-1 text-sm font-semibold dark:text-white">{humanizeSkill(row.skillCode)}</p><p className="mt-2 text-xs text-slate-500">{row.needsReviewCount} precisam de atenção · {row.practicingCount} em desenvolvimento</p></Link>)}</div> : <PageState>Ainda não há resultados suficientes para esta turma.</PageState>}
      </section>
    </div>
  );
}
