import type {
  LucideIcon,
} from 'lucide-react';
import {
  Building2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  MonitorCog,
  Palette,
  ShieldCheck,
  Video,
  UserCircle2,
  X,
} from 'lucide-react';
import type {
  RefObject,
} from 'react';
import {
  useEffect,
  useState,
} from 'react';
import {
  Link,
  useLocation,
} from 'react-router-dom';

import type { Profile } from '../contexts/AuthContext';
import type { PublicBranding } from '../services/brandingService';
import {
  ADMIN_MODULES,
  DEFAULT_ADMIN_MODULE_ID,
  groupAdminModules,
  isAdminModuleId,
  type AdminModuleDefinition,
} from '../pages/Admin/adminNavigation';
import type {
  SystemPermission,
} from '../lib/permissions';
import {
  getEffectiveRole,
  hasAnyPermission,
  hasPermission,
} from '../lib/permissions';
import { mapDatabaseRole } from '../lib/roles';
import type { User } from '../types';

type NavigationSection =
  | 'global'
  | 'account'
  | 'school'
  | 'personal';

export interface SidebarNavigationItem {
  id: string;
  label: string;
  path: string;
  section: NavigationSection;
  icon: LucideIcon;
  permissions?: readonly SystemPermission[];
  activePaths?: readonly string[];
  roles?: readonly User['role'][];
}

interface SidebarProps {
  currentUser: User;
  profile: Profile;
  branding: PublicBranding;
  currentInstitutionRole: string | null;
  isDesktopHidden: boolean;
  isMobileOpen: boolean;
  isLoggingOut: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  mobileSidebarRef?: RefObject<HTMLElement | null>;
  mobileCloseButtonRef?: RefObject<HTMLButtonElement | null>;
  mobileTitleId?: string;
}

const sectionLabels: Record<
  NavigationSection,
  string
> = {
  global: 'Plataforma',
  account: 'Conta',
  school: 'Instituição',
  personal: 'Acesso',
};

const hiddenSectionLabels: readonly NavigationSection[] = [
  'global',
  'account',
  'school',
  'personal',
];

const baseNavigationItems: readonly SidebarNavigationItem[] = [
  {
    id: 'platform',
    label: 'Plataforma',
    path: '/platform',
    section: 'global',
    icon: ShieldCheck,
    permissions: ['view_platform_dashboard'],
    roles: ['super_admin'],
    activePaths: ['/platform', '/dashboard'],
  },
  {
    id: 'account',
    label: 'Conta',
    path: '/account',
    section: 'account',
    icon: Building2,
    permissions: ['view_account_dashboard'],
    roles: ['admin'],
    activePaths: ['/account', '/dashboard'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    section: 'personal',
    icon: LayoutDashboard,
    roles: [
      'director',
      'secretary',
      'teacher',
      'student',
      'parent',
    ],
  },
  {
    id: 'personalize-login',
    label: 'Personalizar login',
    path: '/personalizar-login',
    section: 'personal',
    icon: Palette,
    roles: ['director'],
    activePaths: ['/personalizar-login'],
  },
  {
    id: 'cameras',
    label: 'Câmeras ao vivo',
    path: '/cameras',
    section: 'school',
    icon: Video,
    permissions: ['view_live_cameras'],
    roles: ['director'],
    activePaths: ['/cameras'],
  },
  {
    id: 'terminals',
    label: 'TV Escola',
    path: '/terminais',
    section: 'school',
    icon: MonitorCog,
    permissions: ['view_school_dashboard'],
    roles: ['director', 'secretary', 'super_admin'],
    activePaths: ['/terminais'],
  },
  {
    id: 'email',
    label: 'E-mail',
    path: '/email',
    section: 'school',
    icon: Mail,
    permissions: ['send_school_email'],
    activePaths: ['/email'],
  },
];

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'U';
}

function isActivePath(
  pathname: string,
  item: SidebarNavigationItem,
): boolean {
  const activePaths = item.activePaths ?? [
    item.path,
  ];

  return activePaths.some((path) => {
    if (path === '/') {
      return pathname === path;
    }

    return (
      pathname === path ||
      pathname.startsWith(`${path}/`)
    );
  });
}

