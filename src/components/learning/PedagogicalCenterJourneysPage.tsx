import { Link } from 'react-router-dom';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherGuidedInsightsV2 } from '../../hooks/useAdaptiveLearning';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterJourneysPage() {
  const { currentInstitutionId } = useInstitution();
  const journeys = useTeacherGuidedInsightsV2(currentInstitutionId ?? undefined);
  return <div className="space-y-6"><PedagogicalCenterHeader subtitle="Jornadas que precisam de uma decisão do professor." /><section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Inbox de jornadas</h2>{journeys.isLoading ? <PageState>Carregando jornadas...</PageState> : journeys.isError ? <PageState error>Não foi possível carregar a inbox.</PageState> : journeys.data?.length ? <div className="mt-4 divide-y dark:divide-slate-700">{journeys.data.map((journey) => <div key={journey.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold dark:text-white">{journey.studentName}</p><p className="mt-1 text-xs text-slate-500">{journey.targetCanonicalSkillId} · {journey.decisionReason ?? journey.status}</p><p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{journey.replanCount} replanejamento(s)</p></div><Link to={`/teacher/pedagogical-center/students/${journey.studentId}`} className="rounded-lg border border-[#005bbf] px-3 py-2 text-xs font-bold text-[#005bbf]">Ver aluno</Link></div>)}</div> : <PageState>Nenhuma jornada aguardando atenção.</PageState>}</section></div>;
}
