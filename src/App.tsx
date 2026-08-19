import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import {
  AuthProvider,
  useAuth,
} from './contexts/AuthContext';

import {
  InstitutionProvider,
  useInstitution,
} from './contexts/InstitutionContext';

import { ThemeProvider } from './contexts/ThemeContext';

import AppShell from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

import {
  mapDatabaseRole,
  mapPlatformRole,
} from './lib/roles';
import { hasEffectivePermission } from './lib/permissions';

import type { UserRole } from './types';

const Login = lazy(() =>
  import('./pages/Login').then((module) => ({
    default: module.Login,
  })),
);

const SetPassword = lazy(
  () => import('./pages/SetPassword'),
);

const ForgotPassword = lazy(
  () => import('./pages/ForgotPassword'),
);

const ResetPassword = lazy(
  () => import('./pages/ResetPassword'),
);

const AuthConfirm = lazy(
  () => import('./pages/AuthConfirm'),
);

const Unauthorized = lazy(() =>
  import('./pages/Unauthorized').then(
    (module) => ({
      default: module.Unauthorized,
    }),
  ),
);

const AdminPage = lazy(
  () => import('./pages/Admin/AdminPage'),
);

const PlatformPage = lazy(
  () => import('./pages/Platform/PlatformPage'),
);

const AccountPage = lazy(
  () => import('./pages/Account/AccountPage'),
);

const TeacherDashboard = lazy(
  () =>
    import(
      './components/TeacherDashboard'
    ),
);

const StudentDashboard = lazy(
  () =>
    import(
      './components/StudentDashboard'
    ),
);

const DirectorDashboard = lazy(
  () =>
    import(
      './components/DirectorDashboard'
    ),
);

const ParentDashboard = lazy(
  () =>
    import(
      './components/ParentDashboard'
    ),
);

const DirectorLoginBrandingPage = lazy(
  () =>
    import(
      './pages/DirectorLoginBrandingPage'
    ).then((module) => ({
      default: module.DirectorLoginBrandingPage,
    })),
);

const CamerasPage = lazy(
  () => import('./pages/Cameras/CamerasPage'),
);

const EmailTab = lazy(
  () => import('./pages/Admin/tabs/EmailTab'),
);

const TerminalsPage = lazy(
  () => import('./pages/Terminals/TerminalsPage'),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  declare props: Readonly<{ children: ReactNode }>;

  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      'Erro de renderizacao da aplicacao:',
      error,
      errorInfo,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
          <section className="w-full max-w-md rounded-xl border border-[#dfe3e8] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-[#181c20]">
              Nao foi possivel renderizar a pagina
            </h1>

            <p className="mt-3 text-sm text-[#727785]">
              Atualize a pagina. Se persistir, abra em uma janela anonima sem
              extensoes do navegador.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8] focus:outline-none focus:ring-2 focus:ring-[#005bbf] focus:ring-offset-2"
            >
              Atualizar pagina
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function PageLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div
        role="status"
        className="text-center"
      >
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dfe3e8] border-t-[#005bbf]"
          aria-hidden="true"
        />

        <p className="mt-4 text-sm font-medium text-[#727785]">
          Carregando...
        </p>
      </div>
    </main>
  );
}

function AuthenticatedPageLoading() {
  return (
    <main
      id="app-main-content"
      className="min-w-0 flex-1 bg-[#f3f6fb] p-4 sm:p-6 dark:bg-slate-950"
    >
      <div
        role="status"
        className="grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      >
        Carregando conteúdo...
      </div>
    </main>
  );
}

function AuthenticatedRouteContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<AuthenticatedPageLoading />}>
      {children}
    </Suspense>
  );
}

function renderDashboard(
  role: UserRole,
): ReactNode {
  switch (role) {
    case 'super_admin':
      return <PlatformPage />;

    case 'admin':
      return <AccountPage />;

    case 'director':
    case 'secretary':
      return <DirectorDashboard />;

    case 'teacher':
      return <TeacherDashboard />;

    case 'student':
      return <StudentDashboard />;

    case 'parent':
      return <ParentDashboard />;

    default: {
      const exhaustiveRole: never =
        role;

      return exhaustiveRole;
    }
  }
}

