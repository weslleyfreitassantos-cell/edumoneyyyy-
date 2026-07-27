import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import {
  useAuth,
  useAuthProfileActions,
} from '../contexts/AuthContext';
import {
  useInstitution,
} from '../contexts/InstitutionContext';
import {
  mapDatabaseRole,
  mapPlatformRole,
} from '../lib/roles';
import type {
  User,
  UserRole,
} from '../types';
import { useThemePreference } from '../contexts/ThemeContext';
import { useHostBranding } from '../hooks/useBranding';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export interface RouteVisualContext {
  section: string;
  title: string;
}

const sidebarPreferenceKey =
  'edumanager.sidebarCollapsed';
const mobileSidebarTitleId =
  'app-sidebar-title';
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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

function readSidebarPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(
        sidebarPreferenceKey,
      ) === 'true'
    );
  } catch {
    return false;
  }
}

function writeSidebarPreference(
  value: boolean,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      sidebarPreferenceKey,
      String(value),
    );
  } catch {
    // A preferência local é opcional; falhas do navegador não devem afetar o shell.
  }
}

function getFocusableElements(
  container: HTMLElement,
): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      focusableSelector,
    ),
  ).filter((element) => {
    const style = window.getComputedStyle(element);

    return (
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !==
        'true' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  });
}

export function getRouteVisualContext(
  pathname: string,
  role: UserRole,
): RouteVisualContext {
  const normalizedPath =
    pathname.replace(/\/+$/, '') || '/';

  if (normalizedPath.startsWith('/platform')) {
    return {
      section: 'Plataforma',
      title: 'Instituições',
    };
  }

  if (normalizedPath.startsWith('/account')) {
    return {
      section: 'Conta',
      title: 'Instituições da conta',
    };
  }

  if (normalizedPath.startsWith('/admin')) {
    return {
      section: 'Administração',
      title: 'Gestão institucional',
    };
  }

  if (normalizedPath.startsWith('/dashboard')) {
    if (role === 'super_admin') {
      return {
        section: 'Plataforma',
        title: 'Instituições',
      };
    }

    if (role === 'admin') {
      return {
        section: 'Conta',
        title: 'Instituições da conta',
      };
    }

    if (
      role === 'director' ||
      role === 'secretary'
    ) {
      return {
        section: 'Administração',
        title: 'Painel institucional',
      };
    }

    if (role === 'teacher') {
      return {
        section: 'Acadêmico',
        title: 'Painel do professor',
      };
    }

    if (role === 'student') {
      return {
        section: 'Acadêmico',
        title: 'Painel do aluno',
      };
    }

    if (role === 'parent') {
      return {
        section: 'Família',
        title: 'Dependentes e boletins',
      };
    }
  }

  return {
    section: 'EduManager Pro',
    title: 'Dashboard',
  };
}

