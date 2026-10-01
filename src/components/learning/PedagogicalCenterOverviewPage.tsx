import { AlertTriangle, ArrowRight, ClipboardList, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherGuidedInsightsV2 } from '../../hooks/useAdaptiveLearning';
import { useTeacherClassKnowledgeHeatmap } from '../../hooks/useAdaptiveLearning';
import { useTeacherLearningClasses, useTeacherLearningStudents } from '../../hooks/useLearningCenter';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterOverviewPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [params, setParams] = useSearchParams();
  const classes = useTeacherLearningClasses(profile?.id);
  const students = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const journeys = useTeacherGuidedInsightsV2(currentInstitutionId ?? undefined);
  const classId = params.get('class') ?? '';
  const heatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, classId || undefined);
  const [selectedClass, setSelectedClass] = useState(classId);
  const setClass = (value: string) => {
    setSelectedClass(value);
    const next = new URLSearchParams(params);
    if (value) next.set('class', value); else next.delete('class');
    setParams(next);
  };
  const attention = (students.data ?? []).filter((student) => student.open_error_count > 0 || student.active_session_status === 'NEEDS_TEACHER_SUPPORT');

  return <div className="space-y-6"><PedagogicalCenterHeader subtitle="Acompanhe quem precisa de atenção e escolha a próxima decisão." />
    <section aria-label="Contexto da turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><label className="block max-w-md text-sm font-bold dark:text-white">Turma selecionada<select aria-label="Turma selecionada" value={selectedClass} onChange={(event) => setClass(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white"><option value="">Todas as turmas</option>{classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="mt-2 text-xs text-slate-500">A turma fica na URL para permitir atualização, voltar e link direto.</p></section>
    <section className="grid gap-4 md:grid-cols-3"><article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><UsersRound className="h-5 w-5 text-[#005bbf]" /><p className="mt-3 text-2xl font-bold dark:text-white">{students.data?.length ?? 0}</p><p className="text-sm text-slate-500">alunos no seu escopo</p><Link to="/teacher/pedagogical-center/students" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Abrir alunos <ArrowRight className="h-3.5 w-3.5" /></Link></article><article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{attention.length}</p><p className="text-sm text-slate-500">alunos que precisam de atenção</p><Link to="/teacher/pedagogical-center/journeys" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Ver jornadas <ArrowRight className="h-3.5 w-3.5" /></Link></article><article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><ClipboardList className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold dark:text-white">{journeys.data?.length ?? 0}</p><p className="text-sm text-slate-500">jornadas aguardando decisão</p><Link to="/teacher/pedagogical-center/journeys" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#005bbf]">Abrir inbox <ArrowRight className="h-3.5 w-3.5" /></Link></article></section>
    <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold dark:text-white">Mapa rápido</h2><p className="mt-1 text-sm text-slate-500">Escolha uma turma para ver os sinais agregados por habilidade.</p></div><Link to={`/teacher/pedagogical-center/map${selectedClass ? `?class=${selectedClass}` : ''}`} className="text-xs font-bold text-[#005bbf]">Abrir mapa</Link></div>{!selectedClass ? <PageState>Selecione uma turma para carregar o mapa.</PageState> : heatmap.isLoading ? <PageState>Carregando evidências da turma...</PageState> : heatmap.isError ? <PageState error>Não foi possível carregar o mapa desta turma.</PageState> : heatmap.data?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{heatmap.data.slice(0, 6).map((row) => <div key={`${row.subjectCode}-${row.skillCode}`} className="rounded-lg border p-3 dark:border-slate-700"><p className="text-xs font-bold uppercase text-[#005bbf]">{row.subjectCode}</p><p className="mt-1 text-sm font-semibold dark:text-white">{row.skillCode}</p><p className="mt-2 text-xs text-slate-500">{row.needsReviewCount} para revisar · {row.unknownCount} sem evidência</p></div>)}</div> : <PageState>Ainda não há evidências para esta turma.</PageState>}</section>
  </div>;
}
