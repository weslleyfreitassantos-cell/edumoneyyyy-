// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePedagogicalMonitoring } from '../../hooks/usePedagogicalMonitoring';
import PedagogicalMonitoringPanel from './PedagogicalMonitoringPanel';

vi.mock('../../hooks/usePedagogicalMonitoring', () => ({
  usePedagogicalMonitoring: vi.fn(),
}));

const mockedUsePedagogicalMonitoring = vi.mocked(
  usePedagogicalMonitoring,
);

const data = {
  academicYear: { name: '2026' },
  term: { name: '1º Bimestre' },
  policy: {
    minimumGradePercentage: 70,
    minimumAttendancePercentage: 75,
  },
  filters: {
    years: [],
    terms: [],
    classes: [],
    subjects: [],
    teachers: [],
  },
  students: [
    {
      studentId: 'student-1',
      fullName: 'Ana Aluna',
      registrationNumber: '20260001',
      classId: 'class-1',
      className: '1º Ano',
      averageGrade: 62,
      attendancePercentage: 80,
      pendingItems: 0,
      lowPerformanceSubjects: 1,
      lowAttendanceSubjects: 0,
      dataStatus: 'PARTIAL',
      risk: {
        level: 'ATTENTION',
        reasons: ['1 disciplina(s) abaixo da média.'],
      },
      subjects: [],
    },
  ],
  classes: [],
  subjects: [],
  metrics: {
    monitoredStudents: 1,
    attentionStudents: 1,
    criticalStudents: 0,
    lowAttendanceStudents: 0,
    lowPerformanceStudents: 1,
    pendingStudents: 0,
    officialStudents: 0,
    partialStudents: 1,
    closedOfferings: 0,
    totalOfferings: 1,
  },
} as never;

describe('PedagogicalMonitoringPanel', () => {
  beforeEach(() => {
    mockedUsePedagogicalMonitoring.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('mostra indicadores, situação explicável e estado parcial', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);

    expect(screen.getByText('Alunos monitorados')).toBeTruthy();
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getAllByText('Atenção').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Dados parciais/)).toBeNull();
    expect(screen.getByText(/1 parcial\(is\)/)).toBeTruthy();
  });

  it('abre o drilldown do aluno selecionado', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));

    expect(screen.getByText(/Detalhamento de Ana Aluna/)).toBeTruthy();
    expect(screen.getByText(/Dados parciais do período/)).toBeTruthy();
  });
});
