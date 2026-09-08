// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  schoolEmailService,
  type SchoolEmailRecipient,
} from '../../../services/schoolEmailService';
import EmailTab from './EmailTab';

const listRecipientsMock = vi.mocked(schoolEmailService.listRecipients);
const previewMock = vi.mocked(schoolEmailService.preview);
const sendMock = vi.mocked(schoolEmailService.send);

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

vi.mock('../../../services/schoolEmailService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/schoolEmailService')>(
    '../../../services/schoolEmailService',
  );
  return {
    ...actual,
    schoolEmailService: {
      listRecipients: vi.fn(),
      preview: vi.fn(),
      send: vi.fn(),
    },
  };
});

const recipients: SchoolEmailRecipient[] = [
  { id: 'STUDENT:student-1', kind: 'STUDENT', name: 'Ana Silva', email: 'ana@example.com' },
  { id: 'GUARDIAN:guardian-1', kind: 'GUARDIAN', name: 'Bruno Silva', email: 'bruno@example.com' },
  { id: 'TEACHER:teacher-1', kind: 'TEACHER', name: 'Carla Souza', email: 'carla@example.com' },
  { id: 'STUDENT:student-2', kind: 'STUDENT', name: 'Sem E-mail', email: null },
];

describe('EmailTab', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      profile: {
        id: 'director-1',
        full_name: 'Diretor',
        email: 'director@example.com',
        role: 'DIRECTOR',
        platform_role: 'USER',
        avatar_url: null,
      },
    } as never);
    vi.mocked(useCurrentInstitution).mockReturnValue({
      data: 'institution-1',
      institution: {
        id: 'institution-1',
        name: 'Escola Azul',
        active: true,
        account_id: null,
        primary_color: '#123456',
        secondary_color: '#abcdef',
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    listRecipientsMock.mockResolvedValue(recipients);
    previewMock.mockResolvedValue({
      recipientCount: 2,
      recipientsWithoutEmail: 1,
      previewHtml: '<p>preview</p>',
    });
    sendMock.mockResolvedValue({
      recipientCount: 2,
      sentCount: 2,
      recipientsWithoutEmail: 1,
      failedCount: 0,
    });
  });

  it('exibe campos de mensagem e a identidade da instituição', async () => {
    render(<EmailTab />);

    expect(await screen.findByLabelText('Assunto *')).toBeDefined();
    expect(screen.getByLabelText('Mensagem *')).toBeDefined();
    expect(screen.getByText('Cor primária')).toBeDefined();
    expect(screen.getByText('3 destinatário(s)')).toBeDefined();
  });

  it('filtra e seleciona pessoas específicas sem aceitar e-mail arbitrário', async () => {
    render(<EmailTab />);

    await screen.findByLabelText('Assunto *');
    fireEvent.click(screen.getByLabelText('Pessoas específicas'));
    const search = screen.getByLabelText('Buscar pessoa');
    fireEvent.change(search, { target: { value: 'bruno' } });

    expect(screen.getByText('Bruno Silva')).toBeDefined();
    expect(screen.queryByText('Ana Silva')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /Bruno Silva/ }));
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('Mensagem *'), { target: { value: 'Olá {{nome}}' } });
    fireEvent.click(screen.getByRole('button', { name: /Pré-visualizar/ }));

    await waitFor(() => expect(previewMock).toHaveBeenCalled());
    const payload = previewMock.mock.calls[0][0];
    expect(payload.audience).toBe('SELECTED');
    expect(payload.selectedRecipientIds).toEqual(['GUARDIAN:guardian-1']);
    expect(payload).not.toHaveProperty('emails');
  });

  it('oferece todos os professores como destinatários', async () => {
    render(<EmailTab />);

    await screen.findByLabelText('Assunto *');
    fireEvent.click(screen.getByLabelText('Todos os professores'));

    expect(screen.getByText('1 destinatário(s)')).toBeDefined();
  });

  it('mantém a confirmação até o envio explícito', async () => {
    render(<EmailTab />);

    await screen.findByLabelText('Assunto *');
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Aviso' } });
    fireEvent.change(screen.getByLabelText('Mensagem *'), { target: { value: 'Mensagem' } });
    fireEvent.click(screen.getByRole('button', { name: /Pré-visualizar/ }));

    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByText(/2 destinatário\(s\) serão processados/)).toBeDefined();
    expect(sendMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar e-mail' }));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());
  });
});
