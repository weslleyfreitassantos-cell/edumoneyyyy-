import { ChevronLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useLearningSkills,
  useLearningUnits,
  usePublishedLearningActivities,
  useStudentLearningSubjects,
} from '../../hooks/useLearningCenter';

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const subjects = useStudentLearningSubjects(currentInstitutionId ?? undefined, profile?.id);
  const activities = usePublishedLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const selectedSubject = subjects.data?.find((item) => item.id === subjectId);
  const units = useLearningUnits(currentInstitutionId ?? undefined, selectedSubject?.id);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, selectedUnitId);
  const subjectActivities = useMemo(
    () => (activities.data ?? []).filter((activity) => activity.subject_id === selectedSubject?.id),
    [activities.data, selectedSubject?.id],
  );

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

        {units.isLoading ? <p className="mt-5 text-sm text-slate-500">Carregando conteúdos...</p> : null}
        {units.data?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{units.data.map((unit) => <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} aria-pressed={selectedUnitId === unit.id} className={`rounded-lg border p-3 text-left text-sm transition hover:border-[#005bbf] ${selectedUnitId === unit.id ? 'border-[#005bbf] bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100' : 'dark:border-slate-700 dark:text-slate-200'}`}><span className="font-semibold">{unit.title}</span>{unit.description ? <span className="mt-1 block text-xs text-slate-500">{unit.description}</span> : null}</button>)}</div> : null}
        {selectedUnitId && skills.data?.length ? <div className="mt-4"><p className="text-sm font-bold dark:text-white">Conteúdos para praticar</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{skills.data.map((skill) => <li key={skill.id} className="rounded-lg border p-3 text-sm dark:border-slate-700 dark:text-slate-200">{skill.title}</li>)}</ul></div> : null}
        {subjectActivities.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold dark:text-white">Atividades disponíveis</p>{subjectActivities.slice(0, 4).map((activity) => <Link key={activity.id} to={`/student/study/activity/${activity.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition hover:border-[#005bbf] dark:border-slate-700"><span className="font-semibold dark:text-slate-100">{activity.title}</span><span className="shrink-0 text-xs font-bold text-[#005bbf]">Abrir</span></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">A próxima atividade desta matéria será preparada para você.</p>}
      </section>
    </div>
  );
}
