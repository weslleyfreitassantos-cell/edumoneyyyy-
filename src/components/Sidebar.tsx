import type {
  LucideIcon,
} from 'lucide-react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  School,
  ShieldCheck,
  UserCircle2,
  X,
} from 'lucide-react';
import type {
  RefObject,
} from 'react';
import {
  Link,
  useLocation,
} from 'react-router-dom';

import type { Profile } from '../contexts/AuthContext';
import type {
  SystemPermission,
} from '../lib/permissions';
import {
  getEffectiveRole,
  hasAnyPermission,
} from '../lib/permissions';
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
  currentInstitutionRole: string | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isLoggingOut: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
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
    id: 'admin',
    label: 'Administração',
    path: '/admin',
    section: 'school',
    icon: School,
    permissions: [
      'view_school_dashboard',
      'manage_school_users',
      'manage_students',
      'manage_guardians',
      'manage_teachers',
      'manage_enrollments',
      'manage_academic_structure',
      'manage_assignments',
    ],
    roles: ['admin', 'director', 'secretary'],
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

export function getSidebarNavigationItems({
  profile,
  currentInstitutionRole,
  currentUserRole,
}: {
  profile: Profile;
  currentInstitutionRole: string | null;
  currentUserRole: User['role'];
}): SidebarNavigationItem[] {
  const effectiveRole = getEffectiveRole({
    membershipRole:
      currentInstitutionRole,
    profileRole: profile.role,
  });

  return baseNavigationItems.filter((item) => {
    if (
      item.roles &&
      !item.roles.includes(currentUserRole)
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
  });
}

export default function Sidebar({
  currentUser,
  profile,
  currentInstitutionRole,
  isCollapsed,
  isMobileOpen,
  isLoggingOut,
  onCloseMobile,
  onToggleCollapsed,
  onLogout,
  mobileSidebarRef,
  mobileCloseButtonRef,
  mobileTitleId = 'app-sidebar-title',
}: SidebarProps) {
  const location = useLocation();
  const navigationItems = getSidebarNavigationItems({
    profile,
    currentInstitutionRole,
    currentUserRole: currentUser.role,
  });
  const groupedSections = Array.from(
    new Set(
      navigationItems.map((item) => item.section),
    ),
  );
  const initials = getInitials(currentUser.name);

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
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[86vw] transform flex-col border-r border-[#d8deea] bg-[#f8faff] shadow-2xl shadow-slate-950/10 transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          isMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        } ${
          isCollapsed
            ? 'lg:w-20'
            : 'lg:w-[280px]'
        }`}
        aria-label="Navegação principal"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[#d8deea] px-4">
          <Link
            to="/dashboard"
            onClick={onCloseMobile}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
            aria-label="EduManager Pro"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#005bbf] text-white shadow-sm">
              <GraduationCap
                className="h-5 w-5"
                aria-hidden="true"
              />
            </span>

            <span
              className={`min-w-0 transition-opacity duration-150 motion-reduce:transition-none ${
                isCollapsed
                  ? 'lg:pointer-events-none lg:sr-only lg:opacity-0'
                  : 'opacity-100'
              }`}
            >
              <span
                id={mobileTitleId}
                className="block truncate text-sm font-extrabold text-[#061f6f]"
              >
                EduManager Pro
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
                <p
                  className={`mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085] ${
                    isCollapsed
                      ? 'lg:sr-only'
                      : ''
                  }`}
                >
                  {sectionLabels[section]}
                </p>

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
                        aria-current={
                          isActive
                            ? 'page'
                            : undefined
                        }
                        aria-label={
                          isCollapsed
                            ? item.label
                            : undefined
                        }
                        className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none ${
                          isActive
                            ? 'bg-white text-[#061f6f] shadow-sm ring-1 ring-[#d8deea]'
                            : 'text-[#414754] hover:bg-white hover:text-[#181c20] focus-visible:bg-white'
                        } focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 ${
                          isCollapsed
                            ? 'lg:justify-center'
                            : ''
                        }`}
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

                        <span
                          className={`min-w-0 truncate ${
                            isCollapsed
                              ? 'lg:sr-only'
                              : ''
                          }`}
                        >
                          {item.label}
                        </span>

                        {isCollapsed && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#d8deea] bg-white px-3 py-1.5 text-xs font-semibold text-[#181c20] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[#d8deea] p-3">
          <div
            className={`mb-3 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[#e4e8f1] ${
              isCollapsed
                ? 'lg:justify-center lg:px-2'
                : ''
            }`}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eeff] text-sm font-extrabold text-[#061f6f]"
              aria-hidden="true"
            >
              {initials}
            </span>

            <span
              className={`min-w-0 ${
                isCollapsed
                  ? 'lg:sr-only'
                  : ''
              }`}
            >
              <span className="block truncate text-sm font-bold text-[#181c20]">
                {currentUser.name}
              </span>
              <span className="block truncate text-xs text-[#667085]">
                {currentUser.subtitle}
              </span>
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d8deea] bg-white text-[#414754] outline-none transition-colors hover:bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={
                isCollapsed
                  ? 'Expandir sidebar'
                  : 'Recolher sidebar'
              }
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              ) : (
                <ChevronLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-red-100 bg-white px-3 text-sm font-bold text-[#ba1a1a] outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[#ba1a1a] disabled:cursor-wait disabled:opacity-70 ${
                isCollapsed
                  ? 'lg:w-10 lg:flex-none lg:px-0'
                  : ''
              }`}
            >
              <LogOut
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span
                className={
                  isCollapsed
                    ? 'lg:sr-only'
                    : ''
                }
              >
                {isLoggingOut
                  ? 'Saindo...'
                  : 'Sair'}
              </span>
            </button>
          </div>

          <div
            className={`mt-3 flex items-center gap-2 px-1 text-[11px] text-[#667085] ${
              isCollapsed
                ? 'lg:sr-only'
                : ''
            }`}
          >
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
