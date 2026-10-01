// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  averageGrade: index === 0 ? 62 : index === 1 ? 48 : 82,
  attendancePercentage: index === 0 ? 80 : index === 1 ? 68 : 90,
  pendingItems: index === 0 ? 1 : index === 1 ? 2 : 0,
  lowPerformanceSubjects: index === 0 || index === 1 ? 1 : 0,
  lowAttendanceSubjects: index === 1 ? 1 : 0,
  dataStatus: index === 0 ? 'PARTIAL' : 'OFFICIAL',
  risk: index === 0
    ? { level: 'ATTENTION', reasons: ['1 disciplina(s) abaixo da média.'] }
    : index === 1
      ? { level: 'CRITICAL', reasons: ['1 disciplina(s) abaixo da média.', '1 disciplina(s) com frequência baixa.'] }
      : { level: 'NORMAL', reasons: [] },
  subjects: index === 0 ? [{ subjectOfferingId: 'offering-1', subjectId: 'subject-1', subjectName: 'Matemática', classId: 'class-1', className: '1º Ano', teacherProfileId: 'teacher-1', teacherName: 'Professora Maria', gradePercentage: 62, attendancePercentage: 80, pendingItems: 1, isClosed: false, dataStatus: 'PARTIAL' }] : [],
}));

const data = {
  academicYear: { name: '2026' },
  term: { name: '1º Bimestre' },
  policy: { minimumGradePercentage: 70, minimumAttendancePercentage: 75 },
  filters: {
    years: [{ id: 'year-1', name: '2026' }],
    terms: [{ id: 'term-1', name: '1º Bimestre' }],
    classes: [{ id: 'class-1', label: '1º Ano' }],
    subjects: [{ id: 'subject-1', label: 'Matemática' }],
    teachers: [{ id: 'teacher-1', label: 'Professora Maria' }],
    students: [],
  },
  students,
  classes: [],
  subjects: [],
  metrics: { monitoredStudents: 30, attentionStudents: 1, criticalStudents: 1, lowAttendanceStudents: 1, lowPerformanceStudents: 2, pendingStudents: 3, officialStudents: 29, partialStudents: 1, closedOfferings: 0, totalOfferings: 1 },
} as never;

function renderPanel() {
  return render(<PedagogicalMonitoringPanel institutionId="institution-1" />);
}

describe('PedagogicalMonitoringPanel', () => {
  beforeEach(() => {
    mockedUsePedagogicalMonitoring.mockReturnValue({ data, isLoading: false, isError: false, error: null } as never);
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('mostra métricas compactas, tabela sem motivos e paginação padrão de 25', () => {
    renderPanel();
    expect(screen.getByText('Críticos')).toBeTruthy();
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–25 de 30')).toBeTruthy();
    expect(screen.getByRole('table').textContent).not.toContain('1 disciplina(s) abaixo da média.');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Mostrando 26–30 de 30')).toBeTruthy();
  });

  it('permite trocar o tamanho da página e retorna à primeira página', () => {
    renderPanel();
    const pageSize = screen.getByRole('combobox', { name: 'Alunos por página' });
    fireEvent.change(pageSize, { target: { value: '10' } });
    expect(screen.getByText('Mostrando 1–10 de 30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Mostrando 11–20 de 30')).toBeTruthy();
    fireEvent.change(pageSize, { target: { value: '50' } });
    expect(screen.getByText('Mostrando 1–30 de 30')).toBeTruthy();
  });

  it('busca por nome e RA e mostra estado vazio', () => {
    renderPanel();
    const search = screen.getByRole('textbox', { name: 'Buscar aluno por nome ou RA' });
    fireEvent.change(search, { target: { value: '20260001' } });
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–1 de 1')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'Aluno 2' } });
    expect(screen.getByText('Aluno 2')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'inexistente' } });
    expect(screen.getByText('Nenhum aluno encontrado')).toBeTruthy();
  });

  it('filtra todos os níveis de risco e atualiza a seleção', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Crítico' }));
    expect(screen.getByText('Aluno 2')).toBeTruthy();
    expect(screen.queryByText('Ana Aluna')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Atenção' }));
    expect(screen.getByText('Ana Aluna')).toBeTruthy();
    expect(screen.queryByText('Aluno 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Normal' }));
    expect(screen.getByText('Aluno 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos os riscos' }));
    expect(screen.getByText('Mostrando 1–25 de 30')).toBeTruthy();
  });

  it('mostra a quantidade de filtros avançados ativos e permite limpar', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros avançados' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ano letivo' }), { target: { value: 'year-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Período' }), { target: { value: 'term-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Turma' }), { target: { value: 'class-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Disciplina' }), { target: { value: 'subject-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Professor' }), { target: { value: 'teacher-1' } });
    expect(screen.getByRole('button', { name: 'Filtros +5' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByRole('button', { name: 'Filtros avançados' })).toBeTruthy();
  });

  it('mantém os motivos somente no detalhe e fecha ao filtrar ou mudar de página', () => {
    renderPanel();
    const detailButton = screen.getAllByRole('button', { name: 'Detalhes' })[0];
    fireEvent.click(detailButton);
    expect(screen.getByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeTruthy();
    expect(screen.getByText('1 disciplina(s) abaixo da média.')).toBeTruthy();
    expect(screen.getByRole('table').textContent).not.toContain('1 disciplina(s) abaixo da média.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar aluno por nome ou RA' }), { target: { value: 'Aluno 2' } });
    expect(screen.queryByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar aluno por nome ou RA' }), { target: { value: '' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Detalhes' })[0]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Alunos por página' }), { target: { value: '10' } });
    expect(screen.queryByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Alunos por página' }), { target: { value: '25' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Detalhes' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.queryByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeNull();
  });

  it('fecha com Escape, trava o scroll e mantém o foco dentro do drawer', async () => {
    renderPanel();
    const opener = screen.getAllByRole('button', { name: 'Detalhes' })[0];
    fireEvent.click(opener);
    const closeButton = screen.getByRole('button', { name: 'Fechar detalhes' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Detalhes de Ana Aluna' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });
});
