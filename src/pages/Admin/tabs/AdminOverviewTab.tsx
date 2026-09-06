import type { ReactNode } from 'react';

import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Layers3,
  School,
  UserRoundCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useAdminOverview } from '../../../hooks/useAdminOverview';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import SchoolSetupProgress from '../../../components/academic/SchoolSetupProgress';
import type { AdminModuleId } from '../adminNavigation';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import { canManageAcademicStructure } from '../../../lib/permissions';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(error, 'Não foi possível carregar a visão geral.');
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#727785]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#181c20]">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>
      </div>
    </article>
  );
}

interface AdminOverviewTabProps {
  availableModuleIds?: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
}

export default function AdminOverviewTab({
  availableModuleIds = [],
  onNavigateToModule,
}: AdminOverviewTabProps) {
  const { profile } = useAuth();

  const institutionQuery = useCurrentInstitution(profile?.id);

  const institutionId = institutionQuery.data ?? '';
  const canEditAcademic = canManageAcademicStructure(
    profile?.platform_role,
    institutionQuery.currentRole as Parameters<typeof canManageAcademicStructure>[1],
  );
  const overviewQuery = useAdminOverview(institutionId);

  if (institutionQuery.isLoading || overviewQuery.isLoading) {
    return (
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
        Carregando visão geral...
      </div>
    );
  }

  if (!institutionId) {
    return (
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-lg font-extrabold text-[#181c20]">Crie a primeira escola</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#475467]">
          Nenhuma instituição está selecionada. Crie ou selecione uma escola para acompanhar a configuração acadêmica.
        </p>
        <a href="/account" className="mt-4 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b]">
          Gerenciar instituições
        </a>
      </section>
    );
  }

  if (
    institutionQuery.isError ||
    overviewQuery.isError ||
    !overviewQuery.data
  ) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        {getErrorMessage(
          institutionQuery.error ?? overviewQuery.error,
        )}
      </div>
    );
  }

  const { metrics } = overviewQuery.data;

  return (
    <div className="space-y-6">
      <SchoolSetupProgress
        institutionId={institutionId}
        canEditAcademic={canEditAcademic}
        configurationHref={availableModuleIds.includes('directors') ? '/admin?module=directors' : '/admin?module=school-users'}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Alunos ativos"
          value={metrics.activeStudents}
          icon={
            <GraduationCap
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Alunos inativos"
          value={metrics.inactiveStudents}
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Professores ativos"
          value={metrics.activeTeachers}
          icon={
            <UserRoundCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Responsáveis ativos"
          value={metrics.activeGuardians}
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Turmas ativas"
          value={metrics.activeClasses}
          icon={
            <School
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Disciplinas ativas"
          value={metrics.activeSubjects}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Matrículas ativas"
          value={metrics.activeEnrollments}
          icon={
            <Layers3
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Atribuições ativas"
          value={metrics.activeAssignments}
          icon={
            <CalendarDays
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Itens na matriz"
          value={metrics.activeCurriculumItems}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />
      </section>
    </div>
  );
}
