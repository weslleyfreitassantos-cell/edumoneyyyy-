// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  listInclusiveAeePlans,
  listInclusivePeiPlans,
  listInclusiveStudents,
  saveInclusiveAeePlan,
  saveInclusivePeiPlan,
} from '../../services/inclusiveEducationService';
import InclusiveEducationPage from './InclusiveEducationPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: vi.fn() }));

vi.mock('../../services/inclusiveEducationService', () => ({
  INCLUSIVE_EDUCATION_DATA_ENABLED: true,
  listInclusiveAeePlans: vi.fn(),
  listInclusivePeiPlans: vi.fn(),
  listInclusiveStudents: vi.fn(),
  printInclusiveDocument: vi.fn(),
  saveInclusiveAeePlan: vi.fn(),
  saveInclusivePeiPlan: vi.fn(),
}));

vi.mock('../../services/pedagogicalMonitoringService', () => ({
  pedagogicalMonitoringService: {
    getInstitutionMonitoring: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);
const mockedListStudents = vi.mocked(listInclusiveStudents);
const mockedListPei = vi.mocked(listInclusivePeiPlans);
const mockedListAee = vi.mocked(listInclusiveAeePlans);
const mockedSavePei = vi.mocked(saveInclusivePeiPlan);
const mockedSaveAee = vi.mocked(saveInclusiveAeePlan);

function renderInclusivePage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <InclusiveEducationPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    profile: { id: 'director-1', full_name: 'Direção QA' },
  } as ReturnType<typeof useAuth>);
  mockedUseInstitution.mockReturnValue({
    currentInstitutionId: 'institution-1',
  } as ReturnType<typeof useInstitution>);
  mockedListStudents.mockResolvedValue([{ id: 'student-1', name: 'Estudante QA' }]);
  mockedListPei.mockResolvedValue([]);
  mockedListAee.mockResolvedValue([]);
  mockedSavePei.mockResolvedValue(undefined);
  mockedSaveAee.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('InclusiveEducationPage PEI/AEE access', () => {
  it('loads an authorized student and saves a PEI draft from the interactive form', async () => {
    renderInclusivePage('/inclusive-education/pei');

    const studentSelect = await screen.findByLabelText('Estudante');
    expect((studentSelect as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByText(/Modo seguro de preparação/i)).toBeNull();

    fireEvent.change(studentSelect, { target: { value: 'student-1' } });
    const strengths = screen.getByLabelText('Pontos fortes');
    expect((strengths as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.change(strengths, { target: { value: 'Aprende com atividades visuais.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(mockedSavePei).toHaveBeenCalledWith(
        'institution-1',
        'director-1',
        expect.objectContaining({
          student_id: 'student-1',
          strengths: 'Aprende com atividades visuais.',
        }),
        undefined,
      );
    });
  });

  it('loads an authorized student and saves an AEE draft from the interactive form', async () => {
    renderInclusivePage('/inclusive-education/aee-paee');

    const studentSelect = await screen.findByLabelText('Estudante');
    expect((studentSelect as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByText(/Modo seguro de preparação/i)).toBeNull();

    fireEvent.change(studentSelect, { target: { value: 'student-1' } });
    fireEvent.change(screen.getByLabelText('Objetivo do atendimento'), {
      target: { value: 'Ampliar comunicação funcional.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(mockedSaveAee).toHaveBeenCalledWith(
        'institution-1',
        'director-1',
        expect.objectContaining({
          student_id: 'student-1',
          responsible_profile_id: 'director-1',
          objectives: 'Ampliar comunicação funcional.',
        }),
        undefined,
      );
    });
  });
});
