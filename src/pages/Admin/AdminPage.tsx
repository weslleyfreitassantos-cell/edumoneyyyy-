import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Navigate,
} from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import InstitutionAttendancePanel from '../../components/attendance/InstitutionAttendancePanel';
import InstitutionGradesPanel from '../../components/grades/InstitutionGradesPanel';
import InstitutionTermClosingPanel from '../../components/academic/InstitutionTermClosingPanel';
import AcademicPolicyPanel from '../../components/academic/AcademicPolicyPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';

import {
  hasEffectivePermission,
} from '../../lib/permissions';

import {
  ADMIN_MODULES,
  ADMIN_NAVIGATION_GROUPS,
  type AdminModuleDefinition,
  type AdminModuleId,
} from './adminNavigation';
import AdminOverviewTab from './tabs/AdminOverviewTab';
import AcademicYearsTab from './tabs/AcademicYearsTab';
import AssignmentsTab from './tabs/AssignmentsTab';
import ClassesTab from './tabs/ClassesTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import GuardiansTab from './tabs/GuardiansTab';
import SchoolUsersTab from './tabs/SchoolUsersTab';
import StudentsTab from './tabs/StudentsTab';
import SubjectsTab from './tabs/SubjectsTab';
import TeachersTab from './tabs/TeachersTab';

