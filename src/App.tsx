import {
  lazy,
  Suspense,
  useState,
  type ReactNode,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AnimatePresence,
  motion,
} from 'motion/react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import {
  AuthProvider,
  useAuth,
} from './contexts/AuthContext';

import { InstitutionProvider } from './contexts/InstitutionContext';

import { ProtectedRoute } from './components/ProtectedRoute';

import Sidebar from './components/Sidebar';
import Header from './components/Header';

import {
  mapDatabaseRole,
  mapPlatformRole,
} from './lib/roles';

import type {
  User,
  UserRole,
} from './types';

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

const roleToSubtitle: Record<
  UserRole,
  string
> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  director: 'Diretor',
  secretary: 'Secretaria',
  teacher: 'Professor',
  student: 'Aluno',
  parent: 'Responsável',
};

const searchPlaceholders: Record<
  UserRole,
  string
> = {
  super_admin:
    'Pesquisar contas ou instituições...',
  admin:
    'Pesquisar conta ou instituições...',
  director:
    'Pesquisar dados, alunos ou professores...',
  secretary:
    'Pesquisar alunos, responsáveis ou matrículas...',
  teacher:
    'Pesquisar alunos ou turmas...',
  student:
    'Pesquisar disciplinas ou notas...',
  parent:
    'Pesquisar aluno, nota ou evento...',
};

function PageLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="text-center">
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
          className="mt-6 rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8]"
        >
          Sair
        </button>
      </section>
    </main>
  );
}

function ModulePlaceholder({
  moduleName,
  onReturn,
}: {
  moduleName: string;
  onReturn: () => void;
}) {
  return (
    <motion.div
      key={moduleName}
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
      }}
      className="space-y-4 rounded-xl border border-[#dfe3e8] bg-white p-8 text-center shadow-2xs"
    >
      <div className="mx-auto max-w-md py-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a73e8]/10 text-[#005bbf]">
          <span
            className="text-2xl font-bold"
            aria-hidden="true"
          >
            🛠️
          </span>
        </div>

        <h2 className="text-xl font-bold capitalize text-[#181c20]">
          Módulo {moduleName}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-[#727785]">
          Este módulo ainda está em
          desenvolvimento e será conectado
          aos serviços acadêmicos nas
          próximas etapas.
        </p>

        <button
          type="button"
          onClick={onReturn}
          className="mt-6 rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8]"
        >
          Voltar para o dashboard
        </button>
      </div>
    </motion.div>
  );
}

function DashboardLayout() {
  const { profile, signOut } =
    useAuth();

  const [activeTab, setActiveTab] =
    useState('dashboard');

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

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

  const currentUser: User = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar:
      profile.avatar_url?.trim() ||
      null,
    role: currentRole,
    subtitle:
      roleToSubtitle[currentRole],
  };

  const canAccessSettings =
    currentRole === 'admin' ||
    currentRole === 'director' ||
    currentRole === 'secretary';

  async function handleLogout(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      console.error(
        'Erro ao sair da aplicação:',
        error,
      );
    }
  }

  return (
    <div
      className="flex min-h-screen bg-slate-50"
      id="app-authenticated-container"
    >
      <Sidebar
        onLogout={() =>
          void handleLogout()
        }
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileSidebarOpen}
        onClose={() =>
          setMobileSidebarOpen(false)
        }
      />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <Header
          currentUser={currentUser}
          onOpenSidebar={() =>
            setMobileSidebarOpen(true)
          }
          searchPlaceholder={
            searchPlaceholders[
              currentRole
            ]
          }
          onMessagesClick={() =>
            setActiveTab('mensagens')
          }
          onSettingsClick={
            canAccessSettings
              ? () =>
                  setActiveTab(
                    'configurações',
                  )
              : undefined
          }
        />

        <main className="mx-auto w-full max-w-7xl flex-1 p-6">
          <AnimatePresence mode="wait">
            {activeTab ===
            'dashboard' ? (
              <motion.div
                key={`dashboard-${currentRole}`}
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -15,
                }}
                transition={{
                  duration: 0.25,
                }}
              >
                {renderDashboard(
                  currentRole,
                )}
              </motion.div>
            ) : (
              <ModulePlaceholder
                moduleName={activeTab}
                onReturn={() =>
                  setActiveTab(
                    'dashboard',
                  )
                }
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
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
            <DashboardLayout />
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
          >
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/platform/*"
        element={
          <ProtectedRoute
            allowedPlatformRoles={[
              'SUPER_ADMIN',
            ]}
          >
            <PlatformPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/account/*"
        element={
          <ProtectedRoute>
            <AccountPage />
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
    <QueryClientProvider
      client={queryClient}
    >
      <BrowserRouter>
        <AuthProvider>
          <InstitutionProvider>
            <Suspense
              fallback={<PageLoading />}
            >
              <AppRoutes />
            </Suspense>
          </InstitutionProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
