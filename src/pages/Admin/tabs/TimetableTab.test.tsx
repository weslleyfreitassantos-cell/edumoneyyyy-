// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useAssignments } from '../../../hooks/useAssignments';
import { useRooms, useTimetableEntries } from '../../../hooks/useTimetable';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../hooks/useAcademicStructure', () => ({
  useAcademicYears: vi.fn(),
}));

vi.mock('../../../hooks/useClasses', () => ({
  useClasses: vi.fn(),
}));

vi.mock('../../../hooks/useAssignments', () => ({
  useAssignments: vi.fn(),
}));

vi.mock('../../../hooks/useTimetable', () => ({
  useRooms: vi.fn(),
  useCreateRoom: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateRoom: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSetRoomActive: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTimetableEntries: vi.fn(),
  useCreateTimetableEntry: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTimetableEntry: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSetTimetableEntryActive: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import TimetableTab from './TimetableTab';

const baseEntries = [
  {
    id: 'e1',
    institution_id: 'inst-1',
    subject_offering_id: 'off-1',
    room_id: 'room-1',
    room_name: 'Sala 01',
    day_of_week: 2,
    day_label: 'Terça',
    start_time: '07:00',
    end_time: '07:50',
    active: true,
    class_name: '1A',
    subject_name: 'Português',
    teacher_name: 'Prof Silva',
  },
  {
    id: 'e2',
    institution_id: 'inst-1',
    subject_offering_id: 'off-2',
    room_id: null,
    room_name: null,
    day_of_week: 3,
    day_label: 'Quarta',
    start_time: '07:50',
    end_time: '08:40',
    active: true,
    class_name: '1A',
    subject_name: 'Matemática',
    teacher_name: 'Prof Souza',
  },
];

const baseRooms = [
  { id: 'room-1', institution_id: 'inst-1', name: 'Sala 01', code: 'S01', capacity: 30, active: true },
  { id: 'room-2', institution_id: 'inst-1', name: 'Sala 02', code: 'S02', capacity: 25, active: true },
];

function mockDefaultHooks() {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'profile-1', app_metadata: {}, user_metadata: {}, aud: '', created_at: '' },
    profile: { id: 'profile-1', full_name: 'Admin', email: 'admin@test.com', role: 'DIRECTOR', platform_role: 'USER', avatar_url: null },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  vi.mocked(useCurrentInstitution).mockReturnValue({
    data: 'inst-1',
    institution: { id: 'inst-1', name: 'Escola', active: true, account_id: 'acc-1' },
    currentInstitution: { id: 'inst-1', name: 'Escola', active: true, account_id: 'acc-1' },
    currentInstitutionId: 'inst-1',
    currentRole: 'DIRECTOR',
    isLoading: false,
    isError: false,
    error: null,
    message: null,
    membership: { id: 'm-1', institution_id: 'inst-1', role: 'DIRECTOR', active: true },
    currentMembership: { id: 'm-1', institution_id: 'inst-1', role: 'DIRECTOR', active: true },
    refetch: vi.fn(),
  });

  vi.mocked(useAcademicYears).mockReturnValue({
    data: [{ id: 'year-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useClasses).mockReturnValue({
    data: [{ id: 'class-1', name: '1A', active: true, academic_year_id: 'year-1', institution_id: 'inst-1', academic_year_name: '2026', grade_level: null, shift: null, capacity: 30, active_enrollments_count: 0, active_offerings_count: 2, active_curriculum_items_count: 2 }],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useAssignments).mockReturnValue({
    data: [
      { id: 'off-1', class_id: 'class-1', subject_id: 'subj-1', teacher_profile_id: 'prof-1', term_id: 'term-1', active: true, class_name: '1A', subject_name: 'Português', teacher_name: 'Prof Silva', term_name: '1º Bimestre', academic_year_id: 'year-1', class_grade_level: null, class_shift: null, subject_code: 'LP' },
      { id: 'off-2', class_id: 'class-1', subject_id: 'subj-2', teacher_profile_id: 'prof-2', term_id: 'term-1', active: true, class_name: '1A', subject_name: 'Matemática', teacher_name: 'Prof Souza', term_name: '1º Bimestre', academic_year_id: 'year-1', class_grade_level: null, class_shift: null, subject_code: 'MAT' },
    ],
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useRooms).mockReturnValue({
    data: baseRooms,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  vi.mocked(useTimetableEntries).mockReturnValue({
    data: baseEntries,
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

function renderTab(route = '/admin?module=timetable') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin" element={<TimetableTab />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaultHooks();
});

afterEach(() => {
  cleanup();
});

describe('TimetableTab', () => {
  it('renderiza grade horaria com entradas', () => {
    renderTab();
    expect(screen.getByText('Português')).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Prof Silva')).toBeTruthy();
    expect(screen.getByText('Prof Souza')).toBeTruthy();
  });

  it('mostra horarios na grade', () => {
    renderTab();
    expect(screen.getAllByText(/07:00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/07:50/).length).toBeGreaterThanOrEqual(1);
  });

  it('mostra sala na celula da grade', () => {
    renderTab();
    expect(screen.getByText('Sala 01')).toBeTruthy();
  });

  it('mostra sub-navegacao Grade Horaria e Salas', () => {
    renderTab();
    expect(screen.getByText('Grade Horária')).toBeTruthy();
    expect(screen.getByText('Salas')).toBeTruthy();
  });

  it('filtra por turma', () => {
    renderTab();
    const classSelect = screen.getByLabelText(/turma/i);
    expect(classSelect).toBeTruthy();
  });

  it('filtra por dia da semana', () => {
    renderTab();
    const daySelect = screen.getByLabelText(/dia da semana/i);
    expect(daySelect).toBeTruthy();
  });

  it('abre modal de criacao ao clicar em Adicionar horario', () => {
    renderTab();
    const buttons = screen.getAllByText(/Adicionar horário/i);
    fireEvent.click(buttons[0]);
    expect(screen.getByLabelText(/disciplina \/ professor \/ período/i)).toBeTruthy();
  });

  it('mostra estado de carregamento', () => {
    vi.mocked(useCurrentInstitution).mockReturnValue({
      data: 'inst-1',
      isLoading: true,
      isError: false,
      error: null,
      institution: null,
      currentInstitution: null,
      currentInstitutionId: null,
      currentRole: null,
      membership: null,
      currentMembership: null,
      refetch: vi.fn(),
      message: null,
    });
    renderTab();
    expect(screen.getByText(/carregando instituição/i)).toBeTruthy();
  });

  it('alterna para visualizacao de salas', () => {
    renderTab();
    fireEvent.click(screen.getByText('Salas'));
    expect(screen.getByText('Sala 01')).toBeTruthy();
    expect(screen.getByText('Sala 02')).toBeTruthy();
  });

  it('abre modal de sala ao clicar em Adicionar sala', () => {
    renderTab();
    fireEvent.click(screen.getByText('Salas'));
    fireEvent.click(screen.getByText(/Adicionar sala/i));
    expect(screen.getByLabelText(/nome da sala/i)).toBeTruthy();
  });
});
