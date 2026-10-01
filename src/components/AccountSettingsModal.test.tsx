// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AccountSettingsModal from './AccountSettingsModal';

const baseProps = {
  currentName: 'Ana Silva',
  email: 'ana@example.com',
  returnFocusRef: { current: null },
  onClose: vi.fn(),
  onUpdateName: vi.fn(async () => undefined),
  currentAvatar: 'https://example.com/avatar.webp',
  onUpdateAvatar: vi.fn(async () => undefined),
  onRemoveAvatar: vi.fn(async () => undefined),
  onUpdateSelfRegistration: vi.fn(async () => undefined),
  onUpdatePassword: vi.fn(async () => undefined),
  onSuccess: vi.fn(),
  currentRole: 'admin' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:profile-preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AccountSettingsModal', () => {
  it('aceita uma foto maior que 5 MB e exibe a imagem completa', async () => {
    render(<AccountSettingsModal {...baseProps} />);

    expect(screen.getByText('JPG, PNG ou WebP')).toBeTruthy();
    expect(screen.queryByText(/5 MB/i)).toBeNull();
    expect(screen.getByAltText('Foto de Ana Silva').className).toContain(
      'object-contain',
    );

    const file = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'foto-grande.png',
      { type: 'image/png' },
    );
    const input = screen.getByLabelText('Alterar foto');

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar foto' }));

    await waitFor(() => {
      expect(baseProps.onUpdateAvatar).toHaveBeenCalledWith(file);
    });
  });
});
