// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  students: [
    { student_id: 'student-joao', full_name: 'João da Silva', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 72, active_session_status: null, target_skill_title: null },
    { student_id: 'student-ana', full_name: 'Ana Carolina Gomes', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-arthur', full_name: 'Arthur Martins Cardoso', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-beatriz', full_name: 'Beatriz Augusto Rocha', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-bernardo', full_name: 'Bernardo Ribeiro', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-cecilia', full_name: 'Cecília Letícia Azevedo', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-daniel', full_name: 'Daniel Costa', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 0, average_mastery: 0, active_session_status: null, target_skill_title: null },
    { student_id: 'student-elisa', full_name: 'Elisa Martins', class_id: 'class-1', class_name: '1ª Série A', open_error_count: 1, average_mastery: 40, active_session_status: null, target_skill_title: null },
  ],
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'teacher-1' } }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'institution-1' }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useTeacherClassKnowledgeHeatmap: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../../hooks/useLearningCenter', () => ({
  useTeacherLearningSubjects: () => ({ data: [{ id: 'subject-physics', name: 'Física' }], isLoading: false, isError: false }),
  useTeacherLearningScopedClasses: () => ({ data: [{ id: 'class-1', name: '1ª Série A' }], isLoading: false, isError: false }),
  useTeacherLearningStudents: () => ({ data: state.students, isLoading: false, isFetching: false, isError: false }),
}));

import PedagogicalCenterOverviewPage from './PedagogicalCenterOverviewPage';

afterEach(() => cleanup());

function renderPage() {
  return render(<MemoryRouter initialEntries={['/teacher/pedagogical-center']}><PedagogicalCenterOverviewPage /></MemoryRouter>);
}

describe('PedagogicalCenterOverviewPage', () => {
  it('mantém uma única tela com tabela paginada e ação de detalhe', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Desempenho' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Turma' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Alunos' })).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Buscar aluno' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeTruthy();
    expect(screen.getByText('João da Silva')).toBeTruthy();
    expect(screen.queryByText('Daniel Costa')).toBeNull();
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver desempenho de João da Silva' }).getAttribute('href')).toBe('/teacher/pedagogical-center/students/student-joao?class=class-1&subject=subject-physics');
  });

  it('busca sem acentos e reinicia a página', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Página 2 de 2')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar aluno' }), { target: { value: ' joao ' } });

    expect(screen.getByText('João da Silva')).toBeTruthy();
    expect(screen.queryByText('Daniel Costa')).toBeNull();
  });
});
