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
  progress?: {
    current: number;
    total: number;
  };
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
  progress?: {
    current: number;
    total: number;
  };
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
  visibleId: string = id,
): StepDefinition {
  const source = getReadinessStep(readiness, id);

  return {
    id: visibleId,
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
    progress: blocker?.progress,
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
    progress: definition.progress,
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
  enrollments: StepDefinition[];
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
        description: 'A escola está selecionada para esta configuração.',
        href: '/admin?module=overview',
        actionLabel: 'Ver visão geral',
        complete: Boolean(readiness.institutionId),
      },
      {
        id: 'responsible-user',
        label: 'Diretor ou Secretaria',
        description: managerConfigured
          ? 'Há um responsável com acesso à configuração.'
          : 'Adicione um Diretor ou uma Secretaria para configurar a escola.',
        href: responsibleUserHref,
        actionLabel: 'Gerenciar acesso',
        complete: managerConfigured,
        dependencies: ['institution-selected'],
      },
    ] : [],
    academic: [
      definitionFromReadinessGroup(
        readiness,
        'academic-calendar',
        ['academic-year', 'terms'],
        'Calendário',
        'Defina o ano letivo e os períodos.',
        managerDependencies,
      ),
      definitionFromReadiness(
        readiness,
        'subjects',
        'Cadastre as matérias oferecidas pela escola.',
        managerDependencies,
      ),
      definitionFromReadinessGroup(
        readiness,
        'academic-structure',
        ['teaching-structure', 'shifts'],
        'Estrutura de ensino',
        'Defina os níveis de ensino e os turnos usados pela escola.',
        [...managerDependencies, 'academic-calendar'],
      ),
      definitionFromReadiness(
        readiness,
        'classes',
        'Crie as turmas e associe cada uma a um turno.',
        [...managerDependencies, 'academic-calendar', 'academic-structure'],
      ),
      definitionFromReadiness(
        readiness,
        'class-subjects',
        'Associe matérias e aulas semanais às turmas.',
        [...managerDependencies, 'academic-calendar', 'subjects', 'classes'],
        'curriculum',
      ),
    ],
    people: [
      definitionFromBlocker(
        readiness,
        'teachers-configured',
        'Professores',
        'Cadastre os professores da escola.',
        managerDependencies,
        'Configurar professores',
      ),
      definitionFromBlockerGroup(
        readiness,
        'teaching-assignments',
        ['subject-offerings', 'teacher-assignments', 'teacher-qualifications'],
        'Atribuições',
        'Associe professores habilitados às matérias. O sistema pode fazer isso automaticamente.',
        [...managerDependencies, 'teachers-configured', 'curriculum'],
        'Configurar atribuições',
      ),
      {
        ...definitionFromBlocker(
          readiness,
          'teacher-availability',
          'Disponibilidade',
          'Defina quando os professores podem dar aulas.',
          [...managerDependencies, 'teaching-assignments'],
          'Configurar disponibilidade',
        ),
        optional: !readiness.operationalReadiness.blockers.some(
          (blocker) => blocker.id === 'teacher-availability',
        ) || blockerById(readiness, 'teacher-availability')?.description.includes('não exige') === true,
      },
    ],
    enrollments: [
      definitionFromBlocker(
        readiness,
        'active-enrollments',
        'Alunos',
        'Cadastre os alunos e associe-os às turmas.',
        [...managerDependencies, 'academic-calendar', 'classes'],
        'Matricular alunos',
      ),
    ],
    timetable: [
      definitionFromReadiness(
        readiness,
        'timetable',
        'Gere, revise e publique a grade.',
        [...managerDependencies, 'academic-calendar', 'academic-structure', 'classes', 'curriculum', 'teaching-assignments'],
      ),
    ],
    optional: [
      {
        id: 'branding',
        label: 'Identidade visual',
        description: readiness.optionalSetup.brandingConfigured
          ? 'A identidade visual está configurada.'
          : 'A identidade visual é opcional e não bloqueia a operação.',
        href: '/personalizar-login',
        actionLabel: readiness.optionalSetup.brandingConfigured
          ? 'Revisar identidade visual'
          : 'Personalizar acesso',
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
      'Acesso de configuração',
      'Defina quem pode configurar a escola.',
      definitions.foundation,
      resolved,
    ));
  }

  sections.push(
    createSection(
      'academic-structure',
      'Base acadêmica',
      'Configure calendário, matérias, turmas e matriz curricular.',
      definitions.academic,
      resolved,
    ),
    createSection(
      'people',
      'Equipe',
      'Cadastre professores, atribuições e disponibilidade.',
      definitions.people,
      resolved,
    ),
    createSection(
      'enrollments',
      'Alunos',
      'Cadastre os alunos e associe-os às turmas.',
      definitions.enrollments,
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
      'Identidade visual',
      'Personalize o acesso da escola, se desejar.',
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
        description: 'A configuração deve ser realizada por um Diretor ou uma Secretaria.',
        reason: 'Escolha quem ficará responsável pela configuração.',
        href: options.responsibleUserHref ?? defaultResponsibleUserHref,
        actionLabel: 'Gerenciar acesso',
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
