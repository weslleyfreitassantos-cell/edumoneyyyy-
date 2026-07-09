/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import DirectorDashboard from './components/DirectorDashboard';
import ParentDashboard from './components/ParentDashboard';
import { UserRole, User } from './types';
import { USERS } from './data';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const handleLogin = (role: UserRole) => {
    setCurrentRole(role);
    setIsAuthenticated(true);
    setActiveTab('dashboard'); // reset tab on login
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    setActiveTab('dashboard');
  };

  const currentUser = USERS[currentRole] || USERS.student;

  // Search input placeholders matching each screenshot's language
  const searchPlaceholders: Record<UserRole, string> = {
    teacher: 'Pesquisar por alunos ou turmas...',
    student: 'Pesquisar disciplinas ou notas...',
    director: 'Pesquisar dados, alunos ou professores...',
    parent: 'Buscar aluno, nota ou evento...',
  };

  const renderActiveDashboard = () => {
    switch (currentRole) {
      case 'teacher':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      case 'director':
        return <DirectorDashboard />;
      case 'parent':
        return <ParentDashboard />;
      default:
        return <StudentDashboard />;
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" id="app-authenticated-container">
      {/* Sidebar */}
      <Sidebar 
        currentRole={currentRole}
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <Header 
          currentUser={currentUser}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          searchPlaceholder={searchPlaceholders[currentRole]}
        />

        {/* Dynamic Main Workspace with Motion Transitions */}
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
                id="tab-placeholder-view"
              >
                <div className="max-w-md mx-auto py-12">
                  <div className="w-16 h-16 bg-[#1a73e8]/10 rounded-full flex items-center justify-center text-[#005bbf] mx-auto mb-4">
                    <span className="text-2xl font-bold">🛠</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#181c20] capitalize">Módulo {activeTab}</h3>
                  <p className="text-sm text-[#727785] mt-2 leading-relaxed">
                    Esta aba faz parte das rotas avançadas de simulação e está sendo projetada para interações completas de banco de dados e APIs. 
                    Por favor, utilize o painel <strong>Dashboard</strong> para interagir com as telas reais solicitadas nas imagens de demonstração.
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
