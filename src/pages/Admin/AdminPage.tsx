import {
  useEffect,
  useMemo,
  useRef,
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
import { useSchoolSetupReadiness } from '../../hooks/useSchoolSetupReadiness';

import {
  canManageAcademicStructure,
  hasEffectivePermission,
} from '../../lib/permissions';
import { buildSchoolSetupFlow } from '../../lib/schoolSetupFlow';

import {
  ADMIN_MODULES,
  DEFAULT_ADMIN_MODULE_ID,
  isAdminModuleAvailable,
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
import FinanceTab from './tabs/FinanceTab';
import AccessControlTab from './tabs/AccessControlTab';
import EmailTab from './tabs/EmailTab';
import AnnouncementsTab from './tabs/AnnouncementsTab';
import AcademicCalendarTab from './tabs/AcademicCalendarTab';

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

const setupModules = new Set<AdminModuleId>([
  'school-users',
  'academic-years',
  'subjects',
  'academic-policies',
  'classes',
  'curriculum',
  'teachers',
  'assignments',
  'students',
  'timetable',
]);

function getModuleFromStepHref(
  href: string,
): AdminModuleId | null {
  const query = href.includes('?')
    ? href.slice(href.indexOf('?') + 1)
    : '';
  const moduleId = new URLSearchParams(query).get('module');

  return isAdminModuleId(moduleId) ? moduleId : null;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const institutionQuery =
    useCurrentInstitution(profile?.id);
  const [searchParams, setSearchParams] =
    useSearchParams();
  const readinessQuery = useSchoolSetupReadiness(
    institutionQuery.data ?? '',
  );
  const previousSetupStepIdRef = useRef<string | null | undefined>(undefined);
  const readinessInstitutionIdRef = useRef<string | null>(null);

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
        can(module.permission) &&
        isAdminModuleAvailable(
          module,
          institutionQuery.currentRole,
          profile?.platform_role,
        ),
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

  const canEditAcademic = canManageAcademicStructure(
    profile?.platform_role,
    institutionQuery.currentRole as Parameters<typeof canManageAcademicStructure>[1],
  );

  const configurationHref = availableModuleIds.includes('school-users')
    ? '/admin?module=school-users'
    : '/admin?module=overview';
  const setupFlow = useMemo(
    () => readinessQuery.data
      ? buildSchoolSetupFlow(readinessQuery.data, {
          canEditAcademic,
          includeFoundation: institutionQuery.currentRole !== 'DIRECTOR',
          responsibleUserHref: configurationHref,
        })
      : null,
    [
      canEditAcademic,
      configurationHref,
      institutionQuery.currentRole,
      readinessQuery.data,
    ],
  );
  const setupFlowSteps = useMemo(
    () => setupFlow?.sections
      .filter((section) => section.id !== 'personalization')
      .flatMap((section) => section.steps) ?? [],
    [setupFlow],
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
    const currentNextStepId = setupFlow?.recommendedNextStep?.id ?? null;

    if (!setupFlow || !canEditAcademic) {
      return;
    }

    if (readinessInstitutionIdRef.current !== readinessQuery.data?.institutionId) {
      readinessInstitutionIdRef.current = readinessQuery.data?.institutionId ?? null;
      previousSetupStepIdRef.current = currentNextStepId;
      return;
    }

    const previousNextStepId = previousSetupStepIdRef.current;
    if (previousNextStepId === currentNextStepId) {
      return;
    }

    previousSetupStepIdRef.current = currentNextStepId;

    if (!previousNextStepId || !currentNextStepId || !activeModuleId) {
      return;
    }

    const previousStepIndex = setupFlowSteps.findIndex(
      (step) => step.id === previousNextStepId,
    );
    const currentStepIndex = setupFlowSteps.findIndex(
      (step) => step.id === currentNextStepId,
    );

    if (
      previousStepIndex < 0 ||
      currentStepIndex <= previousStepIndex ||
      !setupModules.has(activeModuleId)
    ) {
      return;
    }

    const nextStep = setupFlow.recommendedNextStep;
    const nextModuleId = nextStep
      ? getModuleFromStepHref(nextStep.href)
      : null;

    if (
      !nextModuleId ||
      nextModuleId === activeModuleId ||
      !availableModuleIds.includes(nextModuleId)
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    const targetQuery = nextStep?.href.includes('?')
      ? nextStep.href.slice(nextStep.href.indexOf('?') + 1)
      : '';
    const targetParams = new URLSearchParams(targetQuery);
    targetParams.forEach((value, key) => {
      nextParams.set(key, value);
    });

    setSearchParams(nextParams);
  }, [
    activeModuleId,
    availableModuleIds,
    canEditAcademic,
    setupFlow,
    setupFlowSteps,
    searchParams,
    setSearchParams,
  ]);

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
      case 'directors':
        return (
          <SchoolUsersTab
            fixedRole="DIRECTOR"
            inviteTargets={['DIRECTOR']}
            inviteHeading="Cadastro de diretor"
          />
        );
      case 'students':
        return <StudentsTab />;
      case 'teachers':
        return <TeachersTab />;
      case 'guardians':
        return <GuardiansTab />;
      case 'secretaries':
        return (
          <SchoolUsersTab
            fixedRole="SECRETARY"
            inviteTargets={['SECRETARY']}
            inviteHeading="Cadastro de secretaria"
          />
        );
      case 'email':
        return <EmailTab />;
      case 'announcements':
        return <AnnouncementsTab />;
      case 'finance':
        return <FinanceTab />;
      case 'access':
        return <AccessControlTab />;
      case 'academic-policies':
        return (
          <AcademicPolicyPanel
            institutionId={institutionQuery.data}
          />
        );
      case 'academic-calendar':
        return <AcademicCalendarTab />;
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
      case 'rooms':
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
