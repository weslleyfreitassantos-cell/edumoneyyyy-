import type {
  SchoolReadinessBlocker,
  SchoolSetupReadiness,
  SchoolSetupStepId,
} from '../services/schoolSetupService';

export type SchoolSetupFlowStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'BLOCKED'
  | 'OPTIONAL';

export interface SchoolSetupFlowStep {
  id: string;
  label: string;
  description: string;
  status: SchoolSetupFlowStatus;
  reason: string | null;
  href: string;
  actionLabel: string;
  dependencies: string[];
}

export interface SchoolSetupFlowSection {
  id: string;
  label: string;
  description: string;
  status: SchoolSetupFlowStatus;
  completedCount: number;
  totalCount: number;
  steps: SchoolSetupFlowStep[];
}

export interface SchoolSetupFlow {
  sections: SchoolSetupFlowSection[];
  completedCount: number;
  totalCount: number;
  progress: number;
  recommendedNextStep: SchoolSetupFlowStep | null;
  academicSetupComplete: boolean;
  operationalReady: boolean;
}

interface FlowOptions {
  canEditAcademic?: boolean;
  includeFoundation?: boolean;
  responsibleUserHref?: string;
}

interface StepDefinition {
  id: string;
  label: string;
  description: string;
  href: string;
  actionLabel?: string;
  dependencies?: string[];
  complete: boolean;
  optional?: boolean;
}

const defaultResponsibleUserHref = '/admin?module=school-users';

const statusLabels: Record<SchoolSetupFlowStatus, string> = {
  COMPLETED: 'Concluído',
  PENDING: 'Pendente',
  BLOCKED: 'Bloqueado',
  OPTIONAL: 'Opcional',
};

function getReadinessStep(
  readiness: SchoolSetupReadiness,
  id: SchoolSetupStepId,
): SchoolSetupStepDefinition | null {
  const step = readiness.steps.find((candidate) => candidate.id === id);
  if (step) return step;

  // Some embedded consumers provide only the summary. The service always
  // returns the complete list, but this keeps the derived layer resilient.
  if (readiness.academicSetupConfigured) {
    return {
      id,
      label: id,
      complete: true,
      href: '/admin?module=overview',
    };
  }

  return null;
}

interface SchoolSetupStepDefinition {
  id: SchoolSetupStepId;
  label: string;
  complete: boolean;
  href: string;
}

function blockerById(
  readiness: SchoolSetupReadiness,
  id: string,
): SchoolReadinessBlocker | null {
  return readiness.operationalReadiness.blockers.find(
    (blocker) => blocker.id === id,
  ) ?? null;
}

function blockerComplete(
  readiness: SchoolSetupReadiness,
  id: string,
): boolean {
  const blocker = blockerById(readiness, id);
  return blocker?.complete ?? readiness.operationalReadiness.totalCount === 0;
}

function definitionFromReadiness(
  readiness: SchoolSetupReadiness,
  id: SchoolSetupStepId,
  description: string,
  dependencies: string[] = [],
): StepDefinition {
  const source = getReadinessStep(readiness, id);

  return {
    id,
    label: source?.label ?? id,
    description,
    href: source?.href ?? '/admin?module=overview',
    dependencies,
    complete: source?.complete ?? false,
  };
}

function definitionFromReadinessGroup(
  readiness: SchoolSetupReadiness,
  id: string,
  sourceIds: SchoolSetupStepId[],
  label: string,
  description: string,
  dependencies: string[] = [],
): StepDefinition {
  const sourceSteps = sourceIds.map((sourceId) =>
    getReadinessStep(readiness, sourceId),
  );
  const firstIncomplete = sourceSteps.find((step) => !step?.complete);
  const firstSource = sourceSteps.find(Boolean);

  return {
    id,
    label,
    description,
    href: firstIncomplete?.href ?? firstSource?.href ?? '/admin?module=overview',
    dependencies,
    complete: sourceSteps.every(
      (step) => step?.complete ?? readiness.academicSetupConfigured,
    ),
  };
}

function definitionFromBlocker(
  readiness: SchoolSetupReadiness,
  id: string,
  label: string,
  description: string,
  dependencies: string[] = [],
  actionLabel?: string,
): StepDefinition {
  const blocker = blockerById(readiness, id);

  return {
    id,
    label,
    description: blocker?.description ?? description,
    href: blocker?.href ?? '/admin?module=overview',
    actionLabel,
    dependencies,
    complete: blockerComplete(readiness, id),
  };
}

function definitionFromBlockerGroup(
  readiness: SchoolSetupReadiness,
  id: string,
  sourceIds: string[],
  label: string,
  description: string,
  dependencies: string[] = [],
  actionLabel?: string,
): StepDefinition {
  const sourceBlockers = sourceIds.map((sourceId) =>
    blockerById(readiness, sourceId),
  );
  const firstIncomplete = sourceBlockers.find((blocker) => !blocker?.complete);
  const firstSource = sourceBlockers.find(Boolean);

  return {
    id,
    label,
    description,
    href: firstIncomplete?.href ?? firstSource?.href ?? '/admin?module=overview',
    actionLabel,
    dependencies,
    complete: sourceIds.every((sourceId) => blockerComplete(readiness, sourceId)),
  };
}