function InvalidRolePage({
  onLogout,
}: {
  onLogout: () => Promise<void>;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-xl border border-[#dfe3e8] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-[#181c20]">
          Papel de usuário inválido
        </h1>

        <p className="mt-3 text-sm text-[#727785]">
          Sua conta não possui um papel
          acadêmico reconhecido. Entre em
          contato com a administração.
        </p>

        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-6 rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8] focus:outline-none focus:ring-2 focus:ring-[#005bbf] focus:ring-offset-2"
        >
          Sair
        </button>
      </section>
    </main>
  );
}

function DashboardContent() {
  const { profile, signOut } = useAuth();

  if (!profile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const currentRole =
    mapPlatformRole(profile.platform_role) ??
    mapDatabaseRole(profile.role);

  if (!currentRole) {
    return (
      <InvalidRolePage
        onLogout={signOut}
      />
    );
  }

  if (
    currentRole === 'director' ||
    currentRole === 'secretary'
  ) {
    return (
      <Navigate
        to="/admin?module=overview"
        replace
      />
    );
  }

  return <>{renderDashboard(currentRole)}</>;
}

export function DirectorLoginBrandingRoute() {
  const { currentRole, isLoading } = useInstitution();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p>Carregando...</p>
      </main>
    );
  }

  if (currentRole !== 'DIRECTOR') {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  return <DirectorLoginBrandingPage />;
}

function DirectorCamerasRoute() {
  const { profile } = useAuth();
  const { currentRole, isLoading } = useInstitution();

  if (isLoading) {
    return <PageLoading />;
  }

  if (currentRole !== 'DIRECTOR' && profile?.role !== 'DIRECTOR') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <CamerasPage />;
}

function InstitutionEmailRoute() {
  const { profile } = useAuth();
  const { currentRole, isLoading } = useInstitution();

  if (isLoading) {
    return <PageLoading />;
  }

  if (
    !profile ||
    !hasEffectivePermission({
      platformRole: profile.platform_role,
      membershipRole: currentRole,
      profileRole: profile.role,
      permission: 'send_school_email',
    })
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <EmailTab />;
}

function InstitutionTerminalsRoute() {
  const { profile } = useAuth();
  const { currentRole, isLoading } = useInstitution();

  if (isLoading) {
    return <PageLoading />;
  }

  if (
    !profile ||
    !hasEffectivePermission({
      platformRole: profile.platform_role,
      membershipRole: currentRole,
      profileRole: profile.role,
      permission: 'view_school_dashboard',
    })
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <TerminalsPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/auth/confirm"
        element={<AuthConfirm />}
      />

      <Route
        path="/auth/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/set-password"
        element={<SetPassword />}
      />

      <Route
        path="/unauthorized"
        element={<Unauthorized />}
      />

      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuthenticatedRouteContent>
                <DashboardContent />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/personalizar-login"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuthenticatedRouteContent>
                <DirectorLoginBrandingRoute />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cameras"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuthenticatedRouteContent>
                <DirectorCamerasRoute />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/email"
        element={
          <ProtectedRoute
            allowedRoles={['DIRECTOR', 'SECRETARY']}
          >
            <AppShell>
              <AuthenticatedRouteContent>
                <InstitutionEmailRoute />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/terminais"
        element={
          <ProtectedRoute
            allowedRoles={[
              'DIRECTOR',
              'SECRETARY',
            ]}
            allowedPlatformRoles={['SUPER_ADMIN']}
          >
            <AppShell>
              <AuthenticatedRouteContent>
                <InstitutionTerminalsRoute />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute
            allowedRoles={[
              'ADMIN',
              'DIRECTOR',
              'SECRETARY',
            ]}
            allowedPlatformRoles={['SUPER_ADMIN']}
          >
            <AppShell>
              <AuthenticatedRouteContent>
                <AdminPage />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/configurar-escola/*"
        element={<Navigate to="/admin?module=overview" replace />}
      />

      <Route
        path="/platform/*"
        element={
          <ProtectedRoute
            allowedPlatformRoles={[
              'SUPER_ADMIN',
            ]}
          >
            <AppShell>
              <AuthenticatedRouteContent>
                <PlatformPage />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/account/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <AuthenticatedRouteContent>
                <AccountPage />
              </AuthenticatedRouteContent>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider
        client={queryClient}
      >
        <BrowserRouter>
          <AuthProvider>
            <InstitutionProvider>
              <ThemeProvider>
                <Suspense
                  fallback={<PageLoading />}
                >
                  <AppRoutes />
                </Suspense>
              </ThemeProvider>
            </InstitutionProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
