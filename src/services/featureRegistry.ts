import type { UserRole } from '../types';

export interface AssistantFeature {
  id: string;
  label: string;
  description: string;
  route: string;
  roles: UserRole[];
  permission?: string;
}

export const FEATURE_REGISTRY: AssistantFeature[] = [
  { id: 'timetable', label: 'Grade horária', description: 'Configure turmas, disciplinas, professores e horários.', route: '/admin?module=timetable&view=automation', roles: ['super_admin', 'director', 'secretary'] },
  { id: 'finance', label: 'Financeiro', description: 'Consulte faturas, mensalidades e recebimentos.', route: '/admin?module=finance', roles: ['super_admin', 'director'] , permission: 'manage_finance' },
  { id: 'access', label: 'Portaria e equipamentos', description: 'Conecte e acompanhe equipamentos de acesso.', route: '/admin?module=access', roles: ['super_admin', 'director', 'secretary'], permission: 'manage_finance' },
  { id: 'students', label: 'Alunos', description: 'Consulte e cadastre alunos da instituição.', route: '/admin?module=students', roles: ['super_admin', 'director', 'secretary'] },
];

export function getAssistantFeatures(role: UserRole): AssistantFeature[] {
  return FEATURE_REGISTRY.filter((feature) => feature.roles.includes(role));
}

export function recordAssistantUsage(featureId: string, institutionId: string | null): void {
  if (typeof window === 'undefined') return;
  const key = `edumanager.assistant.telemetry.${institutionId ?? 'unknown'}`;
  try {
    const current = JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, number>;
    current[featureId] = (current[featureId] ?? 0) + 1;
    window.localStorage.setItem(key, JSON.stringify(current));
  } catch { /* telemetria opcional não deve bloquear a navegação */ }
}
