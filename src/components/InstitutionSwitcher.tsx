import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

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
): string | null {
  if (!role) {
    return null;
  }

  return roleLabels[role] ?? role;
}

export default function InstitutionSwitcher() {
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
      <div className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#727785]">
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
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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
      <div className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#727785]">
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
  );

  const canCreateInstitution = institutions.some(
    (item) => item.accessSource === 'account_owner',
  );

  if (!hasMultipleInstitutions) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-left shadow-sm">
          <Building2
            className="h-4 w-4 text-[#005bbf]"
            aria-hidden="true"
          />

          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#181c20]">
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfe3e8] bg-white text-[#005bbf] shadow-sm transition-colors hover:bg-blue-50"
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
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="institution-switcher"
        className="sr-only"
      >
        Escola atual
      </label>

      <div className="relative">
        <Building2
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#005bbf]"
          aria-hidden="true"
        />

        <select
          id="institution-switcher"
          aria-label="Selecionar escola atual"
          value={currentInstitutionId ?? ''}
          onChange={(event) =>
            setCurrentInstitutionId(
              event.target.value,
            )
          }
          className="w-full min-w-60 rounded-lg border border-[#dfe3e8] bg-white py-2 pl-9 pr-8 text-sm font-semibold text-[#181c20] shadow-sm outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
        >
          {institutions.map((item) => {
            const roleLabel = getRoleLabel(
              item.effectiveRole,
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
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#dfe3e8] bg-white text-[#005bbf] shadow-sm transition-colors hover:bg-blue-50"
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
