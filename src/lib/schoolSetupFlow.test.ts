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
    label: id,
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

  it('recomenda o ano letivo antes dos períodos', () => {
    expect(nextId({ incompleteAcademic: ['academic-year', 'terms'] })).toBe('academic-year');
  });

  it('mantém matérias disponíveis quando o ano e os períodos já existem', () => {
    expect(nextId({ incompleteAcademic: ['subjects'] })).toBe('subjects');
  });

  it('recomenda o currículo quando a estrutura das turmas ainda está sem matérias', () => {
    expect(nextId({ incompleteAcademic: ['class-subjects', 'timetable'] })).toBe('class-subjects');
  });

  it('recomenda professores quando a configuração acadêmica terminou', () => {
    expect(nextId({ incompleteBlockers: ['teachers-configured'] })).toBe('teachers-configured');
  });

  it('recomenda matrículas quando os professores estão prontos', () => {
    expect(nextId({ incompleteBlockers: ['active-enrollments'] })).toBe('active-enrollments');
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
});
