import type {
  CurrentDatabaseRole,
  SystemPermission,
} from '../../lib/permissions';

export type AdminModuleId =
  | 'overview'
  | 'attendance'
  | 'grades'
  | 'school-users'
  | 'students'
  | 'teachers'
  | 'guardians'
  | 'academic-years'
  | 'classes'
  | 'subjects'
  | 'curriculum'
  | 'enrollments'
  | 'assignments'
  | 'term-closing'
  | 'academic-policies'
  | 'timetable'
  | 'rooms'
  | 'finance'
  | 'directors';

export type AdminNavigationGroupId =
  | 'start'
  | 'people'
  | 'academic-configuration'
  | 'school-operation'
  | 'communication-resources'
  | 'administration';

export interface AdminNavigationGroup {
  id: AdminNavigationGroupId;
  label: string;
}

export interface AdminModuleDefinition {
  id: AdminModuleId;
  label: string;
  groupId: AdminNavigationGroupId;
  permission: SystemPermission;
  href: string;
  visibleInSidebar?: boolean;
  allowedRoles?: readonly CurrentDatabaseRole[];
}

export interface AdminModuleGroup
  extends AdminNavigationGroup {
  modules: AdminModuleDefinition[];
}

export const ADMIN_NAVIGATION_GROUPS: AdminNavigationGroup[] = [
  {
    id: 'start',
    label: 'Início',
  },
  {
    id: 'people',
    label: 'Pessoas',
  },
  {
    id: 'academic-configuration',
    label: 'Configuração acadêmica',
  },
  {
    id: 'school-operation',
    label: 'Operação escolar',
  },
  {
    id: 'communication-resources',
    label: 'Comunicação e recursos',
  },
  {
    id: 'administration',
    label: 'Administração',
  },
];

function moduleHref(
  id: AdminModuleId,
): string {
  return `/admin?module=${id}`;
}

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    groupId: 'start',
    permission: 'view_school_dashboard',
    href: moduleHref('overview'),
  },
  {
    id: 'school-users',
    label: 'Usuários',
    groupId: 'people',
    permission: 'manage_school_users',
    href: moduleHref('school-users'),
  },
  {
    id: 'students',
    label: 'Alunos',
    groupId: 'people',
    permission: 'manage_students',
    href: moduleHref('students'),
  },
  {
    id: 'teachers',
    label: 'Professores',
    groupId: 'people',
    permission: 'manage_teachers',
    href: moduleHref('teachers'),
  },
  {
    id: 'guardians',
    label: 'Responsáveis',
    groupId: 'people',
    permission: 'manage_guardians',
    href: moduleHref('guardians'),
  },
  {
    id: 'directors',
    label: 'Diretores',
    groupId: 'people',
    permission: 'manage_school_users',
    href: moduleHref('directors'),
    allowedRoles: ['ADMIN'],
  },
  {
    id: 'finance',
    label: 'Financeiro',
    groupId: 'administration',
    permission: 'manage_finance',
    href: moduleHref('finance'),
  },
  {
    id: 'academic-years',
    label: 'Ano letivo',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: moduleHref('academic-years'),
  },
  {
    id: 'subjects',
    label: 'Disciplinas',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: moduleHref('subjects'),
  },
  {
    id: 'classes',
    label: 'Turmas',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: moduleHref('classes'),
  },
  {
    id: 'rooms',
    label: 'Salas',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: `${moduleHref('rooms')}&view=rooms`,
  },
  {
    id: 'curriculum',
    label: 'Matriz curricular',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: moduleHref('curriculum'),
  },
  {
    id: 'timetable',
    label: 'Grade horária',
    groupId: 'academic-configuration',
    permission: 'manage_academic_structure',
    href: moduleHref('timetable'),
  },
  {
    id: 'enrollments',
    label: 'Matrículas',
    groupId: 'people',
    permission: 'manage_enrollments',
    href: moduleHref('enrollments'),
    visibleInSidebar: false,
  },
  {
    id: 'assignments',
    label: 'Atribuições',
    groupId: 'school-operation',
    permission: 'manage_assignments',
    href: moduleHref('assignments'),
  },
  {
    id: 'attendance',
    label: 'Frequência',
    groupId: 'school-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('attendance'),
  },
  {
    id: 'grades',
    label: 'Notas',
    groupId: 'school-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('grades'),
  },
  {
    id: 'term-closing',
    label: 'Fechamento',
    groupId: 'school-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('term-closing'),
  },
  {
    id: 'academic-policies',
    label: 'Política acadêmica',
    groupId: 'administration',
    permission: 'manage_academic_structure',
    href: moduleHref('academic-policies'),
  },
];

export const DEFAULT_ADMIN_MODULE_ID: AdminModuleId =
  'overview';

export function isAdminModuleAvailable(
  module: AdminModuleDefinition,
  currentRole: string | null | undefined,
): boolean {
  if (!module.allowedRoles) {
    return true;
  }

  return (
    typeof currentRole === 'string' &&
    module.allowedRoles.includes(
      currentRole as CurrentDatabaseRole,
    )
  );
}

export function isAdminModuleId(
  value: string | null | undefined,
): value is AdminModuleId {
  return ADMIN_MODULES.some(
    (module) => module.id === value,
  );
}

export function groupAdminModules(
  modules: readonly AdminModuleDefinition[],
): AdminModuleGroup[] {
  return ADMIN_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    modules: modules.filter(
      (module) => module.groupId === group.id,
    ),
  })).filter((group) => group.modules.length > 0);
}
