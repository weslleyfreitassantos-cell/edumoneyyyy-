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
  useRemoveInstitutionFavicon,
  useRemoveInstitutionLogo,
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
  useSaveInstitutionLogo: vi.fn(),
  useRemoveInstitutionLogo: vi.fn(),
  useSaveInstitutionFavicon: vi.fn(),
  useRemoveInstitutionFavicon: vi.fn(),
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
const mockedUseSaveInstitutionFavicon = vi.mocked(useSaveInstitutionFavicon);
const mockedUseRemoveInstitutionFavicon = vi.mocked(useRemoveInstitutionFavicon);
const mockedUpdateInstitutionBranding = vi.mocked(updateInstitutionBranding);

const refresh = vi.fn(async () => undefined);
const saveLogo = vi.fn();
const removeLogo = vi.fn();
const saveFavicon = vi.fn();
const removeFavicon = vi.fn();

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
  mockedUpdateInstitutionBranding.mockResolvedValue({
    id: 'institution-1',
    name: 'Escola Luz',
    subdomain: 'escola-luz',
    login_display_name: 'Login Luz Atualizado',
    logo_url: 'https://cdn.example.com/logo.png',
    favicon_url: 'https://cdn.example.com/favicon.png',
    primary_color: '#223344',
    secondary_color: '#ddeeff',
    active: true,
    account_id: 'account-1',
  });
});

afterEach(() => {
  cleanup();
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
