// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePedagogicalMonitoring } from '../../hooks/usePedagogicalMonitoring';
import PedagogicalMonitoringPanel from './PedagogicalMonitoringPanel';

vi.mock('../../hooks/usePedagogicalMonitoring', () => ({ usePedagogicalMonitoring: vi.fn() }));

const mockedUsePedagogicalMonitoring = vi.mocked(usePedagogicalMonitoring);

const students = Array.from({ length: 30 }, (_, index) => ({
  studentId: `student-${index + 1}`,
  fullName: index === 0 ? 'Ana Aluna' : `Aluno ${index + 1}`,
  registrationNumber: index === 0 ? '20260001' : `2026${String(index + 1).padStart(4, '0')}`,
  classId: 'class-1',
  className: '1º Ano',
  averageGrade: index === 0 ? 62 : 82,
  attendancePercentage: index === 0 ? 80 : 90,
  pendingItems: index === 0 ? 1 : 0,
  lowPerformanceSubjects: index === 0 ? 1 : 0,
  lowAttendanceSubjects: 0,
  dataStatus: index === 0 ? 'PARTIAL' : 'OFFICIAL',
  risk: index === 0 ? { level: 'ATTENTION', reasons: ['1 disciplina(s) abaixo da média.'] } : { level: 'NORMAL', reasons: [] },
  subjects: index === 0 ? [{ subjectOfferingId: 'offering-1', subjectId: 'subject-1', subjectName: 'Matemática', classId: 'class-1', className: '1º Ano', teacherProfileId: 'teacher-1', teacherName: 'Professora Maria', gradePercentage: 62, attendancePercentage: 80, pendingItems: 1, isClosed: false, dataStatus: 'PARTIAL' }] : [],
}));

const data = {
  academicYear: { name: '2026' },
  term: { name: '1º Bimestre' },
  policy: { minimumGradePercentage: 70, minimumAttendancePercentage: 75 },
  filters: { years: [], terms: [], classes: [{ id: 'class-1', label: '1º Ano' }], subjects: [], teachers: [], students: [] },
  students,
  classes: [],
  subjects: [],
  metrics: { monitoredStudents: 30, attentionStudents: 1, criticalStudents: 0, lowAttendanceStudents: 0, lowPerformanceStudents: 1, pendingStudents: 1, officialStudents: 29, partialStudents: 1, closedOfferings: 0, totalOfferings: 1 },
} as never;

describe('PedagogicalMonitoringPanel', () => {
  beforeEach(() => {
    mockedUsePedagogicalMonitoring.mockReturnValue({ data, isLoading: false, isError: false, error: null } as never);
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('mostra métricas compactas, busca e paginação', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);
    expect(screen.getByText('Críticos')).toBeTruthy();
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–10 de 30')).toBeTruthy();
    expect(screen.queryByText('1 disciplina(s) abaixo da média.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Mostrando 11–20 de 30')).toBeTruthy();
  });

  it('busca por nome e RA', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);
    const search = screen.getByRole('textbox', { name: 'Buscar aluno por nome ou RA' });
    fireEvent.change(search, { target: { value: '20260001' } });
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–1 de 1')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'inexistente' } });
    expect(screen.getByText('Nenhum aluno encontrado')).toBeTruthy();
  });

  it('filtra por risco e abre detalhe separado', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Atenção' }));
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–1 de 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(screen.getAllByRole('region', { name: 'Detalhes de Ana Aluna' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Motivos do risco').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 disciplina(s) abaixo da média.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar detalhes' })[0]);
    expect(screen.queryByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeNull();
  });

  it('limpa busca e filtro local sem enviar aluno ao serviço', () => {
    render(<PedagogicalMonitoringPanel institutionId="institution-1" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar aluno por nome ou RA' }), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atenção' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Mostrando 1–10 de 30')).toBeTruthy();
    expect(mockedUsePedagogicalMonitoring).toHaveBeenLastCalledWith('institution-1', expect.not.objectContaining({ studentId: expect.anything() }));
  });
});