function resolveStep(
  definition: StepDefinition,
  resolved: Map<string, SchoolSetupFlowStep>,
): SchoolSetupFlowStep {
  const missingDependencies = definition.dependencies?.filter(
    (dependency) => resolved.get(dependency)?.status !== 'COMPLETED',
  ) ?? [];
  const status: SchoolSetupFlowStatus = definition.optional
    ? 'OPTIONAL'
    : definition.complete
      ? 'COMPLETED'
      : missingDependencies.length > 0
        ? 'BLOCKED'
        : 'PENDING';
  const firstDependency = missingDependencies[0]
    ? resolved.get(missingDependencies[0])
    : null;
  const reason = missingDependencies.length > 0
    ? `Depende de: ${missingDependencies
        .map((dependency) => resolved.get(dependency)?.label ?? dependency)
        .join(', ')}.`
    : null;

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    status,
    reason,
    href: firstDependency?.href ?? definition.href,
    actionLabel:
      definition.actionLabel ??
      (firstDependency ? `Configurar ${firstDependency.label.toLowerCase()}` : 'Configurar'),
    dependencies: definition.dependencies ?? [],
  };
}

function sectionStatus(
  steps: SchoolSetupFlowStep[],
  optional = false,
): SchoolSetupFlowStatus {
  if (optional) return 'OPTIONAL';
  if (steps.every((step) => step.status === 'COMPLETED')) return 'COMPLETED';
  if (steps.some((step) => step.status === 'PENDING')) return 'PENDING';
  return 'BLOCKED';
}

function createSection(
  id: string,
  label: string,
  description: string,
  definitions: StepDefinition[],
  resolved: Map<string, SchoolSetupFlowStep>,
  optional = false,
): SchoolSetupFlowSection {
  const steps = definitions.map((definition) => {
    const step = resolveStep(definition, resolved);
    resolved.set(step.id, step);
    return step;
  });
  const requiredSteps = steps.filter((step) => step.status !== 'OPTIONAL');

  return {
    id,
    label,
    description,
    status: sectionStatus(steps, optional),
    completedCount: requiredSteps.filter((step) => step.status === 'COMPLETED').length,
    totalCount: requiredSteps.length,
    steps,
  };
}

function setupStepDefinitions(
  readiness: SchoolSetupReadiness,
  responsibleUserHref: string,
  includeFoundation: boolean,
): {
  foundation: StepDefinition[];
  academic: StepDefinition[];
  people: StepDefinition[];
  timetable: StepDefinition[];
  optional: StepDefinition[];
} {
  const managerConfigured =
    readiness.academicManagerCount === undefined || readiness.academicManagerCount > 0;
  const managerDependencies = includeFoundation ? ['responsible-user'] : [];

  return {
    foundation: includeFoundation ? [
      {
        id: 'institution-selected',
        label: 'Instituição criada e selecionada',
        description: 'A configuração está vinculada à instituição selecionada.',
        href: '/admin?module=overview',
        actionLabel: 'Ver visão geral',
        complete: Boolean(readiness.institutionId),
      },
      {
        id: 'responsible-user',
        label: 'Diretor ou Secretaria',
        description: managerConfigured
          ? 'Existe um responsável com acesso à configuração acadêmica.'
          : 'Adicione um Diretor ou Secretaria para realizar a configuração acadêmica da escola.',
        href: responsibleUserHref,
        actionLabel: 'Gerenciar usuários',
        complete: managerConfigured,
        dependencies: ['institution-selected'],
      },
    ] : [],
    academic: [
      definitionFromReadinessGroup(
        readiness,
        'academic-calendar',
        ['academic-year', 'terms'],
        'Calendário acadêmico',
        'Defina o ano letivo e cadastre os períodos que serão usados pela escola.',
        managerDependencies,
      ),
      definitionFromReadinessGroup(
        readiness,
        'academic-base',
        ['subjects', 'teaching-structure', 'shifts'],
        'Matérias e estrutura',
        'Cadastre as matérias e defina a estrutura de ensino e os turnos permitidos.',
        [...managerDependencies, 'academic-calendar'],
      ),
      definitionFromReadinessGroup(
        readiness,
        'classes-and-curriculum',
        ['classes', 'class-subjects'],
        'Turmas e matriz curricular',
        'Crie as turmas e associe as matérias e cargas horárias que serão usadas na grade.',
        [...managerDependencies, 'academic-calendar', 'academic-base'],
      ),
    ],
    people: [
      definitionFromBlocker(
        readiness,
        'teachers-configured',
        'Professores',
        'Cadastre pelo menos um professor ativo.',
        managerDependencies,
        'Configurar professores',
      ),
      definitionFromBlockerGroup(
        readiness,
        'teaching-assignments',
        ['subject-offerings', 'teacher-assignments', 'teacher-qualifications'],
        'Equipe e atribuições',
        'Associe professores habilitados às matérias da matriz. O sistema pode automatizar essa etapa.',
        [...managerDependencies, 'teachers-configured', 'classes-and-curriculum'],
        'Configurar equipe',
      ),
      {
        ...definitionFromBlocker(
          readiness,
          'teacher-availability',
          'Disponibilidade dos professores',
          'Informe a disponibilidade quando a política acadêmica exigir esse dado.',
          [...managerDependencies, 'teaching-assignments'],
          'Configurar disponibilidade',
        ),
        optional: !readiness.operationalReadiness.blockers.some(
          (blocker) => blocker.id === 'teacher-availability',
        ) || blockerById(readiness, 'teacher-availability')?.description.includes('não exige') === true,
      },
      definitionFromBlocker(
        readiness,
        'active-enrollments',
        'Alunos e matrículas',
        'Cadastre os alunos e efetive pelo menos uma matrícula.',
        [...managerDependencies, 'academic-calendar', 'classes-and-curriculum'],
        'Matricular alunos',
      ),
    ],
    timetable: [
      definitionFromReadiness(
        readiness,
        'timetable',
        'Prepare e publique uma grade válida para as turmas ativas.',
        [...managerDependencies, 'academic-calendar', 'academic-base', 'classes-and-curriculum', 'teaching-assignments'],
      ),
    ],
    optional: [
      {
        id: 'branding',
        label: 'Personalização',
        description: readiness.optionalSetup.brandingConfigured
          ? 'A personalização do login está configurada.'
          : 'Personalizar o login é opcional e não bloqueia a operação.',
        href: '/personalizar-login',
        actionLabel: readiness.optionalSetup.brandingConfigured
          ? 'Revisar personalização'
          : 'Personalizar login',
        complete: readiness.optionalSetup.brandingConfigured,
        optional: true,
      },
    ],
  };
}

