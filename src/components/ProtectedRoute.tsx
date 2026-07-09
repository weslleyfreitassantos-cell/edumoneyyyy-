import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import type { DatabaseRole } from '../lib/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: DatabaseRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
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

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}