import { BarChart3, CheckCircle2, PlayCircle, UsersRound } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useAssignLearningSimulation,
  useLearningSimulations,
  useTeacherLearningSimulationAssignments,
  useTeacherLearningSimulationResults,
  useTeacherLearningClasses,
} from '../../hooks/useLearningCenter';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function TeacherSimulationWorkflowPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [simulationId, setSimulationId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [message, setMessage] = useState('');

  const simulations = useLearningSimulations(currentInstitutionId ?? undefined);
  const classes = useTeacherLearningClasses(currentInstitutionId ?? undefined, profile?.id);
  const assignments = useTeacherLearningSimulationAssignments(currentInstitutionId ?? undefined);
  const results = useTeacherLearningSimulationResults(currentInstitutionId ?? undefined, selectedAssignmentId);
  const assign = useAssignLearningSimulation(currentInstitutionId ?? undefined);

  const submitAssignment = () => {
    if (!simulationId || !classId) return;
    setMessage('');
    assign.mutate({ simulationId, classId }, {
      onSuccess: () => {
        setMessage('Simulado liberado para a turma.');
        setSelectedAssignmentId('');
      },
      onError: (error) => setMessage(error instanceof Error ? error.message : 'Não foi possível liberar o simulado.'),
    });
  };

  return <div className="space-y-6">
    <PedagogicalCenterHeader subtitle="Libere simulados para uma turma e acompanhe a conclusão sem ranking." />
    <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <PlayCircle className="mt-0.5 h-5 w-5 text-[#005bbf]" aria-hidden="true" />
        <div><h2 className="font-bold dark:text-white">Atribuir simulado</h2><p className="mt-1 text-sm text-slate-500">A atribuição respeita suas turmas e a instituição atual.</p></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold dark:text-white">Simulado<select aria-label="Simulado para atribuição" value={simulationId} onChange={(event) => setSimulationId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Selecione um simulado</option>{(simulations.data ?? []).map((simulation) => <option key={simulation.id} value={simulation.id}>{simulation.title} · {simulation.question_count} questões</option>)}</select></label>
        <label className="text-sm font-semibold dark:text-white">Turma<select aria-label="Turma para atribuição" value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Selecione uma turma</option>{(classes.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <button type="button" onClick={submitAssignment} disabled={!simulationId || !classId || assign.isPending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><UsersRound className="h-4 w-4" aria-hidden="true" />{assign.isPending ? 'Liberando...' : 'Liberar para a turma'}</button>
      {message ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
    </section>

    <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3"><BarChart3 className="mt-0.5 h-5 w-5 text-[#005bbf]" aria-hidden="true" /><div><h2 className="font-bold dark:text-white">Acompanhamento das atribuições</h2><p className="mt-1 text-sm text-slate-500">Veja quem começou, concluiu e quais áreas precisam de reforço.</p></div></div>
      {assignments.isLoading ? <PageState>Carregando atribuições...</PageState> : assignments.isError ? <PageState error>Não foi possível carregar as atribuições.</PageState> : assignments.data?.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{assignments.data.map((item) => <button type="button" key={item.assignment_id} onClick={() => setSelectedAssignmentId(item.assignment_id)} className={`rounded-lg border p-4 text-left transition hover:border-[#005bbf] ${selectedAssignmentId === item.assignment_id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'dark:border-slate-700'}`}><p className="font-semibold dark:text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.class_name ?? item.student_name ?? 'Destino'} · {item.status ?? 'ACTIVE'}</p>{item.due_at ? <p className="mt-1 text-xs font-semibold text-[#005bbf]">Entrega até {new Date(item.due_at).toLocaleDateString('pt-BR')}</p> : null}</button>)}</div> : <PageState>Nenhum simulado foi atribuído ainda.</PageState>}
    </section>

    {selectedAssignmentId ? <section aria-label="Resultados do simulado atribuído" className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
      {results.isLoading ? <PageState>Calculando resultados...</PageState> : results.isError ? <PageState error>Não foi possível carregar os resultados desta atribuição.</PageState> : results.data ? <>
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" /><div><h2 className="font-bold text-blue-950 dark:text-blue-100">Resultado pedagógico</h2><p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Sem ranking: use os sinais para decidir o próximo reforço.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Atribuídos', results.data.summary.assigned], ['Iniciaram', results.data.summary.started], ['Concluíram', results.data.summary.completed], ['Pendentes', results.data.summary.not_started], ['Conclusão', `${results.data.summary.completion_rate}%`]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-900/60 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold dark:text-white">{value}</p></div>)}</div>
        <p className="mt-4 text-sm font-semibold text-blue-950 dark:text-blue-100">Precisão média entre concluídos: {results.data.summary.average_raw_accuracy}%</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">Por área</h3><ul className="mt-2 space-y-1 text-sm text-blue-900 dark:text-blue-200">{Object.entries(results.data.area_breakdown).map(([area, value]) => <li key={area} className="flex justify-between gap-3"><span>{area}</span><strong>{value.correct}/{value.total}</strong></li>)}{!Object.keys(results.data.area_breakdown).length ? <li>Sem dados concluídos.</li> : null}</ul></div><div><h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">Por habilidade</h3><ul className="mt-2 space-y-1 text-sm text-blue-900 dark:text-blue-200">{Object.entries(results.data.skill_breakdown).slice(0, 8).map(([skill, value]) => <li key={skill} className="flex justify-between gap-3"><span className="truncate">{skill}</span><strong>{value.correct}/{value.total}</strong></li>)}{!Object.keys(results.data.skill_breakdown).length ? <li>Sem dados concluídos.</li> : null}</ul></div></div>
        <div className="mt-4 border-t border-blue-200 pt-4 dark:border-blue-900/60"><h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">Alunos</h3><ul className="mt-2 divide-y divide-blue-200 dark:divide-blue-900/60">{results.data.students.map((student) => <li key={student.student_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-blue-950 dark:text-blue-100"><span>{student.student_name}</span><span className="text-xs font-semibold">{student.status === 'COMPLETED' ? `${student.score ?? 0}%` : student.status === 'IN_PROGRESS' ? 'Em andamento' : 'Não iniciado'}</span></li>)}</ul></div>
      </> : null}
    </section> : null}
  </div>;
}