export function getSchoolSetupFlowStatusLabel(status: SchoolSetupFlowStatus): string {
  return statusLabels[status];
}

export function buildSchoolSetupFlow(
  readiness: SchoolSetupReadiness,
  options: FlowOptions = {},
): SchoolSetupFlow {
  const resolved = new Map<string, SchoolSetupFlowStep>();
  const definitions = setupStepDefinitions(
    readiness,
    options.responsibleUserHref ?? defaultResponsibleUserHref,
    options.includeFoundation !== false,
  );
  const sections: SchoolSetupFlowSection[] = [];

  if (options.includeFoundation !== false) {
    sections.push(createSection(
      'foundation',
      'Fundação',
      'Defina quem poderá realizar a configuração acadêmica da escola.',
      definitions.foundation,
      resolved,
    ));
  }

  sections.push(
    createSection(
      'academic-structure',
      'Configuração acadêmica',
      'Siga um único fluxo para configurar calendário, matérias, estrutura, turmas e matriz curricular.',
      definitions.academic,
      resolved,
    ),
    createSection(
      'people',
      'Equipe e matrículas',
      'Prepare professores, atribuições automáticas, disponibilidade e matrículas para a operação.',
      definitions.people,
      resolved,
    ),
    createSection(
      'timetable',
      'Grade horária',
      'Prepare, revise e publique uma grade estruturalmente válida.',
      definitions.timetable,
      resolved,
    ),
    createSection(
      'personalization',
      'Personalização',
      'A identidade visual é opcional e não bloqueia a escola.',
      definitions.optional,
      resolved,
      true,
    ),
  );
  const requiredSteps = sections
    .filter((section) => section.id !== 'personalization')
    .flatMap((section) => section.steps)
    .filter((step) => step.status !== 'OPTIONAL');
  const completedCount = requiredSteps.filter(
    (step) => step.status === 'COMPLETED',
  ).length;
  const totalCount = requiredSteps.length;
  const nextEditableStep = requiredSteps.find(
    (step) => step.status === 'PENDING',
  ) ?? requiredSteps.find((step) => step.status === 'BLOCKED') ?? null;
  const firstIncompleteStep = requiredSteps.find(
    (step) => step.status !== 'COMPLETED',
  ) ?? null;
  const recommendedNextStep = options.canEditAcademic === false && firstIncompleteStep
    ? {
        ...firstIncompleteStep,
        id: 'manage-users',
        label: 'Responsável pela configuração',
        description: 'A configuração acadêmica deve ser realizada por um Diretor ou Secretaria.',
        reason: 'Escolha ou gerencie o responsável pela configuração acadêmica.',
        href: options.responsibleUserHref ?? defaultResponsibleUserHref,
        actionLabel: 'Gerenciar Diretor ou Secretaria',
      }
    : nextEditableStep;

  return {
    sections,
    completedCount,
    totalCount,
    progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    recommendedNextStep,
    academicSetupComplete: readiness.academicSetupConfigured,
    operationalReady: readiness.operationalReadiness.ready,
  };
}
