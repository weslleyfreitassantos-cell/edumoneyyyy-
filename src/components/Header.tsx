import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import InstitutionSwitcher from './InstitutionSwitcher';
import type { User } from '../types';

interface HeaderProps {
  currentUser: User;
  pageTitle: string;
  pageSection: string;
  showInstitutionSwitcher: boolean;
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isLoggingOut: boolean;
  mobileSidebarId: string;
  onOpenMobileSidebar: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  mobileMenuButtonRef?: RefObject<HTMLButtonElement | null>;
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
  pageTitle,
  pageSection,
  showInstitutionSwitcher,
  isSidebarCollapsed,
  isMobileSidebarOpen,
  isLoggingOut,
  mobileSidebarId,
  onOpenMobileSidebar,
  onToggleSidebar,
  onLogout,
  mobileMenuButtonRef,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] =
    useState(false);
  const [avatarFailed, setAvatarFailed] =
    useState(false);
  const userMenuRef =
    useRef<HTMLDivElement | null>(null);

  const avatarUrl =
    currentUser.avatar?.trim() || null;
  const userInitials =
    getUserInitials(currentUser.name);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        userMenuRef.current &&
        event.target instanceof Node &&
        !userMenuRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(
      'pointerdown',
      handlePointerDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
      window.removeEventListener(
        'pointerdown',
        handlePointerDown,
      );
    };
  }, [isUserMenuOpen]);

  function handleLogout(): void {
    setIsUserMenuOpen(false);
    onLogout();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d8deea] bg-white/95 shadow-sm backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-5 lg:px-6">
        <button
          ref={mobileMenuButtonRef}
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#414754] outline-none transition-colors hover:bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] lg:hidden"
          onClick={onOpenMobileSidebar}
          aria-label="Abrir menu de navegação"
          aria-expanded={isMobileSidebarOpen}
          aria-controls={mobileSidebarId}
        >
          <Menu
            className="h-5 w-5"
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#414754] outline-none transition-colors hover:bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? 'Expandir sidebar'
              : 'Recolher sidebar'
          }
          aria-expanded={!isSidebarCollapsed}
          aria-controls={mobileSidebarId}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          ) : (
            <PanelLeftClose
              className="h-5 w-5"
              aria-hidden="true"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">
            {pageSection}
          </p>
          <h1 className="truncate text-lg font-extrabold leading-tight text-[#181c20] sm:text-xl">
            {pageTitle}
          </h1>
        </div>

        {showInstitutionSwitcher && (
          <div className="hidden min-w-0 max-w-[22rem] md:block">
            <InstitutionSwitcher />
          </div>
        )}

        <div
          ref={userMenuRef}
          className="relative"
        >
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 outline-none transition-colors hover:border-[#d8deea] hover:bg-[#f8faff] focus-visible:ring-2 focus-visible:ring-[#005bbf] sm:px-2"
            onClick={() =>
              setIsUserMenuOpen((value) => !value)
            }
            aria-label="Abrir menu do usuário"
            aria-expanded={isUserMenuOpen}
            aria-controls="header-user-menu"
          >
            <span className="hidden min-w-0 text-right leading-tight xl:block">
              <span className="block max-w-44 truncate text-sm font-bold text-[#181c20]">
                {currentUser.name}
              </span>
              <span className="block truncate text-xs text-[#667085]">
                {currentUser.subtitle}
              </span>
            </span>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8eeff] text-sm font-extrabold text-[#061f6f] ring-1 ring-[#cbd6ff]">
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
                <span aria-hidden="true">
                  {userInitials}
                </span>
              )}
            </span>

            <ChevronDown
              className={`hidden h-4 w-4 text-[#667085] transition-transform sm:block ${
                isUserMenuOpen
                  ? 'rotate-180'
                  : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {isUserMenuOpen && (
            <section
              id="header-user-menu"
              className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-[#d8deea] bg-white shadow-xl shadow-slate-950/10"
              aria-label="Menu do usuário"
            >
              <div className="border-b border-[#e4e8f1] bg-[#f8faff] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8eeff] text-sm font-extrabold text-[#061f6f]">
                    {userInitials}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#181c20]">
                      {currentUser.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#667085]">
                      {currentUser.email}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#061f6f] ring-1 ring-[#d8deea]">
                      {currentUser.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#ba1a1a] outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[#ba1a1a] disabled:cursor-wait disabled:opacity-70"
                >
                  <LogOut
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  {isLoggingOut
                    ? 'Saindo...'
                    : 'Sair'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {showInstitutionSwitcher && (
        <div className="border-t border-[#e4e8f1] px-4 py-2 md:hidden">
          <InstitutionSwitcher />
        </div>
      )}
    </header>
  );
}
