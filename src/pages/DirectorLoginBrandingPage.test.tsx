// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Suspense, type ReactNode } from 'react';

import { DirectorLoginBrandingRoute } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import {
  useRemoveInstitutionBackground,
  useRemoveInstitutionFavicon,
  useRemoveInstitutionLogo,
  useSaveInstitutionBackground,
  useSaveInstitutionFavicon,
  useSaveInstitutionLogo,
} from '../hooks/useInstitutionBranding';
import { updateInstitutionBranding } from '../services/institutionService';
import { DirectorLoginBrandingPage } from './DirectorLoginBrandingPage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

vi.mock('../hooks/useInstitutionBranding', () => ({
  useSaveInstitutionBackground: vi.fn(),
  useSaveInstitutionLogo: vi.fn(),
  useRemoveInstitutionLogo: vi.fn(),
  useSaveInstitutionFavicon: vi.fn(),
  useRemoveInstitutionFavicon: vi.fn(),
  useRemoveInstitutionBackground: vi.fn(),
}));

vi.mock('../services/institutionService', () => ({
  updateInstitutionBranding: vi.fn(),
}));

vi.mock('../components/AppShell', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);
const mockedUseSaveInstitutionLogo = vi.mocked(useSaveInstitutionLogo);
const mockedUseRemoveInstitutionLogo = vi.mocked(useRemoveInstitutionLogo);
const mockedUseSaveInstitutionBackground = vi.mocked(useSaveInstitutionBackground);
const mockedUseRemoveInstitutionBackground = vi.mocked(useRemoveInstitutionBackground);
const mockedUseSaveInstitutionFavicon = vi.mocked(useSaveInstitutionFavicon);
const mockedUseRemoveInstitutionFavicon = vi.mocked(useRemoveInstitutionFavicon);
const mockedUpdateInstitutionBranding = vi.mocked(updateInstitutionBranding);

const refresh = vi.fn(async () => undefined);
const saveLogo = vi.fn();
const removeLogo = vi.fn();
const saveFavicon = vi.fn();
const removeFavicon = vi.fn();
const saveBackground = vi.fn();
const removeBackground = vi.fn();

function mockDirectorContext(
  overrides: Partial<ReturnType<typeof useInstitution>> = {},
) {
  mockedUseInstitution.mockReturnValue({
    institutions: [],
    currentInstitution: {
      id: 'institution-1',
      name: 'Escola Luz',
      subdomain: 'escola-luz',
      login_display_name: 'Login Luz',
      logo_url: 'https://cdn.example.com/logo.png',
      favicon_url: 'https://cdn.example.com/favicon.png',
      login_background_url: null,
      primary_color: '#123456',
      secondary_color: '#abcdef',
      active: true,
      account_id: 'account-1',
    },
    currentMembership: null,
    currentInstitutionId: 'institution-1',
    currentRole: 'DIRECTOR',
    isLoading: false,
    isSwitchingInstitution: false,
    error: null,
    hasMultipleInstitutions: false,
    setCurrentInstitutionId: vi.fn(),
    clearCurrentInstitutionSelection: vi.fn(),
    refresh,
    ...overrides,
  });
}

