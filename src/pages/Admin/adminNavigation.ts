import type { SystemPermission } from '../../lib/permissions';

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

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    groupId: 'start',
    permission: 'view_school_dashboard',
  },
  {
    id: 'school-users',
    label: 'Usuários',
    groupId: 'people',
    permission: 'manage_school_users',
  },
  {
    id: 'students',
    label: 'Alunos',
    groupId: 'people',
    permission: 'manage_students',
  },
  {
    id: 'teachers',
    label: 'Professores',
    groupId: 'people',
    permission: 'manage_teachers',
  },
  {
    id: 'guardians',
    label: 'Responsáveis',
    groupId: 'people',
    permission: 'manage_guardians',
  },
  {
    id: 'academic-years',
    label: 'Ano letivo',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
  },
  {
    id: 'subjects',
    label: 'Disciplinas',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
  },
  {
    id: 'classes',
    label: 'Turmas',
    groupId: 'school-structure',
    permission: 'manage_academic_structure',
  },
  {
    id: 'enrollments',
    label: 'Matrículas',
    groupId: 'school-structure',
    permission: 'manage_enrollments',
  },
  {
    id: 'assignments',
    label: 'Atribuições',
    groupId: 'school-structure',
    permission: 'manage_assignments',
  },
  {
    id: 'attendance',
    label: 'Frequência',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
  },
  {
    id: 'grades',
    label: 'Notas',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
  },
  {
    id: 'term-closing',
    label: 'Fechamento',
    groupId: 'academic-operation',
    permission: 'view_school_dashboard',
  },
  {
    id: 'academic-policies',
    label: 'Política Acadêmica',
    groupId: 'academic-operation',
    permission: 'manage_academic_structure',
  },
];
