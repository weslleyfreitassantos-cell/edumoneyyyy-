// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTeacherAttendanceOfferings } from '../hooks/useAttendance';
import { useSchoolSetupReadiness } from '../hooks/useSchoolSetupReadiness';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import type { SchoolSetupReadiness } from '../services/schoolSetupService';
import AssistantTec from './AssistantTec';

vi.mock('../hooks/useAttendance', () => ({
  useTeacherAttendanceOfferings: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock('../hooks/useSchoolSetupReadiness', () => ({
  useSchoolSetupReadiness: vi.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
  })),
}));

vi.mock('../hooks/useTeacherDashboard', () => ({
  useTeacherDashboard: vi.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
  })),
}));

afterEach(() => {
  cleanup();
});

function renderAssistant(
  role: 'student' | 'teacher' | 'director',
  availability: {
    platformRole?: string;
    membershipRole?: string;
    profileRole?: string;
  } = {},
  menuItems: { id: string; label: string; path: string }[] = [],
  context: { institutionId?: string | null; profileId?: string | null } = {},
) {
  render(
    <MemoryRouter>
      <AssistantTec
        role={role}
        institutionId={context.institutionId ?? null}
        profileId={context.profileId ?? null}
        {...availability}
        menuItems={menuItems}
      />
    </MemoryRouter>,
  );

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Abrir Assistente TEC',
    }),
  );
}

function setupReadinessFixture(): SchoolSetupReadiness {
  return {
    institutionId: 'institution-1',
    academicManagerCount: 1,
    steps: [
      ['academic-year', 'Ano letivo'],
      ['terms', 'Períodos'],
      ['subjects', 'Disciplinas'],
      ['teaching-structure', 'Estrutura de ensino'],
      ['shifts', 'Turnos'],
      ['classes', 'Turmas'],
      ['class-subjects', 'Matriz curricular'],
      ['timetable', 'Grade horária'],
    ].map(([id, label]) => ({
      id: id as SchoolSetupReadiness['steps'][number]['id'],
      label,
      complete: false,
      href: `/admin?module=${id}`,
    })),
    completedCount: 0,
    totalCount: 8,
    progress: 0,
    configured: false,
    academicSetupConfigured: false,
    academicSetupStatus: 'IN_PROGRESS',
    status: 'IN_PROGRESS',
    nextStepId: 'academic-year',
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
      blockers: [],
      completedCount: 0,
      totalCount: 0,
      progress: 100,
      ready: true,
    },
    optionalSetup: { brandingConfigured: false },
  };
}

describe('AssistantTec', () => {
  it('encontra grade, materiais e avisos disponíveis para o aluno', () => {
    renderAssistant('student');
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'grade de horário' } });
    expect(
      screen.getByRole('button', { name: /Grade de horário/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'avisos' } });
    expect(
      screen.getByRole('button', { name: /Materiais e avisos/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'livros' } });
    expect(
      screen.getByRole('button', { name: /Indicações de livros/i }),
    ).toBeTruthy();
  });

  it('exibe Diário de Classe e avaliações apenas para o professor', () => {
    renderAssistant('teacher');
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'chamada' } });
    expect(
      screen.getByRole('button', { name: /^Diário de Classe/ }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'notas' } });
    expect(
      screen.getByRole('button', { name: /Avaliações e notas/i }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'livros' } });
    expect(
      screen.getByRole('button', { name: /Minhas indicações de livros/i }),
    ).toBeTruthy();
  });

  it('exibe comunicação somente quando a permissão efetiva existe', () => {
    renderAssistant('director', {
      platformRole: 'USER',
      membershipRole: 'DIRECTOR',
      profileRole: 'DIRECTOR',
    }, [
      { id: 'announcements', label: 'Avisos', path: '/admin?module=announcements' },
    ]);
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'avisos' } });
    expect(
      screen.getByRole('button', { name: /^Avisos/ }),
    ).toBeTruthy();
  });

  it('mostra ao professor aulas do dia, turmas, disciplinas e contribuições', () => {
    vi.mocked(useTeacherDashboard).mockReturnValue({
      data: {
        offerings: [
          {
            id: 'offering-1',
            classId: 'class-1',
            subjectId: 'subject-1',
            termId: 'term-1',
            className: '8º A',
            gradeLevel: '8º ano',
            shift: 'MORNING',
            capacity: 30,
            subjectName: 'Matemática',
            subjectCode: 'MAT',
            workload: 4,
            termName: '2026',
            termStartDate: '2026-01-01',
            termEndDate: '2026-12-31',
            studentCount: 30,
          },
          {
            id: 'offering-2',
            classId: 'class-2',
            subjectId: 'subject-2',
            termId: 'term-1',
            className: '9º A',
            gradeLevel: '9º ano',
            shift: 'MORNING',
            capacity: 30,
            subjectName: 'Ciências',
            subjectCode: 'CIE',
            workload: 3,
            termName: '2026',
            termStartDate: '2026-01-01',
            termEndDate: '2026-12-31',
            studentCount: 30,
          },
        ],
        totals: { offerings: 2, classes: 2, subjects: 2, students: 60 },
        enrollmentAccessAvailable: true,
      },
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTeacherAttendanceOfferings).mockReturnValue({
      data: [
        { scheduleSlots: [{ startTime: '07:00', endTime: '07:50' }] },
        { scheduleSlots: [{ startTime: '08:00', endTime: '08:50' }] },
      ],
      isLoading: false,
      isError: false,
    } as never);

    renderAssistant('teacher', {}, [], {
      institutionId: 'institution-1',
      profileId: 'teacher-1',
    });

    const teacherContext = screen.getByRole('region', {
      name: 'Resumo do professor',
    });
    expect(teacherContext.textContent).toContain('2');
    expect(teacherContext.textContent).toContain('aulas hoje');
    expect(teacherContext.textContent).toContain('turmas');
    expect(teacherContext.textContent).toContain('disciplinas');
    expect(teacherContext.textContent).toContain('Matemática');
    expect(teacherContext.textContent).toContain('8º A');
    expect(screen.getByRole('button', { name: /Ver chamadas pendentes/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Abrir contribuições pedagógicas/i })).toBeTruthy();
  });

  it('orienta a configuração e lista dependências que bloqueiam a grade', () => {
    vi.mocked(useSchoolSetupReadiness).mockReturnValue({
      data: setupReadinessFixture(),
      isLoading: false,
      isError: false,
    } as never);

    renderAssistant('director', {
      platformRole: 'USER',
      membershipRole: 'DIRECTOR',
      profileRole: 'DIRECTOR',
    }, [], { institutionId: 'institution-1' });

    expect(screen.getByRole('region', { name: 'Orientação da configuração da escola' })).toBeTruthy();
    expect(screen.getByText(/Próximo passo: Calendário/i)).toBeTruthy();
    expect(screen.getByText('O que está bloqueando a grade')).toBeTruthy();
    expect(screen.getAllByText(/Calendário/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Estrutura de ensino/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Configurar$/i })).toBeTruthy();
  });

  it('não oferece recurso administrativo sem permissão efetiva', () => {
    renderAssistant('director', {
      platformRole: 'USER',
      membershipRole: 'TEACHER',
      profileRole: 'TEACHER',
    });
    const input = screen.getByRole('textbox', {
      name: 'Pergunte ao Assistente TEC',
    });

    fireEvent.change(input, { target: { value: 'financeiro' } });
    expect(
      screen.queryByRole('button', { name: /Financeiro/i }),
    ).toBeNull();
    expect(
      screen.getByText(/Não encontrei um recurso correspondente/i),
    ).toBeTruthy();
  });
});
