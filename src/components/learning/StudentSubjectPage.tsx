import { ChevronLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningSkills,
  useLearningStudent,
  useLearningUnits,
  usePublishedLearningActivities,
  useStartGuidedLearningSessionV2,
  useStudentGuidedLearningTargets,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const navigate = useNavigate();
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const student = useLearningStudent(currentInstitutionId ?? undefined, profile?.id);
  const selectedSubject = subjects.data?.find((item) => item.id === subjectId);
  const guidedTargets = useStudentGuidedLearningTargets(currentInstitutionId ?? undefined, student.data?.id);
  const startGuided = useStartGuidedLearningSessionV2(currentInstitutionId ?? undefined, student.data?.id);
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubject?.id);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, selectedUnitId);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubject?.id),
    [activities.data, selectedSubject?.id],
  );
  const subjectGuidedTargets = useMemo(
    () => (guidedTargets.data ?? []).filter((target) => target.subject_id === selectedSubject?.id),
    [guidedTargets.data, selectedSubject?.id],
  );

  async function startGuidedTarget(targetCanonicalSkillId: string) {
    await startGuided.mutateAsync(targetCanonicalSkillId);
    navigate('/student/study/guided');
  }

  if (subjects.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando matéria...</div>;
  if (subjects.isError || !selectedSubject) {
    return (
      <section className="space-y-4">
        <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta matéria não está disponível para você.</div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar às matérias</Link>
      <section aria-label={`Estudo de ${selectedSubject.name}`} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Área da matéria</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{selectedSubject.name}</h1>
        <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">Continue de onde parou ou escolha um conteúdo.</p>

        {subjectGuidedTargets.length ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"><p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Conteúdos para aprender</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">Habilidades BNCC vinculadas a esta matéria e à sua série.</p><div className="mt-3 space-y-2">{subjectGuidedTargets.map((target) => { const active = Boolean(target.active_session_id); const ready = target.availability_status === 'READY' || target.availability_status === 'NO_ACTIVE_SESSION'; return <div key={target.target_canonical_skill_id} className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900 dark:text-white">{target.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{target.official_code} · {target.grade_level}º ano · {target.question_count} exercício(s)</p></div>{active ? <Link to="/student/study/guided" className="inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">Continuar</Link> : ready ? <button type="button" disabled={startGuided.isPending} onClick={() => void startGuidedTarget(target.target_canonical_skill_id)} className="inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{startGuided.isPending ? 'Iniciando...' : 'Iniciar estudo guiado'}</button> : <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{target.reason}</span>}</div>; })}</div></div> : null}

        {units.isLoading ? <p className="mt-5 text-sm text-slate-500">Carregando conteúdos...</p> : null}
        {units.data?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{units.data.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnitId === unit.id} className={`rounded-lg border p-3 text-left text-sm transition hover:border-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'dark:border-slate-700 dark:text-slate-200'}`}><span className="font-semibold">{unit.title}</span>{unit.description ? <span className="mt-1 block text-xs text-slate-500">{unit.description}</span> : null}</button>)}</div> : null}
        {selectedUnitId && skills.data?.length ? <div className="mt-4"><p className="text-sm font-bold dark:text-white">Conteúdos para praticar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{skills.data.map((skill) => <li key={skill.id} className="rounded-lg border p-3 text-sm dark:border-slate-700 dark:text-slate-200">{skill.title}</li>)}</ul></div> : null}
        {subjectActivities.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold dark:text-white">Atividades disponíveis</p>{subjectActivities.slice(0, 4).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Nenhuma atividade institucional publicada para esta matéria.</p>}
      </section>
    </div>
  );
}
