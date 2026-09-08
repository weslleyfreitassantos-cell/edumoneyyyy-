import { describe, expect, it } from 'vitest';

import type { SchoolSetupReadiness } from '../services/schoolSetupService';

import { buildSchoolSetupFlow } from './schoolSetupFlow';

const academicStepIds = [
  'academic-year',
  'terms',
  'subjects',
  'teaching-structure',
  'shifts',
  'classes',
  'class-subjects',
  'timetable',
] as const;

const blockerIds = [
  'academic-setup',
  'published-timetable',
  'teachers-configured',
  'subject-offerings',
  'teacher-assignments',
  'teacher-qualifications',
  'teacher-availability',
  'active-enrollments',
];

function createReadiness({
  incompleteAcademic = [],
  incompleteBlockers = [],
  academicManagerCount = 1,
}: {
  incompleteAcademic?: string[];
  incompleteBlockers?: string[];
  academicManagerCount?: number;
} = {}): SchoolSetupReadiness {
  const steps = academicStepIds.map((id) => ({
    id,
    label: {
      'academic-year': 'Ano letivo',
      terms: 'Períodos',
      subjects: 'Matérias',
      'teaching-structure': 'Estrutura de ensino',
      shifts: 'Turnos',
      classes: 'Turmas',
      'class-subjects': 'Matérias das turmas',
      timetable: 'Grade horária',
    }[id],
    complete: !incompleteAcademic.includes(id),
    href: `/admin?module=${id}`,
  }));
  const blockers = blockerIds.map((id) => ({
    id,
    label: id,
    complete: !incompleteBlockers.includes(id),
    description: id === 'teacher-availability'
      ? 'A política não exige disponibilidade cadastrada.'
      : `${id} está configurado.`,
    href: `/admin?module=${id}`,
    ...(id === 'teacher-availability'
      ? { progress: { current: 2, total: 3 } }
      : {}),
  }));
  const completedAcademic = steps.filter((step) => step.complete).length;
  const completedBlockers = blockers.filter((blocker) => blocker.complete).length;

  return {
    institutionId: 'institution-1',
    academicManagerCount,
    steps,
    completedCount: completedAcademic,
    totalCount: steps.length,
    progress: Math.round((completedAcademic / steps.length) * 100),
    configured: completedAcademic === steps.length,
    academicSetupConfigured: completedAcademic === steps.length,
    academicSetupStatus: completedAcademic === steps.length ? 'CONFIGURED' : 'IN_PROGRESS',
    status: completedAcademic === steps.length ? 'CONFIGURED' : 'IN_PROGRESS',
    nextStepId: steps.find((step) => !step.complete)?.id ?? null,
    review: {
      academicYearName: null,
      termCount: 0,
      subjectCount: 0,
      classCount: 0,
      curriculumClassCount: 0,
      timetableClassCount: 0,
    },
    publishedVersionId: null,
    operationalReadiness: {
      blockers,
      completedCount: completedBlockers,
      totalCount: blockers.length,
      progress: Math.round((completedBlockers / blockers.length) * 100),
      ready: completedBlockers === blockers.length,
    },
    optionalSetup: { brandingConfigured: false },
  };
}

function nextId(options?: Parameters<typeof createReadiness>[0]): string | null {
  return buildSchoolSetupFlow(createReadiness(options)).recommendedNextStep?.id ?? null;
}

describe('buildSchoolSetupFlow', () => {
  it('encaminha para Diretor ou Secretaria quando não existe responsável', () => {
    expect(nextId({ academicManagerCount: 0 })).toBe('responsible-user');
  });

  it('recomenda o calendário acadêmico antes da base escolar', () => {
    expect(nextId({ incompleteAcademic: ['academic-year', 'terms'] })).toBe('academic-calendar');
  });

  it('recomenda matérias quando o calendário já existe', () => {
    expect(nextId({ incompleteAcademic: ['subjects'] })).toBe('subjects');
  });

  it('recomenda a matriz depois das turmas', () => {
    expect(nextId({ incompleteAcademic: ['class-subjects', 'timetable'] })).toBe('curriculum');
  });

  it('recomenda professores quando a configuração acadêmica terminou', () => {
    expect(nextId({ incompleteBlockers: ['teachers-configured'] })).toBe('teachers-configured');
  });

  it('consolida as dependências acadêmicas em um fluxo legível', () => {
    const flow = buildSchoolSetupFlow(createReadiness());
    const academicSection = flow.sections.find((section) => section.id === 'academic-structure');
    const peopleSection = flow.sections.find((section) => section.id === 'people');

    expect(academicSection?.steps.map((step) => step.label)).toEqual([
      'Calendário',
      'Matérias',
      'Estrutura de ensino',
      'Turmas',
      'Matérias das turmas',
    ]);
    expect(peopleSection?.steps.map((step) => step.label)).toContain('Atribuições');
    expect(flow.sections.find((section) => section.id === 'enrollments')?.label).toBe('Alunos');
  });

  it('recomenda matrículas quando os professores estão prontos', () => {
    expect(nextId({ incompleteBlockers: ['active-enrollments'] })).toBe('active-enrollments');
  });

  it('preserva o progresso de disponibilidade no fluxo operacional', () => {
    const flow = buildSchoolSetupFlow(createReadiness({ incompleteBlockers: ['teacher-availability'] }));
    const availability = flow.sections
      .flatMap((section) => section.steps)
      .find((step) => step.id === 'teacher-availability');

    expect(availability?.progress).toEqual({ current: 2, total: 3 });
  });

  it('recomenda revisar e publicar uma grade em rascunho', () => {
    expect(nextId({ incompleteAcademic: ['timetable'] })).toBe('timetable');
  });

  it('não recomenda outra etapa quando a escola está pronta para operar', () => {
    const flow = buildSchoolSetupFlow(createReadiness());

    expect(flow.operationalReady).toBe(true);
    expect(flow.academicSetupComplete).toBe(true);
    expect(flow.recommendedNextStep).toBeNull();
  });

  it('não recomenda edição acadêmica para ADMIN', () => {
    const flow = buildSchoolSetupFlow(
      createReadiness({ incompleteAcademic: ['subjects'] }),
      { canEditAcademic: false, responsibleUserHref: '/admin?module=school-users' },
    );

    expect(flow.recommendedNextStep?.id).toBe('manage-users');
    expect(flow.recommendedNextStep?.href).toBe('/admin?module=school-users');
  });

  it('inicia o fluxo do DIRETOR pela estrutura acadêmica', () => {
    const flow = buildSchoolSetupFlow(
      createReadiness({ incompleteAcademic: ['academic-year'] }),
      { includeFoundation: false },
    );

    expect(flow.sections.some((section) => section.id === 'foundation')).toBe(false);
    expect(flow.sections[0]?.id).toBe('academic-structure');
    expect(flow.recommendedNextStep?.id).toBe('academic-calendar');
    expect(flow.sections.flatMap((section) => section.steps).every((step) => step.status !== 'BLOCKED' || !step.reason?.includes('responsável'))).toBe(true);
  });
});