export default function AppShell({
  children,
}: AppShellProps) {
  const { profile, signOut } = useAuth();
  const { updateProfileName, updatePassword } =
    useAuthProfileActions();
  const institutionContext = useInstitution();
  const location = useLocation();
  const { theme, toggleTheme } = useThemePreference();
  const branding = useHostBranding();

  const [isSidebarHidden, setIsSidebarHidden] =
    useState(readSidebarPreference);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState(false);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const mobileMenuButtonRef =
    useRef<HTMLButtonElement | null>(null);
  const mobileCloseButtonRef =
    useRef<HTMLButtonElement | null>(null);
  const mobileSidebarRef =
    useRef<HTMLElement | null>(null);
  const authenticatedContentRef =
    useRef<HTMLDivElement | null>(null);
  const focusReturnRef =
    useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    writeSidebarPreference(isSidebarHidden);
  }, [isSidebarHidden]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const contentElement =
      authenticatedContentRef.current;

    if (!contentElement) {
      return;
    }

    const previousInert =
      Boolean(contentElement.inert);
    contentElement.inert = true;

    return () => {
      contentElement.inert = previousInert;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const sidebarElement =
      mobileSidebarRef.current;

    if (!sidebarElement) {
      return;
    }

    const focusableElements =
      getFocusableElements(sidebarElement);
    const initialFocusTarget =
      mobileCloseButtonRef.current ??
      focusableElements[0] ??
      sidebarElement;

    initialFocusTarget.focus();

    function handleDrawerKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileSidebar();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentSidebar =
        mobileSidebarRef.current;

      if (!currentSidebar) {
        return;
      }

      const currentFocusableElements =
        getFocusableElements(currentSidebar);

      if (
        currentFocusableElements.length === 0
      ) {
        event.preventDefault();
        currentSidebar.focus();
        return;
      }

      const firstElement =
        currentFocusableElements[0];
      const lastElement =
        currentFocusableElements[
          currentFocusableElements.length - 1
        ];
      const activeElement =
        document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement ||
          !currentSidebar.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (
        !event.shiftKey &&
        !currentSidebar.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (
        !event.shiftKey &&
        activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener(
      'keydown',
      handleDrawerKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleDrawerKeyDown,
      );
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (
      isMobileSidebarOpen ||
      !shouldRestoreFocusRef.current
    ) {
      return;
    }

    shouldRestoreFocusRef.current = false;

    const focusTarget =
      focusReturnRef.current ??
      mobileMenuButtonRef.current;

    if (
      focusTarget &&
      document.contains(focusTarget)
    ) {
      focusTarget.focus();
      return;
    }

    mobileMenuButtonRef.current?.focus();
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (isMobileSidebarOpen) {
      closeMobileSidebar();
    }
  }, [location.pathname]);

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
      <div
        role="alert"
        className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"
      >
        <section className="w-full max-w-md rounded-2xl border border-[#d8deea] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#181c20]">
            Papel de usuário inválido
          </h1>
          <p className="mt-3 text-sm text-[#667085]">
            Sua conta não possui um papel reconhecido.
          </p>
        </section>
      </div>
    );
  }

  const currentUser: User = {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar:
      profile.avatar_url?.trim() || null,
    role: currentRole,
    subtitle:
      roleToSubtitle[currentRole],
  };

  const pageContext = getRouteVisualContext(
    location.pathname,
    currentRole,
  );

  const hasAccessibleInstitutions =
    institutionContext.institutions.length > 0;
  const isSuperAdmin =
    profile.platform_role === 'SUPER_ADMIN';
  const isPlatformRoute =
    location.pathname.startsWith('/platform');
  const isAdminRoute =
    location.pathname.startsWith('/admin');
  const showStaticInstitution =
    isSuperAdmin &&
    isAdminRoute &&
    Boolean(institutionContext.currentInstitution);

  const showInstitutionSwitcher =
    !showStaticInstitution &&
    (isSuperAdmin
      ? !isPlatformRoute &&
        !isAdminRoute &&
        hasAccessibleInstitutions
      : true);

  function openMobileSidebar(): void {
    const activeElement =
      document.activeElement;

    focusReturnRef.current =
      activeElement instanceof HTMLElement
        ? activeElement
        : mobileMenuButtonRef.current;
    setIsMobileSidebarOpen(true);
  }

  function closeMobileSidebar(): void {
    shouldRestoreFocusRef.current = true;
    setIsMobileSidebarOpen(false);
  }

  function toggleSidebar(): void {
    setIsSidebarHidden((value) => !value);
  }

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);

    try {
      await signOut();
    } catch (error) {
      console.error(
        'Erro ao sair da aplicação:',
        error,
      );
      setIsLoggingOut(false);
    }
  }

  return (
    <div
      id="app-authenticated-container"
      className="flex min-h-screen bg-[#f3f6fb]"
      style={{
        '--brand-primary': branding.primaryColor,
        '--brand-secondary': branding.secondaryColor,
      } as CSSProperties}
    >
      <a
        href="#app-main-content"
        className="sr-only fixed left-4 top-4 z-[70] rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#005bbf]"
      >
        Pular para o conteúdo
      </a>

      <Sidebar
        currentUser={currentUser}
        profile={profile}
        branding={branding}
        currentInstitutionRole={
          institutionContext.currentRole
        }
        isDesktopHidden={isSidebarHidden}
        isMobileOpen={isMobileSidebarOpen}
        isLoggingOut={isLoggingOut}
        onCloseMobile={closeMobileSidebar}
        onLogout={() => {
          void handleLogout();
        }}
        mobileCloseButtonRef={
          mobileCloseButtonRef
        }
        mobileSidebarRef={mobileSidebarRef}
        mobileTitleId={mobileSidebarTitleId}
      />

      <div
        ref={authenticatedContentRef}
        className="flex min-w-0 flex-1 flex-col"
      >
        <Header
          currentUser={currentUser}
          pageTitle={pageContext.title}
          pageSection={pageContext.section}
          showInstitutionSwitcher={
            showInstitutionSwitcher
          }
          staticInstitutionName={
            showStaticInstitution
              ? institutionContext
                  .currentInstitution?.name
              : null
          }
          isSidebarHidden={isSidebarHidden}
          isMobileSidebarOpen={
            isMobileSidebarOpen
          }
          isLoggingOut={isLoggingOut}
          mobileSidebarId="app-sidebar"
          onOpenMobileSidebar={
            openMobileSidebar
          }
          onToggleSidebar={toggleSidebar}
          onLogout={() => {
            void handleLogout();
          }}
          onUpdateProfileName={updateProfileName}
          onUpdatePassword={updatePassword}
          theme={theme}
          onToggleTheme={toggleTheme}
          mobileMenuButtonRef={
            mobileMenuButtonRef
          }
        />

        <main
          id="app-main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6 xl:px-8"
        >
          <div className="mx-auto w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
