import type { UserRole } from '../types';

export interface AssistantFeature {
  id: string;
  label: string;
  description: string;
  route: string;
  roles: UserRole[];
  permission?: string;
  keywords: string[];
}

export const FEATURE_REGISTRY: AssistantFeature[] = [
  { id: 'timetable', label: 'Grade horária', description: 'Configure turmas, disciplinas, professores e horários.', route: '/admin?module=timetable&view=automation', roles: ['super_admin', 'director', 'secretary'], keywords: ['grade', 'horario', 'aula', 'professor', 'turma'] },
  { id: 'finance', label: 'Financeiro', description: 'Consulte faturas, mensalidades e recebimentos.', route: '/admin?module=finance', roles: ['super_admin', 'director'], permission: 'manage_finance', keywords: ['financeiro', 'fatura', 'mensalidade', 'boleto', 'inadimplencia', 'recebimento'] },
  { id: 'access', label: 'Portaria e equipamentos', description: 'Conecte e acompanhe equipamentos de acesso.', route: '/admin?module=access', roles: ['super_admin', 'director', 'secretary'], permission: 'manage_finance', keywords: ['portaria', 'catraca', 'equipamento', 'acesso'] },
  { id: 'students', label: 'Alunos', description: 'Consulte e cadastre alunos da instituição.', route: '/admin?module=students', roles: ['super_admin', 'director', 'secretary'], keywords: ['aluno', 'estudante', 'cadastro', 'pessoa'] },
  { id: 'login-branding', label: 'Personalizar login', description: 'Altere logo, cores e aparência da tela de login.', route: '/personalizar-login', roles: ['super_admin', 'director'], keywords: ['personalizar', 'login', 'logo', 'marca', 'aparencia', 'identidade'] },
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
