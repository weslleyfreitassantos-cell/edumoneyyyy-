// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { InstitutionBrandingSection } from './InstitutionBrandingSection';

const brandingMocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../hooks/useInstitutionBranding', () => ({
  useSaveInstitutionLogo: () => ({
    mutateAsync: brandingMocks.save,
    isPending: false,
    error: null,
  }),
  useRemoveInstitutionLogo: () => ({
    mutateAsync: brandingMocks.remove,
    isPending: false,
    error: null,
  }),
}));

describe('InstitutionBrandingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    brandingMocks.save.mockResolvedValue({
      id: 'institution-1',
      name: 'Escola Centro',
      logoUrl: 'https://storage.example.com/logo.png?v=2',
      publicSlug: 'escola-centro',
      logoPath: 'institution-1/logo.png',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('mostra imediatamente a logo retornada depois de salvar', async () => {
    const { container } = render(
      <InstitutionBrandingSection
        institutionId="institution-1"
        institutionName="Escola Centro"
        currentLogoUrl="https://storage.example.com/logo.png?v=1"
        currentPublicSlug="escola-centro"
      />,
    );

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['logo'], 'logo.png', {
      type: 'image/png',
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar logo',
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('status').textContent,
      ).toContain('Logo salva com sucesso.');
    });

    expect(
      (screen.getByAltText('Logo') as HTMLImageElement).src,
    ).toBe('https://storage.example.com/logo.png?v=2');
  });
});
