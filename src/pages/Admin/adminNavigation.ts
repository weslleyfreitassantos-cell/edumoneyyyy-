import type {
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
  | 'academic-policies';

export type AdminNavigationGroupId =
  | 'start'
  | 'people'
  | 'school-structure'
  | 'academic-operation';

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
    id: 'school-structure',
    label: 'Estrutura escolar',
  },
  {
    id: 'academic-operation',
    label: 'Operação acadêmica',
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
    id: 'academic-years',
    label: 'Ano letivo',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
    href: moduleHref('academic-years'),
  },
  {
    id: 'subjects',
    label: 'Disciplinas',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
    href: moduleHref('subjects'),
  },
  {
    id: 'classes',
    label: 'Turmas',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
    href: moduleHref('classes'),
  },
  {
    id: 'curriculum',
    label: 'Matriz curricular',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
    href: moduleHref('curriculum'),
  },
  {
    id: 'enrollments',
    label: 'Matrículas',
    groupId: 'school-structure',
    permission: 'manage_enrollments',
    href: moduleHref('enrollments'),
  },
  {
    id: 'assignments',
    label: 'Atribuições',
    groupId: 'school-structure',
    permission: 'manage_assignments',
    href: moduleHref('assignments'),
  },
  {
    id: 'attendance',
    label: 'Frequência',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('attendance'),
  },
  {
    id: 'grades',
    label: 'Notas',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('grades'),
  },
  {
    id: 'term-closing',
    label: 'Fechamento',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
    href: moduleHref('term-closing'),
  },
  {
    id: 'academic-policies',
    label: 'Política acadêmica',
    groupId: 'academic-operation',
    permission: 'manage_academic_structure',
    href: moduleHref('academic-policies'),
  },
];

export const DEFAULT_ADMIN_MODULE_ID: AdminModuleId =
  'overview';

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
