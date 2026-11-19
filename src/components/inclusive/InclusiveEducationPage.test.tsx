// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  listInclusiveAeePlans,
  listInclusivePeiPlans,
  listInclusiveStudents,
} from '../../services/inclusiveEducationService';
import InclusiveEducationPage from './InclusiveEducationPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
  useOptionalInstitution: () => null,
}));

const serviceMocks = vi.hoisted(() => ({
  listInclusiveAeePlans: vi.fn(),
  listInclusivePeiPlans: vi.fn(),
  listInclusiveStudents: vi.fn(),
  printInclusiveDocument: vi.fn(),
  saveInclusivePeiPlan: vi.fn(),
}));

vi.mock('../../services/inclusiveEducationService', () => ({
  INCLUSIVE_EDUCATION_DATA_ENABLED: false,
  ...serviceMocks,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);
const mockedListAee = vi.mocked(listInclusiveAeePlans);
const mockedListPei = vi.mocked(listInclusivePeiPlans);
const mockedListStudents = vi.mocked(listInclusiveStudents);

function renderPage(path: string) {
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
});

afterEach(cleanup);

describe('InclusiveEducationPage safe mode', () => {
  it.each([
    ['/inclusive-education/pei', 'Planejamento individualizado'],
    ['/inclusive-education/aee-paee', 'Planejamento e registro do atendimento'],
  ])('keeps sensitive forms read-only at %s', (path, heading) => {
    renderPage(path);

    expect(screen.getByText('Modo seguro de preparação.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByText('Somente visualização')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Imprimir documento' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('textbox').every((field) => (field as HTMLTextAreaElement).disabled)).toBe(true);
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true);
  });

  it('shows no fictitious progress and does not make disabled persistence requests', () => {
    renderPage('/inclusive-education/progress');

    const status = screen.getByText('Nenhum registro de evolução disponível').closest('section');
    expect(status).not.toBeNull();
    expect(within(status as HTMLElement).getByText(/Não há gráficos ou resultados fictícios/)).toBeTruthy();
    expect(mockedListPei).not.toHaveBeenCalled();
    expect(mockedListAee).not.toHaveBeenCalled();
    expect(mockedListStudents).not.toHaveBeenCalled();
  });

  it('keeps the authored activity catalog accessible without loading student records', () => {
    renderPage('/inclusive-education/activities');

    expect(screen.getByRole('heading', { name: 'Biblioteca de Atividades' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Pesquisar atividade' })).toBeTruthy();
    expect(mockedListPei).not.toHaveBeenCalled();
    expect(mockedListAee).not.toHaveBeenCalled();
    expect(mockedListStudents).not.toHaveBeenCalled();
  });
});
