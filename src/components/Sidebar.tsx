import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  GraduationCap, 
  CalendarCheck, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut, 
  X, 
  UserCircle,
  Users,
  UserCog,
  UserCheck
} from 'lucide-react';
import { UserRole, User } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  currentUser: User;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  currentRole,
  currentUser,
  onRoleChange,
  onLogout,
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
}: SidebarProps) {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'academic', label: 'Acadêmico', icon: GraduationCap },
    { id: 'attendance', label: 'Frequência', icon: CalendarCheck },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  // ✅ ADICIONADO 'admin' AO roleLabels
  const roleLabels: Record<UserRole, { label: string; icon: any; color: string }> = {
    admin: { label: 'Administrador', icon: UserCog, color: 'text-blue-600 bg-blue-50' },
    teacher: { label: 'Professor', icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
    student: { label: 'Aluno', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
    director: { label: 'Diretor', icon: UserCog, color: 'text-amber-600 bg-amber-50' },
    parent: { label: 'Responsável', icon: UserCheck, color: 'text-purple-600 bg-purple-50' },
  };

  // Fallback para caso currentRole não esteja no roleLabels (ex: undefined)
  const currentRoleInfo = roleLabels[currentRole] || roleLabels.student;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-[#dfe3e8] py-6 z-50 flex flex-col transition-transform duration-300 transform lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-y-0 -translate-x-full lg:translate-x-0'
        }`}
        id="app-sidebar"
      >
        {/* Header Logo */}
        <div className="px-6 mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#005bbf] flex items-center justify-center text-white font-bold text-lg shadow-2xs">
                E
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#005bbf] leading-none">EduManager Pro</h1>
                <p className="text-[10px] text-[#414754] uppercase tracking-wider font-semibold mt-0.5">Admin Acadêmica</p>
              </div>
            </div>
          </div>
          {/* Close mobile menu */}
          <button 
            className="lg:hidden p-1.5 hover:bg-[#f1f4fa] rounded-full text-[#727785] transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menus */}
        <nav className="flex-1 space-y-1 px-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose(); // Close mobile sidebar on select
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'text-[#005bbf] font-bold border-r-4 border-[#005bbf] bg-[#1a73e8]/10' 
                    : 'text-[#414754] hover:text-[#181c20] hover:bg-[#f1f4fa]'
                }`}
                id={`sidebar-tab-${item.id}`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? 'text-[#005bbf]' : 'text-[#727785]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Role Quick Toggle - com admin incluído */}
        <div className="px-4 mb-4" id="role-quick-switcher">
          <div className="p-3.5 bg-[#f1f4fa] border border-[#dfe3e8] rounded-xl">
            <p className="text-[10px] font-bold text-[#727785] uppercase tracking-widest mb-2">Alternar Perfil Demo</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(['admin', 'teacher', 'student', 'director', 'parent'] as UserRole[]).map((role) => {
                const info = roleLabels[role];
                const RoleIcon = info?.icon || UserCircle;
                const isSelected = currentRole === role;
                return (
                  <button
                    key={role}
                    title={`Mudar para ${info?.label || role}`}
                    onClick={() => {
                      onRoleChange(role);
                      onClose();
                    }}
                    className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-[#005bbf] text-white shadow-xs' 
                        : 'bg-white hover:bg-[#dfe3e8] text-[#727785] border border-[#c1c6d6]'
                    }`}
                  >
                    <RoleIcon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-[#414754] font-medium justify-center">
              <span>Modo atual:</span>
              <span className="font-bold underline text-[#005bbf]">{currentRoleInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Footer Support / Logout */}
        <div className="px-4 mt-auto pt-4 border-t border-[#dfe3e8] space-y-1">
          <p className="px-4 text-[10px] font-bold text-[#727785] mb-2 uppercase tracking-widest">Suporte</p>
          
          <button 
            onClick={() => {
              alert('Central de Ajuda: O suporte acadêmico está online pelo e-mail suporte@edumanagerpro.com.br.');
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-[#414754] hover:text-[#181c20] hover:bg-[#f1f4fa] rounded-lg text-xs transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-[#727785]" />
            <span>Central de Ajuda</span>
          </button>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-[#ba1a1a] hover:bg-red-50 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-[#ba1a1a]" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>
    </>
  );
}