function renderPage() {
  render(
    <MemoryRouter>
      <DirectorLoginBrandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Dora Diretora',
      email: 'diretora@example.com',
      role: 'DIRECTOR',
      platform_role: 'USER',
      avatar_url: null,
    },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
  mockDirectorContext();
  mockedUseSaveInstitutionLogo.mockReturnValue({
    mutateAsync: saveLogo,
  } as never);
  mockedUseRemoveInstitutionLogo.mockReturnValue({
    mutateAsync: removeLogo,
  } as never);
  mockedUseSaveInstitutionFavicon.mockReturnValue({
    mutateAsync: saveFavicon,
  } as never);
  mockedUseRemoveInstitutionFavicon.mockReturnValue({
    mutateAsync: removeFavicon,
  } as never);
  mockedUseSaveInstitutionBackground.mockReturnValue({
    mutateAsync: saveBackground,
  } as never);
  mockedUseRemoveInstitutionBackground.mockReturnValue({
    mutateAsync: removeBackground,
  } as never);
  mockedUpdateInstitutionBranding.mockResolvedValue({
    id: 'institution-1',
    name: 'Escola Luz',
    subdomain: 'escola-luz',
    login_display_name: 'Login Luz Atualizado',
    logo_url: 'https://cdn.example.com/logo.png',
    favicon_url: 'https://cdn.example.com/favicon.png',
    login_background_url: null,
    primary_color: '#223344',
    secondary_color: '#ddeeff',
    active: true,
    account_id: 'account-1',
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DirectorLoginBrandingPage', () => {
  it('carrega currentInstitution sem seletor e atualiza o preview', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Personalizar login/i })).toBeTruthy();
    expect(screen.getByDisplayValue('Login Luz')).toBeTruthy();
    expect(screen.getByText(/escola-luz.grupotec.dev.br/i)).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.change(screen.getByLabelText(/Nome exibido/i), {
      target: { value: 'Novo Login Luz' },
    });

    expect(screen.getByText('Novo Login Luz')).toBeTruthy();
  });

  it('salva usando institution.id e nunca subdomain como chave', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/Nome exibido/i), {
      target: { value: 'Login Luz Atualizado' },
    });
    fireEvent.change(screen.getByLabelText(/^Cor principal$/i), {
      target: { value: '#223344' },
    });
    fireEvent.change(screen.getByLabelText(/^Cor secund.ria$/i), {
      target: { value: '#ddeeff' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(() => {
      expect(mockedUpdateInstitutionBranding).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: 'institution-1',
          profileId: 'profile-1',
          login_display_name: 'Login Luz Atualizado',
          primary_color: '#223344',
          secondary_color: '#ddeeff',
        }),
      );
    });

    expect(
      mockedUpdateInstitutionBranding.mock.calls[0][0],
    ).not.toHaveProperty('subdomain');
    expect(
      mockedUpdateInstitutionBranding.mock.calls[0][0],
    ).not.toHaveProperty('currentSubdomain');
    expect(
      screen.getByText(/atualizada com sucesso/i),
    ).toBeTruthy();
  });

  it('mostra feedback de erro quando a persistencia falha', async () => {
    mockedUpdateInstitutionBranding.mockRejectedValueOnce(
      new Error('Falha controlada'),
    );

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    expect(
      await screen.findByText('Falha controlada'),
    ).toBeTruthy();
  });

  it('atualiza o preview de background antes de salvar', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:background-preview'),
      revokeObjectURL: vi.fn(),
    });

    renderPage();
    fireEvent.change(screen.getByLabelText('Selecionar background'), {
      target: {
        files: [new File(['background'], 'background.png', { type: 'image/png' })],
      },
    });

    expect(
      screen
        .getByRole('img', { name: 'Preview do background atual' })
        .getAttribute('style'),
    ).toContain('background-image: url("blob:background-preview")');
  });

  it('abre e fecha a demonstração responsiva sem salvar alterações', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Abrir prévia em celular/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Demonstração do login/i })).toBeTruthy();
    expect(screen.getByText(/Prévia celular/i)).toBeTruthy();
    expect(screen.getByText(/Esta é uma demonstração visual do login/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Voltar para personalização/i }));

    expect(screen.getByRole('heading', { name: /Personalizar login/i })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('salva o background pela mutation específica', async () => {
    saveBackground.mockResolvedValue({
      id: 'institution-1',
      name: 'Escola Luz',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: 'https://cdn.example.com/favicon.png',
      loginBackgroundUrl: 'https://cdn.example.com/background.png?v=1',
      publicSlug: 'escola-luz',
      backgroundPath: 'institution-1/background.png',
    });

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:background-preview'),
      revokeObjectURL: vi.fn(),
    });

    renderPage();
    fireEvent.change(screen.getByLabelText('Selecionar background'), {
      target: {
        files: [new File(['background'], 'background.png', { type: 'image/png' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(() => {
      expect(saveBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: 'institution-1',
          file: expect.any(File),
        }),
      );
    });
  });

  it('remove o background salvo pela mutation específica', async () => {
    mockDirectorContext({
      currentInstitution: {
        id: 'institution-1',
        name: 'Escola Luz',
        subdomain: 'escola-luz',
        login_display_name: 'Login Luz',
        logo_url: 'https://cdn.example.com/logo.png',
        favicon_url: 'https://cdn.example.com/favicon.png',
        login_background_url: 'https://cdn.example.com/background.png?v=1',
        primary_color: '#123456',
        secondary_color: '#abcdef',
        active: true,
        account_id: 'account-1',
      },
    });

    removeBackground.mockResolvedValue({
      id: 'institution-1',
      name: 'Escola Luz',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: 'https://cdn.example.com/favicon.png',
      loginBackgroundUrl: null,
      publicSlug: 'escola-luz',
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Remover background/i }));

    await waitFor(() => {
      expect(removeBackground).toHaveBeenCalledWith(
        expect.objectContaining({ institutionId: 'institution-1' }),
      );
    });
  });
});

describe('DirectorLoginBrandingRoute', () => {
  function renderRoute(currentRole: string | null) {
    mockDirectorContext({ currentRole });

    render(
      <MemoryRouter initialEntries={['/personalizar-login']}>
        <Routes>
          <Route
            path="/unauthorized"
            element={<div>Acesso negado</div>}
          />
          <Route
            path="/personalizar-login"
            element={
              <Suspense fallback={<div>Carregando pagina</div>}>
                <DirectorLoginBrandingRoute />
              </Suspense>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('permite DIRECTOR acessar a rota protegida', async () => {
    renderRoute('DIRECTOR');

    expect(
      await screen.findByRole('heading', { name: /Personalizar login/i }),
    ).toBeTruthy();
  });

  it('bloqueia papel diferente de DIRECTOR', () => {
    renderRoute('ADMIN');

    expect(screen.getByText('Acesso negado')).toBeTruthy();
  });
});
