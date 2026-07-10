import {
  BarChart3,
  CalendarCheck,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  onLogout,
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
}: SidebarProps) {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'academic',
      label: 'Acadêmico',
      icon: GraduationCap,
    },
    {
      id: 'attendance',
      label: 'Frequência',
      icon: CalendarCheck,
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: BarChart3,
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: Settings,
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-[#dfe3e8] bg-white py-6 transition-transform duration-300 lg:translate-x-0 ${
          isOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
        id="app-sidebar"
      >
        <div className="mb-8 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#005bbf] text-lg font-bold text-white shadow-2xs">
              E
            </div>

            <div>
              <h1 className="text-lg font-bold leading-none text-[#005bbf]">
                EduManager Pro
              </h1>

              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#414754]">
                Admin Acadêmica
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-full p-1.5 text-[#727785] transition-colors hover:bg-[#f1f4fa] lg:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all duration-200 ${
                  isActive
                    ? 'border-r-4 border-[#005bbf] bg-[#1a73e8]/10 font-bold text-[#005bbf]'
                    : 'text-[#414754] hover:bg-[#f1f4fa] hover:text-[#181c20]'
                }`}
                id={`sidebar-tab-${item.id}`}
              >
                <IconComponent
                  className={`h-5 w-5 ${
                    isActive
                      ? 'text-[#005bbf]'
                      : 'text-[#727785]'
                  }`}
                />

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-[#dfe3e8] px-4 pt-4">
          <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-[#727785]">
            Suporte
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href =
                'mailto:suporte@edumanagerpro.com.br';
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2 text-xs text-[#414754] transition-colors hover:bg-[#f1f4fa] hover:text-[#181c20]"
          >
            <HelpCircle className="h-4 w-4 text-[#727785]" />
            <span>Central de Ajuda</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2 text-xs text-[#ba1a1a] transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 text-[#ba1a1a]" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>
    </>
  );
}