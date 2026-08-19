import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolSetupReadiness } from '../hooks/useSchoolSetupReadiness';
import SchoolSetupProgress from '../components/academic/SchoolSetupProgress';
import TimetableAutomationPanel from '../components/academic/TimetableAutomationPanel';

export default function SchoolSetupPage() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const readinessQuery = useSchoolSetupReadiness(institutionId);

  if (institutionQuery.isLoading || readinessQuery.isLoading) {
    return (
      <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-[#667085]">
        Carregando configuração da escola...
      </section>
    );
  }

  if (institutionQuery.isError || readinessQuery.isError || !institutionId) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Não foi possível carregar a configuração da escola.
      </section>
    );
  }

  const readiness = readinessQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">
          Configurar escola
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#181c20]">
          Configuração guiada da escola
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Complete a estrutura acadêmica e revise a grade antes de iniciar a operação.
        </p>
      </div>

      <SchoolSetupProgress institutionId={institutionId} />

      {readiness && readiness.nextStepId === 'timetable' && !readiness.configured && (
        <TimetableAutomationPanel
          institutionId={institutionId}
          createdBy={profile?.id ?? ''}
        />
      )}
    </div>
  );
}
