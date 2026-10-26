import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { usePsychologyModuleStatus } from '../hooks/usePsychologyModuleStatus';
import LoadingIndicator from './LoadingIndicator';

interface PsychologyRouteGateProps {
  children: ReactNode;
}

function getSafeHome(role: string): string {
  if (role === 'DIRECTOR' || role === 'SECRETARY') return '/admin?module=overview';
  return '/dashboard';
}

function canOpenSection(role: string, section: string, canManage: boolean | null): boolean {
  if (section === 'configuracao') {
    return role === 'DIRECTOR' || canManage === true;
  }
  const roleSections: Record<string, readonly string[]> = {
    STUDENT: ['agendar', 'agendamentos', 'chat', 'autorizacao'],
    GUARDIAN: ['autorizacao'],
    PSYCHOLOGIST: ['agenda', 'atendimentos', 'anotacoes', 'disponibilidade'],
  };
  return roleSections[role]?.includes(section) ?? false;
}

export function PsychologyRouteGate({ children }: PsychologyRouteGateProps) {
  const { profile } = useAuth();
  const institution = useInstitution();
  const location = useLocation();
  const role = (institution.currentRole ?? profile?.role ?? '').toUpperCase();
  const status = usePsychologyModuleStatus(
    institution.currentInstitutionId,
    profile?.id ?? null,
    role,
  );
  const section = location.pathname.split('/')[2] || 'agendar';
  const isConfiguration = section === 'configuracao';
  const canConfigure = role === 'DIRECTOR' || status.canManage === true;

  // Let the page show its institution-selection prompt instead of waiting on a
  // status request that cannot be made without an institution context.
  if (!institution.currentInstitutionId) return <>{children}</>;

  if (status.state === 'loading') {
    return (
      <main className="grid min-h-[40vh] place-items-center" aria-label="Verificando acesso à Psicologia">
        <LoadingIndicator />
      </main>
    );
  }

  if (isConfiguration && canConfigure) return <>{children}</>;

  if (status.state !== 'enabled') {
    return <Navigate to={role === 'DIRECTOR' ? '/psychology/configuracao' : getSafeHome(role)} replace />;
  }

  if (!canOpenSection(role, section, status.canManage)) {
    return <Navigate to={getSafeHome(role)} replace />;
  }

  return <>{children}</>;
}
