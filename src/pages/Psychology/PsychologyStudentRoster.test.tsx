// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ listManagementCandidates: vi.fn() }));
vi.mock('../../services/psychologyService', () => ({ psychologyService: service }));

import PsychologyStudentRoster from './PsychologyStudentRoster';

const professional = {
  profile_id: 'psychologist-1',
  full_name: 'Profissional de teste',
  email: 'psychologist@local.test',
  registered: true,
  verification_status: 'VERIFIED' as const,
  crp_registration: '00000',
  crp_state: 'BA',
  linked: true,
};

function response(page = 1, students = [person('profile-1', 'Estudante de teste')], total = students.length) {
  return {
    professionals: [professional],
    students,
    page,
    page_size: 20,
    total,
    total_pages: Math.max(1, Math.ceil(total / 20)),
    filters: {
      classes: [{ id: 'class-1', name: 'Turma A', grade_level: '7º ano', academic_year_name: '2026' }],
      grades: ['7º ano'],
    },
  };
}

function person(profileId: string, fullName: string, registrations = [registration('student-1', 'MAT-001')]) {
  return { profile_id: profileId, full_name: fullName, registrations };
}

function registration(studentId: string, number: string, assigned = false) {
  return {
    student_id: studentId,
    registration_number: number,
    assigned,
    assigned_professionals: assigned ? [{ profile_id: professional.profile_id, full_name: professional.full_name }] : [],
    authorization_status: 'ACTIVE' as const,
    enrollments: [{ class_id: 'class-1', class_name: 'Turma A', grade_level: '7º ano', academic_year_id: 'year-1', academic_year_name: '2026' }],
  };
}

function renderRoster() {
  return render(<PsychologyStudentRoster
    institutionId="institution-1"
    professionals={[professional]}
    busy={false}
    refreshKey={0}
    onProfessionalsLoaded={vi.fn()}
    onAssign={vi.fn().mockResolvedValue(undefined)}
    onUnassign={vi.fn().mockResolvedValue(undefined)}
  />);
}

afterEach(() => {
  cleanup();
  service.listManagementCandidates.mockReset();
});

describe('PsychologyStudentRoster', () => {
  it('mantém a busca estável quando o callback do painel pai muda de identidade', async () => {
    service.listManagementCandidates.mockResolvedValue(response());
    const assign = vi.fn().mockResolvedValue(undefined);
    const unassign = vi.fn().mockResolvedValue(undefined);
    const professionalsLoaded = vi.fn();
    const props = {
      institutionId: 'institution-1',
      professionals: [professional],
      busy: false,
      refreshKey: 0,
      onAssign: assign,
      onUnassign: unassign,
    };

    const view = render(<PsychologyStudentRoster {...props} onProfessionalsLoaded={professionalsLoaded} />);
    await screen.findByRole('row', { name: /Estudante de teste/ });
    view.rerender(<PsychologyStudentRoster {...props} onProfessionalsLoaded={vi.fn()} />);

    expect(service.listManagementCandidates).toHaveBeenCalledTimes(1);
  });

  it('encerra o carregamento e mostra o estado vazio quando não há resultados', async () => {
    service.listManagementCandidates.mockResolvedValue(response(1, [], 0));

    renderRoster();

    expect(await screen.findByText('Nenhum estudante encontrado')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('mostra erro e permite tentar a consulta novamente', async () => {
    service.listManagementCandidates
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce(response());

    renderRoster();

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(await screen.findByRole('row', { name: /Estudante de teste/ })).toBeTruthy();
    expect(service.listManagementCandidates).toHaveBeenCalledTimes(2);
  });

  it('agrupa a pessoa por perfil e só mostra matrículas e autorização após seleção', async () => {
    service.listManagementCandidates.mockResolvedValue(response(1, [person('profile-1', 'Estudante de teste', [
      registration('student-1', 'MAT-001', true),
      registration('student-2', 'MAT-002'),
    ])]));

    renderRoster();

    await screen.findByRole('row', { name: /Estudante de teste/ });
    expect(screen.getByText('2 matrículas')).toBeTruthy();
    expect(screen.queryByText(/Matrículas e autorizações de Estudante de teste/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ver \/ vincular/i }));
    expect(await screen.findByRole('region', { name: /detalhes de estudante de teste/i })).toBeTruthy();
    expect(screen.getByText('Matrícula MAT-001')).toBeTruthy();
    expect(screen.getByText('Matrícula MAT-002')).toBeTruthy();
    expect(screen.getAllByText('Autorização ativa')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /vincular matrícula/i })).toHaveLength(2);
  });

  it('envia busca, filtros e página ao servidor e mantém a paginação controlada', async () => {
    service.listManagementCandidates.mockImplementation(async (_institutionId: string, query: { search?: string; classId?: string; gradeLevel?: string; assignmentStatus?: string; page?: number }) => {
      if (query.page === 2) return response(2, [person('profile-2', 'Segunda pessoa')], 21);
      return response(1, [person('profile-1', 'Primeira pessoa')], 21);
    });

    renderRoster();
    await screen.findByRole('row', { name: /Primeira pessoa/ });

    fireEvent.change(screen.getByRole('textbox', { name: /pesquisar estudante/i }), { target: { value: 'MAT-2026' } });
    await waitFor(() => expect(service.listManagementCandidates).toHaveBeenLastCalledWith('institution-1', expect.objectContaining({ search: 'MAT-2026', page: 1, pageSize: 20 })));

    fireEvent.change(screen.getByRole('combobox', { name: /turma/i }), { target: { value: 'class-1' } });
    await waitFor(() => expect(service.listManagementCandidates).toHaveBeenLastCalledWith('institution-1', expect.objectContaining({ classId: 'class-1', search: 'MAT-2026' })));

    fireEvent.change(screen.getByRole('combobox', { name: /série/i }), { target: { value: '7º ano' } });
    fireEvent.change(screen.getByRole('combobox', { name: /acompanhamento/i }), { target: { value: 'ASSIGNED' } });
    await waitFor(() => expect(service.listManagementCandidates).toHaveBeenLastCalledWith('institution-1', expect.objectContaining({ gradeLevel: '7º ano', assignmentStatus: 'ASSIGNED' })));

    fireEvent.click(screen.getByRole('button', { name: /próxima página/i }));
    expect(await screen.findByRole('row', { name: /Segunda pessoa/ })).toBeTruthy();
    expect(service.listManagementCandidates).toHaveBeenLastCalledWith('institution-1', expect.objectContaining({ page: 2, pageSize: 20 }));
  });
});
