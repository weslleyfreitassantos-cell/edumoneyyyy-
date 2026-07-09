import React, { useState } from 'react';
import { Search, Bell, MessageSquare, Settings, Menu, Check } from 'lucide-react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  currentUser: User;
  onOpenSidebar: () => void;
  onNotificationClick?: () => void;
  searchPlaceholder?: string;
  notificationsCount?: number;
}

export default function Header({
  currentUser,
  onOpenSidebar,
  onNotificationClick,
  searchPlaceholder = 'Pesquisar dados, alunos ou turmas...',
  notificationsCount = 3,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Aviso: Feriado Antecipado nesta sexta-feira.', time: '10:30', unread: true },
    { id: 2, text: 'Nova tarefa de física publicada por Prof. Ricardo.', time: '08:15', unread: true },
    { id: 3, text: 'O boletim do 1º bimestre está consolidado e disponível.', time: 'Ontem', unread: false },
  ]);

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="h-16 px-6 sticky top-0 z-40 bg-white border-b border-[#dfe3e8] flex justify-between items-center" id="app-header">
      {/* Search Input & Mobile Burger */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          className="lg:hidden p-2 hover:bg-[#f1f4fa] rounded-full text-[#414754]"
          onClick={onOpenSidebar}
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-md hidden md:block" id="search-input-container">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727785]">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text"
            placeholder={searchPlaceholder}
            className="w-full bg-[#f1f4fa] border-none rounded-full py-2 pl-10 pr-4 text-sm text-[#181c20] focus:ring-2 focus:ring-[#005bbf] transition-all outline-none font-medium placeholder:text-[#727785]/70"
          />
        </div>
      </div>

      {/* Quick Actions & Profile */}
      <div className="flex items-center gap-2">
        {/* Alerts & Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="hover:bg-[#f1f4fa] rounded-full p-2.5 transition-all relative cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5 text-[#414754]" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full border border-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <>
                {/* Backdrop to close click */}
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-[#dfe3e8] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-3.5 border-b border-[#dfe3e8] flex justify-between items-center bg-[#f1f4fa]">
                    <span className="text-xs font-bold text-[#181c20] uppercase tracking-wider">Notificações</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-[#005bbf] font-bold hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Marcar como lidas
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-[#dfe3e8] max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-3 text-xs transition-colors hover:bg-[#f1f4fa] ${
                          n.unread ? 'bg-[#1a73e8]/5 font-semibold' : 'text-[#414754]'
                        }`}
                      >
                        <p className="text-[#181c20] leading-snug">{n.text}</p>
                        <span className="text-[10px] text-[#727785] mt-1 block">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Messaging */}
        <button 
          onClick={() => alert('Mensagens: Nenhuma conversa não lida no momento.')}
          className="hover:bg-[#f1f4fa] rounded-full p-2.5 transition-all cursor-pointer"
          aria-label="View chat messages"
        >
          <MessageSquare className="w-5 h-5 text-[#414754]" />
        </button>

        {/* Global Settings Shortcut */}
        <button 
          onClick={() => alert('Opções Globais de Sistema.')}
          className="hover:bg-[#f1f4fa] rounded-full p-2.5 transition-all cursor-pointer"
          aria-label="System settings"
        >
          <Settings className="w-5 h-5 text-[#414754]" />
        </button>

        {/* Divider */}
        <div className="h-8 w-[1px] bg-[#c1c6d6] mx-2 hidden sm:block" />

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2" id="header-user-profile">
          <div className="text-right hidden sm:block leading-tight">
            <p className="text-xs font-bold text-[#181c20]">{currentUser.name}</p>
            <p className="text-[10px] text-[#414754] font-medium">{currentUser.subtitle}</p>
          </div>
          <img 
            className="w-10 h-10 rounded-full border-2 border-[#1a73e8]/30 object-cover" 
            alt={currentUser.name} 
            src={currentUser.avatar}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}
