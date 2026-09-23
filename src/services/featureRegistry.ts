import type { UserRole } from '../types';
import {
  hasEffectivePermission,
  type SystemPermission,
} from '../lib/permissions';

export interface AssistantFeature {
  id: string;
  label: string;
  description: string;
  route: string;
  roles: UserRole[];
  permission?: SystemPermission;
  keywords: string[];
}

export interface AssistantAvailability {
  platformRole?: string | null;
  membershipRole?: string | null;
  profileRole?: string | null;
}

export const FEATURE_REGISTRY: AssistantFeature[] = [
  { id: 'student-study-center', label: 'Central de Estudos', description: 'Estude matérias, pratique e acompanhe seu progresso.', route: '/student/study', roles: ['student'], keywords: ['estudar', 'estudos', 'praticar', 'exercício', 'habilidade', 'progresso', 'central de estudos'] },
  { id: 'teacher-pedagogical-center', label: 'Central Pedagógica', description: 'Acompanhe práticas e o progresso das suas turmas.', route: '/teacher/pedagogical-center', roles: ['teacher'], keywords: ['pedagógica', 'atividade', 'habilidade', 'progresso', 'reforço', 'central pedagógica'] },
  { id: 'timetable', label: 'Grade horária', description: 'Configure turmas, disciplinas, professores e horários.', route: '/admin?module=timetable&view=automation', roles: ['super_admin', 'director', 'secretary'], keywords: ['grade', 'horario', 'aula', 'professor', 'turma'] },
  { id: 'student-timetable', label: 'Grade de horário', description: 'Consulte os horários das aulas da sua turma.', route: '/dashboard/timetable', roles: ['student', 'teacher'], keywords: ['grade', 'horario', 'aula', 'turma', 'calendario'] },
  { id: 'student-subjects', label: 'Disciplinas e professores', description: 'Consulte as disciplinas e os professores do período atual.', route: '/dashboard/subjects', roles: ['student'], keywords: ['disciplina', 'disciplinas', 'professor', 'professores', 'materias'] },
  { id: 'student-library', label: 'Indicações de livros', description: 'Consulte indicações de leitura disponíveis para você.', route: '/dashboard/library', roles: ['student'], keywords: ['livro', 'livros', 'leitura', 'leituras', 'indicacao', 'indicacoes', 'indicação', 'indicações', 'biblioteca'] },
  { id: 'learning-materials', label: 'Materiais e avisos', description: 'Consulte materiais, comunicados e avisos da sua rotina escolar.', route: '/dashboard/materials', roles: ['student', 'teacher'], keywords: ['material', 'materiais', 'aviso', 'avisos', 'comunicado', 'comunicados', 'conteudo'] },
  { id: 'school-email', label: 'E-mail', description: 'Envie comunicados por e-mail para a comunidade escolar.', route: '/admin?module=email', roles: ['director', 'secretary'], permission: 'send_school_email', keywords: ['email', 'e-mail', 'mensagem', 'comunicado', 'comunicados'] },
  { id: 'school-announcements', label: 'Avisos', description: 'Publique e acompanhe avisos da instituição.', route: '/admin?module=announcements', roles: ['director', 'secretary'], permission: 'manage_school_communications', keywords: ['aviso', 'avisos', 'comunicado', 'comunicados', 'comunicacao', 'comunicação'] },
  { id: 'teacher-attendance', label: 'Diário de Classe', description: 'Registre o conteúdo da aula e a frequência dos alunos.', route: '/dashboard/class-diary', roles: ['teacher'], keywords: ['diario', 'diário', 'chamada', 'chamadas', 'frequencia', 'presenca', 'faltas', 'alunos'] },
  { id: 'teacher-grades', label: 'Avaliações e notas', description: 'Crie avaliações e lance notas para suas turmas.', route: '/dashboard/grades', roles: ['teacher'], keywords: ['avaliacao', 'avaliacoes', 'nota', 'notas', 'prova', 'media'] },
  { id: 'teacher-term-closing', label: 'Fechamento de período', description: 'Revise e acompanhe o fechamento dos resultados acadêmicos.', route: '/dashboard/term-closing', roles: ['teacher'], keywords: ['fechamento', 'periodo', 'resultado', 'encerramento'] },
  { id: 'finance', label: 'Financeiro', description: 'Consulte faturas, mensalidades e recebimentos.', route: '/admin?module=finance', roles: ['super_admin', 'director'], permission: 'manage_finance', keywords: ['financeiro', 'fatura', 'mensalidade', 'boleto', 'inadimplencia', 'recebimento'] },
  { id: 'access', label: 'Portaria e equipamentos', description: 'Conecte e acompanhe equipamentos de acesso.', route: '/admin?module=access', roles: ['super_admin', 'director', 'secretary'], permission: 'manage_finance', keywords: ['portaria', 'catraca', 'equipamento', 'acesso'] },
  { id: 'students', label: 'Alunos', description: 'Consulte e cadastre alunos da instituição.', route: '/admin?module=students', roles: ['super_admin', 'director', 'secretary'], keywords: ['aluno', 'estudante', 'cadastro', 'pessoa'] },
  { id: 'login-branding', label: 'Personalizar login', description: 'Altere logo, cores e aparência da tela de login.', route: '/personalizar-login', roles: ['super_admin', 'director'], keywords: ['personalizar', 'login', 'logo', 'marca', 'aparencia', 'identidade'] },
];

export function getAssistantFeatures(
  role: UserRole,
  availability: AssistantAvailability = {},
): AssistantFeature[] {
  return FEATURE_REGISTRY.filter((feature) => {
    if (!feature.roles.includes(role)) {
      return false;
    }

    if (!feature.permission) {
      return true;
    }

    return hasEffectivePermission({
      platformRole: availability.platformRole,
      membershipRole: availability.membershipRole,
      profileRole: availability.profileRole,
      permission: feature.permission,
    });
  });
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
