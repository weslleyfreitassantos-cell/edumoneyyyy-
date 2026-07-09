import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Contexto de autenticação
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

// Componentes existentes
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import DirectorDashboard from './components/DirectorDashboard';
import ParentDashboard from './components/ParentDashboard';

// Página de Administração
import AdminPage from './pages/Admin/AdminPage';

// Tipos
import { UserRole } from './types';

// Configuração do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// Mapeamento de role para subtítulo
const roleToSubtitle: Record<string, string> = {
  admin: 'Administrador',
  director: 'Diretor',
  teacher: 'Professor',
  student: 'Aluno',
  parent: 'Responsável',
};

// Placeholders de busca
const searchPlaceholders: Record<UserRole, string> = {
  admin: 'Pesquisar dados, alunos ou professores...',
  teacher: 'Pesquisar por alunos ou turmas...',
  student: 'Pesquisar disciplinas ou notas...',
  director: 'Pesquisar dados, alunos ou professores...',
  parent: 'Buscar aluno, nota ou evento...',
};

// Layout autenticado
function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = profile.role.toLowerCase() as UserRole;

  const currentUser = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar: profile.avatar_url || '',
    role: currentRole,
    subtitle: roleToSubtitle[currentRole] || 'Usuário',
  };

  const renderActiveDashboard = () => {
    if (currentRole === 'admin' || currentRole === 'director') {
      return <DirectorDashboard />;
    }
    switch (currentRole) {
      case 'teacher':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      case 'parent':
        return <ParentDashboard />;
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" id="app-authenticated-container">
      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        onRoleChange={() => {}}
        onLogout={signOut}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <Header
          currentUser={currentUser}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          searchPlaceholder={searchPlaceholders[currentRole] || 'Pesquisar...'}
        />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key={currentRole}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                {renderActiveDashboard()}
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white border border-[#dfe3e8] rounded-xl p-8 shadow-2xs text-center space-y-4"
              >
                <div className="max-w-md mx-auto py-12">
                  <div className="w-16 h-16 bg-[#1a73e8]/10 rounded-full flex items-center justify-center text-[#005bbf] mx-auto mb-4">
                    <span className="text-2xl font-bold">🛠</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#181c20] capitalize">
                    Módulo {activeTab}
                  </h3>
                  <p className="text-sm text-[#727785] mt-2 leading-relaxed">
                    Esta aba faz parte das rotas avançadas de simulação e está sendo projetada para interações completas de banco de dados e APIs.
                  </p>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-6 px-5 py-2 bg-[#005bbf] hover:bg-[#1a73e8] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Voltar para o Dashboard
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

// Componente principal
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
                <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;