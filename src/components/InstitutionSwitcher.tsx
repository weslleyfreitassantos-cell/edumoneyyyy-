import { Building2, Plus } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administração',
  DIRECTOR: 'Direção',
  SECRETARY: 'Secretaria',
  TEACHER: 'Professor',
  STUDENT: 'Aluno',
  GUARDIAN: 'Responsável',
};

function getRoleLabel(
  role: string | null,
  isSuperAdmin: boolean,
): string | null {
  if (isSuperAdmin) {
    return null;
  }

  if (!role) {
    return null;
  }

  return roleLabels[role] ?? role;
}

export default function InstitutionSwitcher() {
  const { profile } = useAuth();
  const isSuperAdmin =
    profile?.platform_role === 'SUPER_ADMIN';
  const generatedId = useId();
  const selectId = `institution-switcher-${generatedId}`;
  const descriptionId = `${selectId}-description`;
  const {
    institutions,
    currentInstitution,
    currentInstitutionId,
    currentRole,
    isLoading,
    error,
    hasMultipleInstitutions,
    setCurrentInstitutionId,
  } = useInstitution();

  if (isLoading) {
    return (
      <div
        role="status"
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#d8deea] bg-white px-3 py-2 text-sm font-semibold text-[#667085] shadow-sm md:w-auto"
      >
        <Building2
          className="h-4 w-4"
          aria-hidden="true"
        />
        Carregando escola...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="status"
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 md:w-auto"
      >
        <Building2
          className="h-4 w-4"
          aria-hidden="true"
        />
        Não foi possível carregar escolas
      </div>
    );
  }

  if (!currentInstitution) {
    return (
      <div
        role="status"
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#d8deea] bg-white px-3 py-2 text-sm font-semibold text-[#667085] shadow-sm md:w-auto"
      >
        <Building2
          className="h-4 w-4"
          aria-hidden="true"
        />
        Nenhuma escola ativa
      </div>
    );
  }

  const currentRoleLabel = getRoleLabel(
    currentRole,
    isSuperAdmin,
  );

  const canCreateInstitution = institutions.some(
    (item) => item.accessSource === 'account_owner',
  );

  if (!hasMultipleInstitutions) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
        <div className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d8deea] bg-white px-3 py-2 text-left shadow-sm md:flex-none">
          <Building2
            className="h-4 w-4 text-[#005bbf]"
            aria-hidden="true"
          />

          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-[#181c20]">
              {currentInstitution.name}
            </p>

            {currentRoleLabel && (
              <p className="text-xs text-[#727785]">
                {currentRoleLabel}
              </p>
            )}
          </div>
        </div>

        {canCreateInstitution && (
          <Link
            to="/account"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8deea] bg-white text-[#005bbf] shadow-sm outline-none transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#005bbf]"
            aria-label="Nova instituição"
            title="Nova instituição"
          >
            <Plus
              className="h-4 w-4"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
      <label
        htmlFor={selectId}
        className="sr-only"
      >
        Selecionar escola atual
      </label>
      <span
        id={descriptionId}
        className="sr-only"
      >
        Escolha uma das escolas autorizadas para ativar no sistema.
      </span>

      <div className="relative min-w-0 flex-1 md:flex-none">
        <Building2
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#005bbf]"
          aria-hidden="true"
        />

        <select
          id={selectId}
          aria-describedby={descriptionId}
          value={currentInstitutionId ?? ''}
          onChange={(event) => {
            void setCurrentInstitutionId(
              event.target.value,
            );
          }}
          className="h-11 w-full min-w-0 rounded-xl border border-[#d8deea] bg-white py-2 pl-9 pr-8 text-sm font-bold text-[#181c20] shadow-sm outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 md:min-w-64"
        >
          {institutions.map((item) => {
            const roleLabel = getRoleLabel(
              item.effectiveRole,
              isSuperAdmin,
            );

            return (
              <option
                key={item.institution.id}
                value={item.institution.id}
              >
                {roleLabel
                  ? `${item.institution.name} - ${roleLabel}`
                  : item.institution.name}
              </option>
            );
          })}
        </select>
      </div>

      {canCreateInstitution && (
        <Link
          to="/account"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8deea] bg-white text-[#005bbf] shadow-sm outline-none transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#005bbf]"
          aria-label="Nova instituição"
          title="Nova instituição"
        >
          <Plus
            className="h-4 w-4"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