export default function AdminPage() {
  const { profile } = useAuth();
  const institutionQuery =
    useCurrentInstitution(profile?.id);
  const [activeTab, setActiveTab] =
    useState<AdminModuleId>('overview');
  const [
    isAdminNavCollapsed,
    setIsAdminNavCollapsed,
  ] = useState(false);

  const can = (
    permission: Parameters<
      typeof hasEffectivePermission
    >[0]['permission'],
  ) =>
    hasEffectivePermission({
      platformRole: profile?.platform_role,
      membershipRole:
        institutionQuery.currentRole,
      profileRole: profile?.role,
      permission,
    });

  const tabs = ADMIN_MODULES.filter((module) =>
    can(module.permission),
  );

  const availableModuleIds = tabs.map(
    (tab) => tab.id,
  );

  const groupedTabs = useMemo(
    () =>
      ADMIN_NAVIGATION_GROUPS.map((group) => ({
        ...group,
        modules: tabs.filter(
          (tab) => tab.groupId === group.id,
        ),
      })).filter((group) => group.modules.length > 0),
    [tabs],
  );

  const activeModule = tabs.find(
    (tab) => tab.id === activeTab,
  );

  const activeGroup = activeModule
    ? ADMIN_NAVIGATION_GROUPS.find(
        (group) =>
          group.id === activeModule.groupId,
      )
    : null;

  useEffect(() => {
    if (
      tabs.length > 0 &&
      !tabs.some((tab) => tab.id === activeTab)
    ) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  if (!profile || tabs.length === 0) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <AdminOverviewTab
            availableModuleIds={availableModuleIds}
            onNavigateToModule={setActiveTab}
          />
        );
      case 'attendance':
        return (
          <InstitutionAttendancePanel
            institutionId={institutionQuery.data}
          />
        );
      case 'grades':
        return (
          <InstitutionGradesPanel
            institutionId={institutionQuery.data}
          />
        );
      case 'term-closing':
        return (
          <InstitutionTermClosingPanel
            institutionId={institutionQuery.data}
          />
        );
      case 'school-users':
        return <SchoolUsersTab />;
      case 'students':
        return <StudentsTab />;
      case 'teachers':
        return <TeachersTab />;
      case 'guardians':
        return <GuardiansTab />;
      case 'academic-policies':
        return (
          <AcademicPolicyPanel
            institutionId={institutionQuery.data}
          />
        );
      case 'academic-years':
        return <AcademicYearsTab />;
      case 'classes':
        return <ClassesTab />;
      case 'subjects':
        return <SubjectsTab />;
      case 'enrollments':
        return <EnrollmentsTab />;
      case 'assignments':
        return <AssignmentsTab />;
      default:
        return (
          <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500 dark:border-[#334155] dark:bg-[#182235] dark:text-[#cbd5e1]">
            Este módulo ainda será conectado.
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#181c20] dark:text-[#f8fafc]">
          Administração
        </h2>

        <p className="text-sm text-[#727785] dark:text-[#cbd5e1]">
          Gerencie a estrutura acadêmica, vínculos e matrículas da instituição.
        </p>
      </div>

      <div className="lg:hidden">
        <label
          htmlFor="admin-module-select"
          className="block text-sm font-semibold text-[#414754] dark:text-[#cbd5e1]"
        >
          Módulo administrativo
        </label>

        <select
          id="admin-module-select"
          value={activeTab}
          onChange={(event) =>
            setActiveTab(
              event.target.value as AdminModuleId,
            )
          }
          className="mt-2 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 py-2 text-sm font-medium text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc]"
          aria-label={
            activeGroup && activeModule
              ? `${activeGroup.label} > ${activeModule.label}`
              : 'Módulo administrativo'
          }
        >
          {groupedTabs.map((group) => (
            <optgroup
              key={group.id}
              label={group.label}
            >
              {group.modules.map((tab) => (
                <option
                  key={tab.id}
                  value={tab.id}
                >
                  {group.label} › {tab.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div
        className={`grid gap-6 lg:items-start ${
          isAdminNavCollapsed
            ? 'lg:grid-cols-[64px_minmax(0,1fr)]'
            : 'lg:grid-cols-[240px_minmax(0,1fr)]'
        }`}
      >
        <nav
          aria-label="Módulos administrativos"
          className="hidden rounded-xl border border-[#dfe3e8] bg-white p-3 shadow-sm dark:border-[#334155] dark:bg-[#182235] lg:block"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            {!isAdminNavCollapsed && (
              <p className="px-2 text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-[#94a3b8]">
                Módulos
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                setIsAdminNavCollapsed(
                  (current) => !current,
                )
              }
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] outline-none transition hover:bg-[#eef3ff] hover:text-[#005bbf] focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:text-[#94a3b8] dark:hover:bg-[#243247] dark:hover:text-[#e2e8f0]"
              aria-label={
                isAdminNavCollapsed
                  ? 'Expandir navegação administrativa'
                  : 'Recolher navegação administrativa'
              }
            >
              {isAdminNavCollapsed ? (
                <PanelLeftOpen
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              ) : (
                <PanelLeftClose
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          <div className="space-y-4">
            {groupedTabs.map((group) => (
              <div key={group.id}>
                {!isAdminNavCollapsed && (
                  <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-[#94a3b8]">
                    {group.label}
                  </h3>
                )}

                <div className="mt-1 space-y-1">
                  {group.modules.map(
                    (
                      tab: AdminModuleDefinition,
                    ) => {
                      const isActive =
                        activeTab === tab.id;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() =>
                            setActiveTab(tab.id)
                          }
                          aria-current={
                            isActive
                              ? 'page'
                              : undefined
                          }
                          title={
                            isAdminNavCollapsed
                              ? `${group.label} › ${tab.label}`
                              : undefined
                          }
                          className={`flex w-full items-center rounded-lg px-2 py-2 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#005bbf] ${
                            isAdminNavCollapsed
                              ? 'justify-center'
                              : 'justify-start'
                          } ${
                            isActive
                              ? 'bg-[#eaf2ff] text-[#005bbf] dark:bg-[#0b3a68] dark:text-[#bfdbfe]'
                              : 'text-[#414754] hover:bg-[#f3f6fb] hover:text-[#181c20] dark:text-[#cbd5e1] dark:hover:bg-[#243247] dark:hover:text-[#f8fafc]'
                          }`}
                        >
                          {isAdminNavCollapsed
                            ? tab.label
                                .slice(0, 1)
                                .toUpperCase()
                            : tab.label}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
