import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import type {
  DatabaseRole,
  PlatformRole,
} from '../lib/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: DatabaseRole[];
  allowedPlatformRoles?: PlatformRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
  allowedPlatformRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  // Token refreshes can briefly set loading while the authenticated shell
  // is still valid. Keep the current screen mounted in that case.
  if (loading && (!user || !profile)) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="max-w-md text-center">
          <h1 className="text-xl font-bold">
            Conta sem perfil válido
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            Sua conta foi autenticada, mas não possui um perfil acadêmico
            autorizado.
          </p>
        </section>
      </main>
    );
  }

  const hasAllowedRole =
    !allowedRoles ||
    allowedRoles.includes(profile.role);

  const hasAllowedPlatformRole =
    !allowedPlatformRoles ||
    allowedPlatformRoles.includes(
      profile.platform_role,
    );

  if (allowedRoles && allowedPlatformRoles) {
    if (!hasAllowedRole && !hasAllowedPlatformRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  } else {
    if (!hasAllowedRole || !hasAllowedPlatformRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