function getSidebarEffectiveRole({
  profile,
  currentInstitutionRole,
}: {
  profile: Profile;
  currentInstitutionRole: string | null;
}) {
  return getEffectiveRole({
    membershipRole: currentInstitutionRole,
    profileRole: profile.role,
  });
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

function preloadEmailPage(): void {
  void import('../pages/Admin/tabs/EmailTab');
}

export function getSidebarNavigationItems({
  profile,
  currentInstitutionRole,
  currentUserRole,
  pathname = '',
}: {
  profile: Profile;
  currentInstitutionRole: string | null;
  currentUserRole: User['role'];
  pathname?: string;
}): SidebarNavigationItem[] {
  const effectiveRole =
    getSidebarEffectiveRole({
      profile,
      currentInstitutionRole,
    });
  const isPlatformSuperAdmin =
    profile.platform_role === 'SUPER_ADMIN';
  const effectiveNavigationRole =
    isPlatformSuperAdmin
      ? currentUserRole
      : mapDatabaseRole(effectiveRole ?? '') ?? currentUserRole;

  return baseNavigationItems
    .filter((item) => {
      if (
        item.id === 'terminals' &&
        isPlatformSuperAdmin &&
        !isAdminPath(pathname)
      ) {
        return false;
      }

      if (
        item.id === 'dashboard' &&
        (currentUserRole === 'director' ||
          currentUserRole === 'secretary')
      ) {
        return false;
      }

      if (
        item.roles &&
        !item.roles.includes(effectiveNavigationRole)
      ) {
        return false;
      }

      if (!item.permissions) {
        return true;
      }

      return hasAnyPermission(
        profile.platform_role,
        effectiveRole,
        item.permissions,
      );
    })
    .map((item) =>
      item.id === 'platform' &&
      isPlatformSuperAdmin &&
      isAdminPath(pathname)
        ? {
            ...item,
            label: 'Voltar para Plataforma',
            activePaths: ['/platform'],
          }
        : item,
    );
}

export function getSidebarAdminModules({
  profile,
  currentInstitutionRole,
  currentUserRole,
  pathname = '',
}: {
  profile: Profile;
  currentInstitutionRole: string | null;
  currentUserRole: User['role'];
  pathname?: string;
}): AdminModuleDefinition[] {
  const isPlatformSuperAdmin =
    profile.platform_role === 'SUPER_ADMIN';

  if (
    isPlatformSuperAdmin &&
    !isAdminPath(pathname)
  ) {
    return [];
  }

  if (
    !isPlatformSuperAdmin &&
    ![
      'admin',
      'director',
      'secretary',
    ].includes(currentUserRole)
  ) {
    return [];
  }

  const effectiveRole =
    getSidebarEffectiveRole({
      profile,
      currentInstitutionRole,
    });

  return ADMIN_MODULES.filter((module) => {
    if (module.id === 'email') {
      return false;
    }

    if (
      ['students', 'teachers', 'guardians'].includes(
        module.id,
      )
    ) {
      return false;
    }

    if (profile.role === 'ADMIN' || currentUserRole === 'admin') {
      if (['attendance', 'grades', 'term-closing'].includes(module.id)) {
        return false;
      }
    }
    return hasPermission(
      profile.platform_role,
      effectiveRole,
      module.permission,
    );
  });
}

export default function Sidebar({
  currentUser,
  profile,
  branding,
  currentInstitutionRole,
  isDesktopHidden,
  isMobileOpen,
  isLoggingOut,
  onCloseMobile,
  onLogout,
  mobileSidebarRef,
  mobileCloseButtonRef,
  mobileTitleId = 'app-sidebar-title',
}: SidebarProps) {
  const location = useLocation();
  const [brandLogoFailed, setBrandLogoFailed] =
    useState(false);
  const navigationItems = getSidebarNavigationItems({
    profile,
    currentInstitutionRole,
    currentUserRole: currentUser.role,
    pathname: location.pathname,
  });
  const adminModules = getSidebarAdminModules({
    profile,
    currentInstitutionRole,
    currentUserRole: currentUser.role,
    pathname: location.pathname,
  });
  const adminModuleGroups =
    groupAdminModules(adminModules);
  const groupedSections = Array.from(
    new Set(
      navigationItems.map((item) => item.section),
    ),
  );
  const initials = getInitials(currentUser.name);
  const brandName =
    branding.displayName?.trim() || 'EduManager Pro';
  const brandLogoUrl =
    branding.logoUrl && !brandLogoFailed
      ? branding.logoUrl
      : null;
  const adminSearchParams =
    new URLSearchParams(location.search);
  const requestedAdminModule =
    adminSearchParams.get('module');
  const activeAdminModuleId = isAdminModuleId(
    requestedAdminModule,
  )
    ? requestedAdminModule
    : DEFAULT_ADMIN_MODULE_ID;
  const activeAdminModule =
    adminModules.find(
      (module) =>
        module.id === activeAdminModuleId,
    ) ?? adminModules[0];
  const showAdminModules =
    adminModules.length > 0;
  const adminRouteActive = isAdminPath(
    location.pathname,
  );

  useEffect(() => {
    setBrandLogoFailed(false);
  }, [branding.logoUrl]);

  function renderAdminModuleLink(
    module: AdminModuleDefinition,
  ) {
    const isActive =
      adminRouteActive &&
      activeAdminModule?.id === module.id;

    return (
      <Link
        key={module.id}
        to={module.href}
        onClick={onCloseMobile}
        aria-current={
          isActive ? 'page' : undefined
        }
        className={`group relative flex min-h-9 items-center rounded-lg py-2 pl-9 pr-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 ${
          isActive
            ? 'bg-white text-[#061f6f] shadow-sm ring-1 ring-[#d8deea]'
            : 'text-[#414754] hover:bg-white hover:text-[#181c20]'
        }`}
      >
        <span
          className={`absolute left-5 top-3 h-2 w-2 rounded-full ${
            isActive
              ? 'bg-[#005bbf]'
              : 'bg-[#a8b3c7]'
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">
          {module.label}
        </span>
      </Link>
    );
  }

  function renderAdminModules() {
    if (!showAdminModules) {
      return null;
    }

    return (
      <div className="mb-5 last:mb-0">
        <div className="space-y-3">
          {adminModuleGroups.map((group) => (
            <div key={group.id}>
              <div className="space-y-1">
                {group.modules.map(
                  renderAdminModuleLink,
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu pelo fundo"
          tabIndex={-1}
        />
      )}

      <aside
        ref={mobileSidebarRef}
        id="app-sidebar"
        role={isMobileOpen ? 'dialog' : undefined}
        aria-modal={isMobileOpen ? 'true' : undefined}
        aria-labelledby={
          isMobileOpen
            ? mobileTitleId
            : undefined
        }
        tabIndex={isMobileOpen ? -1 : undefined}
        data-desktop-hidden={isDesktopHidden ? 'true' : 'false'}
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[86vw] transform flex-col border-r border-[#d8deea] bg-[#f8faff] shadow-2xl shadow-slate-950/10 transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-[280px] lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          isMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        } ${
          isDesktopHidden ? 'lg:hidden' : ''
        }`}
        aria-label="Navegação principal"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[#d8deea] px-4">
          <Link
            to="/dashboard"
            onClick={onCloseMobile}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
            aria-label={brandName}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden text-white ${
                brandLogoUrl
                  ? 'rounded-lg bg-transparent shadow-none'
                  : 'rounded-xl shadow-sm'
              }`}
              style={{
                backgroundColor: brandLogoUrl
                  ? 'transparent'
                  : 'var(--brand-primary)',
              }}
            >
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setBrandLogoFailed(true)}
                />
              ) : (
                <GraduationCap
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              )}
            </span>

            <span className="min-w-0 transition-opacity duration-150 motion-reduce:transition-none">
              <span
                id={mobileTitleId}
                className="block truncate text-sm font-extrabold text-[#061f6f]"
              >
                {brandName}
              </span>
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]">
                Gestão acadêmica
              </span>
            </span>
          </Link>

          <button
            ref={mobileCloseButtonRef}
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#414754] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#005bbf] lg:hidden"
            onClick={onCloseMobile}
            aria-label="Fechar menu de navegação"
          >
            <X
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          aria-label="Menu principal"
        >
          {groupedSections.map((section) => {
            const items = navigationItems.filter(
              (item) => item.section === section,
            );

            return (
              <div
                key={section}
                className="mb-5 last:mb-0"
              >
                {hiddenSectionLabels.includes(section) ? null : (
                  <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">
                    {sectionLabels[section]}
                  </p>
                )}

                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(
                      location.pathname,
                      item,
                    );

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onCloseMobile}
                        onMouseEnter={
                          item.id === 'email'
                            ? preloadEmailPage
                            : undefined
                        }
                        onFocus={
                          item.id === 'email'
                            ? preloadEmailPage
                            : undefined
                        }
                        aria-current={
                          isActive
                            ? 'page'
                            : undefined
                        }
                        className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none ${
                          isActive
                            ? 'bg-white text-[#061f6f] shadow-sm ring-1 ring-[#d8deea]'
                            : 'text-[#414754] hover:bg-white hover:text-[#181c20] focus-visible:bg-white'
                        } focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2`}
                      >
                        <span
                          className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${
                            isActive
                              ? 'bg-[#005bbf]'
                              : 'bg-transparent'
                          }`}
                          aria-hidden="true"
                        />

                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive
                              ? 'text-[#005bbf]'
                              : 'text-[#667085]'
                          }`}
                          aria-hidden="true"
                        />

                        <span className="min-w-0 truncate">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {renderAdminModules()}
        </nav>

        <div className="border-t border-[#d8deea] p-3">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[#e4e8f1]">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eeff] text-sm font-extrabold text-[#061f6f]"
              aria-hidden="true"
            >
              {initials}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#181c20]">
                {currentUser.name}
              </span>
              <span className="block truncate text-xs text-[#667085]">
                {currentUser.subtitle}
              </span>
            </span>
          </div>

          <div className="flex">
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-red-100 bg-white px-3 text-sm font-bold text-[#ba1a1a] outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[#ba1a1a] disabled:cursor-wait disabled:opacity-70"
            >
              <LogOut
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {isLoggingOut
                  ? 'Saindo...'
                  : 'Sair'}
              </span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-[#667085]">
            <UserCircle2
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            <span className="truncate">
              {currentUser.email}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
