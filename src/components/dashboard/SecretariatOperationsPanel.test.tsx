// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { academicReportService } from '../../services/academicReportService';
import SecretariatOperationsPanel from './SecretariatOperationsPanel';

vi.mock('../../services/academicReportService', () => ({
  academicReportService: { getSecretariatOperationsSummary: vi.fn() },
}));

const summary = {
  studentsWithoutClass: 3,
  pendingDocuments: 2,
  classesWithVacancies: 4,
  availableSeats: 17,
};

function renderPanel(props: Partial<ComponentProps<typeof SecretariatOperationsPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SecretariatOperationsPanel
        institutionId="institution-1"
        academicYearId="year-1"
        availableModuleIds={['enrollments', 'academic-documents', 'classes', 'academic-years']}
        {...props}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SecretariatOperationsPanel', () => {
  it('mostra indicadores e navega apenas para módulos disponíveis', async () => {
    vi.mocked(academicReportService.getSecretariatOperationsSummary).mockResolvedValue(summary);
    const navigate = vi.fn();

    renderPanel({ onNavigateToModule: navigate });

    expect(await screen.findByRole('button', { name: /Alunos ativos sem turma: 3\. Abrir módulo/i })).toBeTruthy();
    expect(screen.getByText('Documentos para revisar')).toBeTruthy();
    expect(screen.getByText('Turmas com vagas')).toBeTruthy();
    expect(screen.getByText('17')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Documentos para revisar: 2\. Abrir módulo/i }));
    expect(navigate).toHaveBeenCalledWith('academic-documents');
  });

  it('não transforma indicadores em links sem o módulo permitido', async () => {
    vi.mocked(academicReportService.getSecretariatOperationsSummary).mockResolvedValue(summary);

    renderPanel({ availableModuleIds: ['enrollments'] });

    expect(await screen.findByText('Documentos para revisar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Documentos para revisar/i })).toBeNull();
  });

  it('não consulta nem apresenta zeros quando não existe ano letivo ativo', () => {
    renderPanel({ academicYearId: null });

    expect(screen.getByText(/Não há ano letivo ativo selecionado/i)).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    expect(academicReportService.getSecretariatOperationsSummary).not.toHaveBeenCalled();
  });
});
