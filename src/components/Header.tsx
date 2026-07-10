import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Bell,
  Check,
  Menu,
  MessageSquare,
  Search,
  Settings,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
} from 'motion/react';

import type { User } from '../types';

export interface HeaderNotification {
  id: string;
  text: string;
  time: string;
  unread: boolean;
}

interface HeaderProps {
  currentUser: User;
  onOpenSidebar: () => void;
  searchPlaceholder?: string;

  notifications?: HeaderNotification[];
  onNotificationClick?: () => void;
  onNotificationSelect?: (
    notification: HeaderNotification,
  ) => void;
  onMarkAllNotificationsRead?: () => void;

  onSearchChange?: (searchTerm: string) => void;
  onMessagesClick?: () => void;
  onSettingsClick?: () => void;
}

function getUserInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'U';
}

export default function Header({
  currentUser,
  onOpenSidebar,
  searchPlaceholder = 'Pesquisar dados, alunos ou turmas...',
  notifications = [],
  onNotificationClick,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  onSearchChange,
  onMessagesClick,
  onSettingsClick,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [avatarFailed, setAvatarFailed] =
    useState(false);

  const avatarUrl =
    currentUser.avatar?.trim() || null;

  const userInitials =
    getUserInitials(currentUser.name);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.unread,
      ).length,
    [notifications],
  );

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [showNotifications]);

  function handleToggleNotifications(): void {
    const nextValue = !showNotifications;

    setShowNotifications(nextValue);

    if (nextValue) {
      onNotificationClick?.();
    }
  }

  function handleSearch(
    value: string,
  ): void {
    setSearchTerm(value);
    onSearchChange?.(value);
  }

  function handleNotificationSelection(
    notification: HeaderNotification,
  ): void {
    onNotificationSelect?.(notification);
    setShowNotifications(false);
  }

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#dfe3e8] bg-white px-6"
      id="app-header"
    >
      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          className="rounded-full p-2 text-[#414754] transition-colors hover:bg-[#f1f4fa] lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div
          className="relative hidden w-full max-w-md md:block"
          id="search-input-container"
        >
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727785]">
            <Search className="h-4 w-4" />
          </span>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              handleSearch(event.target.value)
            }
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-full border-none bg-[#f1f4fa] py-2 pl-10 pr-4 text-sm font-medium text-[#181c20] outline-none transition-all placeholder:text-[#727785]/70 focus:ring-2 focus:ring-[#005bbf]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={handleToggleNotifications}
            className="relative cursor-pointer rounded-full p-2.5 transition-all hover:bg-[#f1f4fa]"
            aria-label={
              unreadCount > 0
                ? `Abrir notificações. ${unreadCount} não lidas.`
                : 'Abrir notificações'
            }
            aria-expanded={showNotifications}
            aria-controls="header-notifications-panel"
          >
            <Bell className="h-5 w-5 text-[#414754]" />

            {unreadCount > 0 && (
              <span
                className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-[#ba1a1a]"
                aria-hidden="true"
              />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() =>
                    setShowNotifications(false)
                  }
                  aria-label="Fechar notificações"
                />

                <motion.section
                  id="header-notifications-panel"
                  initial={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-lg"
                  aria-label="Notificações"
                >
                  <header className="flex items-center justify-between border-b border-[#dfe3e8] bg-[#f1f4fa] p-3.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#181c20]">
                      Notificações
                    </span>

                    {unreadCount > 0 &&
                      onMarkAllNotificationsRead && (
                        <button
                          type="button"
                          onClick={
                            onMarkAllNotificationsRead
                          }
                          className="flex items-center gap-1 text-[10px] font-bold text-[#005bbf] hover:underline"
                        >
                          <Check className="h-3 w-3" />

                          Marcar como lidas
                        </button>
                      )}
                  </header>

                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell
                          className="mx-auto h-8 w-8 text-[#c1c6d6]"
                          aria-hidden="true"
                        />

                        <p className="mt-3 text-xs font-semibold text-[#414754]">
                          Nenhuma notificação disponível
                        </p>

                        <p className="mt-1 text-[10px] text-[#727785]">
                          Novos avisos aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#dfe3e8]">
                        {notifications.map(
                          (notification) => (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={() =>
                                handleNotificationSelection(
                                  notification,
                                )
                              }
                              className={`block w-full p-3 text-left text-xs transition-colors hover:bg-[#f1f4fa] ${notification.unread
                                  ? 'bg-[#1a73e8]/5 font-semibold'
                                  : 'text-[#414754]'
                                }`}
                            >
                              <p className="leading-snug text-[#181c20]">
                                {notification.text}
                              </p>

                              <span className="mt-1 block text-[10px] text-[#727785]">
                                {notification.time}
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </motion.section>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={onMessagesClick}
          disabled={!onMessagesClick}
          className="cursor-pointer rounded-full p-2.5 transition-all hover:bg-[#f1f4fa] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label={
            onMessagesClick
              ? 'Abrir mensagens'
              : 'Mensagens ainda não disponíveis'
          }
          title={
            onMessagesClick
              ? 'Mensagens'
              : 'Módulo de mensagens em desenvolvimento'
          }
        >
          <MessageSquare className="h-5 w-5 text-[#414754]" />
        </button>

        <button
          type="button"
          onClick={onSettingsClick}
          disabled={!onSettingsClick}
          className="cursor-pointer rounded-full p-2.5 transition-all hover:bg-[#f1f4fa] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label={
            onSettingsClick
              ? 'Abrir configurações'
              : 'Configurações ainda não disponíveis'
          }
          title={
            onSettingsClick
              ? 'Configurações'
              : 'Módulo de configurações em desenvolvimento'
          }
        >
          <Settings className="h-5 w-5 text-[#414754]" />
        </button>

        <div
          className="mx-2 hidden h-8 w-px bg-[#c1c6d6] sm:block"
          aria-hidden="true"
        />

        <div
          className="flex items-center gap-3 pl-2"
          id="header-user-profile"
        >
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-xs font-bold text-[#181c20]">
              {currentUser.name}
            </p>

            <p className="text-[10px] font-medium text-[#414754]">
              {currentUser.subtitle}
            </p>
          </div>

          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-[#1a73e8]/30 bg-[#005bbf]">
            {avatarUrl && !avatarFailed ? (
              <img
                className="h-full w-full object-cover"
                alt={`Foto de ${currentUser.name}`}
                src={avatarUrl}
                referrerPolicy="no-referrer"
                onError={() =>
                  setAvatarFailed(true)
                }
              />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                aria-label={`Usuário ${currentUser.name}`}
              >
                {userInitials}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}