import {
  useEffect,
  useMemo,
} from 'react';
import {
  Navigate,
  useSearchParams,
} from 'react-router-dom';

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
  DEFAULT_ADMIN_MODULE_ID,
  isAdminModuleId,
  type AdminModuleId,
} from './adminNavigation';
import AdminOverviewTab from './tabs/AdminOverviewTab';
import AcademicYearsTab from './tabs/AcademicYearsTab';
import AssignmentsTab from './tabs/AssignmentsTab';
import ClassesTab from './tabs/ClassesTab';
import CurriculumTab from './tabs/CurriculumTab';
import TimetableTab from './tabs/TimetableTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import GuardiansTab from './tabs/GuardiansTab';
import SchoolUsersTab from './tabs/SchoolUsersTab';
import StudentsTab from './tabs/StudentsTab';
import SubjectsTab from './tabs/SubjectsTab';
import TeachersTab from './tabs/TeachersTab';

function setModuleParam(
  searchParams: URLSearchParams,
  moduleId: AdminModuleId,
): URLSearchParams {
  const nextParams = new URLSearchParams(
    searchParams,
  );
  nextParams.set('module', moduleId);
  return nextParams;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const institutionQuery =
    useCurrentInstitution(profile?.id);
  const [searchParams, setSearchParams] =
    useSearchParams();

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

  const modules = useMemo(
    () =>
      ADMIN_MODULES.filter((module) =>
        can(module.permission),
      ),
    [
      profile?.platform_role,
      profile?.role,
      institutionQuery.currentRole,
    ],
  );

  const availableModuleIds = modules.map(
    (module) => module.id,
  );

  const requestedModuleParam =
    searchParams.get('module');
  const requestedModuleId = isAdminModuleId(
    requestedModuleParam,
  )
    ? requestedModuleParam
    : DEFAULT_ADMIN_MODULE_ID;

  const activeModuleId =
    modules.some(
      (module) =>
        module.id === requestedModuleId,
    )
      ? requestedModuleId
      : modules[0]?.id;

  useEffect(() => {
    if (!activeModuleId || modules.length === 0) {
      return;
    }

    if (
      requestedModuleParam === activeModuleId
    ) {
      return;
    }

    setSearchParams(
      setModuleParam(
        searchParams,
        activeModuleId,
      ),
      {
        replace: true,
      },
    );
  }, [
    activeModuleId,
    modules.length,
    requestedModuleParam,
    searchParams,
    setSearchParams,
  ]);

  function navigateToModule(
    moduleId: AdminModuleId,
  ): void {
    if (
      !modules.some(
        (module) => module.id === moduleId,
      )
    ) {
      return;
    }

    setSearchParams(
      setModuleParam(searchParams, moduleId),
    );
  }

  if (!profile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (modules.length === 0) {
    return <Navigate to="/platform" replace />;
  }

  const renderModule = () => {
    switch (activeModuleId) {
      case 'overview':
        return (
          <AdminOverviewTab
            availableModuleIds={availableModuleIds}
            onNavigateToModule={navigateToModule}
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
      case 'curriculum':
        return <CurriculumTab />;
      case 'timetable':
        return <TimetableTab />;
      case 'enrollments':
        return <EnrollmentsTab />;
      case 'assignments':
        return <AssignmentsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <section
        key={institutionQuery.currentInstitutionId ?? 'no-institution'}
        className="min-w-0"
      >
        {renderModule()}
      </section>
    </div>
  );
}
