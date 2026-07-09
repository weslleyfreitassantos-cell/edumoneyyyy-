import { useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import DirectorDashboard from './components/DirectorDashboard';
import ParentDashboard from './components/ParentDashboard';

import AdminPage from './pages/Admin/AdminPage';

import { mapDatabaseRole } from './lib/roles';
import type { UserRole } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const roleToSubtitle: Record<UserRole, string> = {
  admin: 'Administrador',
  director: 'Diretor',
  teacher: 'Professor',
  student: 'Aluno',
  parent: 'Responsável',
};

const searchPlaceholders: Record<UserRole, string> = {
  admin: 'Pesquisar dados, alunos ou professores...',
  director: 'Pesquisar dados, alunos ou professores...',
  teacher: 'Pesquisar alunos ou turmas...',
  student: 'Pesquisar disciplinas ou notas...',
  parent: 'Pesquisar aluno, nota ou evento...',
};

function renderDashboard(role: UserRole) {
  switch (role) {
    case 'admin':
    case 'director':
      return <DirectorDashboard />;

    case 'teacher':
      return <TeacherDashboard />;

    case 'student':
      return <StudentDashboard />;

    case 'parent':
      return <ParentDashboard />;
  }
}

function DashboardLayout() {
  const { profile, signOut } = useAuth();

  const [activeTab, setActiveTab] =
    useState<string>('dashboard');

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState<boolean>(false);

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = mapDatabaseRole(profile.role);

  if (!currentRole) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="max-w-md text-center">
          <h1 className="text-xl font-bold text-[#181c20]">
            Papel de usuário inválido
          </h1>

          <p className="mt-3 text-sm text-[#727785]">
            Sua conta não possui um papel acadêmico reconhecido.
            Entre em contato com a administração.
          </p>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8]"
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

  const currentUser = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar: profile.avatar_url ?? '',
    role: currentRole,
    subtitle: roleToSubtitle[currentRole],
  };

  return (
    <div
      className="flex min-h-screen bg-slate-50"
      id="app-authenticated-container"
    >
      <Sidebar
        onLogout={() => void signOut()}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <Header
          currentUser={currentUser}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          searchPlaceholder={searchPlaceholders[currentRole]}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key={`dashboard-${currentRole}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                {renderDashboard(currentRole)}
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4 rounded-xl border border-[#dfe3e8] bg-white p-8 text-center shadow-2xs"
              >
                <div className="mx-auto max-w-md py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a73e8]/10 text-[#005bbf]">
                    <span
                      className="text-2xl font-bold"
                      aria-hidden="true"
                    >
                      🛠
                    </span>
                  </div>

                  <h2 className="text-xl font-bold capitalize text-[#181c20]">
                    Módulo {activeTab}
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-[#727785]">
                    Este módulo ainda está em desenvolvimento e será
                    conectado aos serviços acadêmicos nas próximas
                    etapas.
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-6 cursor-pointer rounded-lg bg-[#005bbf] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1a73e8]"
                  >
                    Voltar para o dashboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

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
                  allowedRoles={['ADMIN', 'DIRECTOR']}
                >
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;