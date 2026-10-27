// @vitest-environment jsdom

import {
    cleanup,
    render,
    screen,
} from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
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

import {
    useAuth,
    type Profile,
} from '../contexts/AuthContext';
import type { DatabaseRole } from '../lib/roles';
import type { PlatformRole } from '../lib/roles';
import { ProtectedRoute } from './ProtectedRoute';
import { useOptionalInstitution } from '../contexts/InstitutionContext';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));
vi.mock('../contexts/InstitutionContext', () => ({
    useOptionalInstitution: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseOptionalInstitution = vi.mocked(useOptionalInstitution);

const user = {
    id: 'user-1',
} as User;

const adminProfile: Profile = {
    id: 'user-1',
    full_name: 'Administrador',
    email: 'admin@example.com',
    avatar_url: null,
    role: 'ADMIN',
    platform_role: 'USER',
};

function createAuthState(
    overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
    return {
        user: null,
        profile: null,
        loading: false,
        signIn: vi.fn(async () => undefined),
        signOut: vi.fn(async () => undefined),
        ...overrides,
    };
}

function renderProtectedRoute(
    allowedRoles?: DatabaseRole[],
    allowedPlatformRoles?: PlatformRole[],
    deniedRoles?: DatabaseRole[],
    deniedPlatformRoles?: PlatformRole[],
) {
    render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route
                    path="/login"
                    element={<div>Página de login</div>}
                />

                <Route
                    path="/unauthorized"
                    element={<div>Acesso não autorizado</div>}
                />

                <Route
                    path="/dashboard"
                    element={<div>Painel inicial</div>}
                />

                <Route
                    path="/platform"
                    element={<div>Plataforma</div>}
                />

                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute
                            allowedRoles={allowedRoles}
                            allowedPlatformRoles={allowedPlatformRoles}
                            deniedRoles={deniedRoles}
                            deniedPlatformRoles={deniedPlatformRoles}
                        >
                            <div>Conteúdo protegido</div>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedUseOptionalInstitution.mockReturnValue(null);
});

afterEach(() => {
    cleanup();
});

describe('ProtectedRoute', () => {
    it('exibe carregamento enquanto restaura a sessão', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                loading: true,
            }),
        );

        renderProtectedRoute();

        expect(
            screen.getByText('Carregando...'),
        ).toBeTruthy();
    });

    it('mantem a tela ao renovar uma sessão já autenticada', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: adminProfile,
                loading: true,
            }),
        );

        renderProtectedRoute();

        expect(
            screen.getByText('Conteúdo protegido'),
        ).toBeTruthy();
        expect(
            screen.queryByText('Carregando...'),
        ).toBeNull();
    });

    it('envia usuários não autenticados para o login', () => {
        mockedUseAuth.mockReturnValue(createAuthState());

        renderProtectedRoute();

        expect(
            screen.getByText('Página de login'),
        ).toBeTruthy();
    });

    it('bloqueia usuário autenticado sem perfil', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
            }),
        );

        renderProtectedRoute();

        expect(
            screen.getByText('Conta sem perfil válido'),
        ).toBeTruthy();
    });

    it('renderiza o conteúdo para um papel permitido', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: adminProfile,
            }),
        );

        renderProtectedRoute(['ADMIN']);

        expect(
            screen.getByText('Conteúdo protegido'),
        ).toBeTruthy();
    });

    it('autoriza um papel institucional secundário sem elevar privilégios', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, role: 'TEACHER' },
            }),
        );
        mockedUseOptionalInstitution.mockReturnValue({
            currentRole: 'TEACHER',
            currentInstitutionRoles: ['TEACHER', 'PSYCHOLOGIST'],
        } as never);

        renderProtectedRoute(['PSYCHOLOGIST']);

        expect(screen.getByText('Conteúdo protegido')).toBeTruthy();
    });

    it('preserva a negação quando qualquer membership ativa é explicitamente proibida', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, role: 'TEACHER' },
            }),
        );
        mockedUseOptionalInstitution.mockReturnValue({
            currentRole: 'TEACHER',
            currentInstitutionRoles: ['TEACHER', 'ADMIN'],
        } as never);

        renderProtectedRoute(
            ['TEACHER'],
            undefined,
            ['ADMIN'],
        );

        expect(screen.getByText('Painel inicial')).toBeTruthy();
        expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    });

    it('envia papéis sem permissão para acesso não autorizado', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: adminProfile,
            }),
        );

        renderProtectedRoute(['DIRECTOR']);

        expect(
            screen.getByText('Painel inicial'),
        ).toBeTruthy();
    });

    it('autoriza SUPER_ADMIN pela platform_role', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, platform_role: 'SUPER_ADMIN' },
            }),
        );

        renderProtectedRoute(undefined, ['SUPER_ADMIN']);

        expect(
            screen.getByText('Conteúdo protegido'),
        ).toBeTruthy();
    });

    it('bloqueia USER pela platform_role', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, platform_role: 'USER' },
            }),
        );

        renderProtectedRoute(undefined, ['SUPER_ADMIN']);

        expect(
            screen.getByText('Painel inicial'),
        ).toBeTruthy();
    });

    it('autoriza pelo role quando ambos os filtros sao definidos (OR)', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, role: 'DIRECTOR', platform_role: 'USER' },
            }),
        );

        renderProtectedRoute(['ADMIN', 'DIRECTOR', 'SECRETARY'], ['SUPER_ADMIN']);

        expect(
            screen.getByText('Conteúdo protegido'),
        ).toBeTruthy();
    });

    it('autoriza pela platform_role quando ambos os filtros sao definidos (OR)', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, platform_role: 'SUPER_ADMIN' },
            }),
        );

        renderProtectedRoute(['ADMIN', 'DIRECTOR', 'SECRETARY'], ['SUPER_ADMIN']);

        expect(
            screen.getByText('Conteúdo protegido'),
        ).toBeTruthy();
    });

    it('bloqueia quando ambos os filtros sao definidos e nenhum corresponde (OR)', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: { ...adminProfile, role: 'TEACHER', platform_role: 'USER' },
            }),
        );

        renderProtectedRoute(['ADMIN', 'DIRECTOR', 'SECRETARY'], ['SUPER_ADMIN']);

        expect(
            screen.getByText('Painel inicial'),
        ).toBeTruthy();
    });

    it('bloqueia ADMIN mesmo quando uma rota define papéis permitidos', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: adminProfile,
            }),
        );

        renderProtectedRoute(
            ['DIRECTOR', 'SECRETARY', 'TEACHER'],
            undefined,
            ['ADMIN'],
            ['SUPER_ADMIN'],
        );

        expect(screen.getByText('Painel inicial')).toBeTruthy();
        expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    });

    it('bloqueia SUPER_ADMIN mesmo quando o perfil tem papel institucional permitido', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: {
                    ...adminProfile,
                    role: 'DIRECTOR',
                    platform_role: 'SUPER_ADMIN',
                },
            }),
        );

        renderProtectedRoute(
            ['DIRECTOR', 'SECRETARY', 'TEACHER'],
            undefined,
            ['ADMIN'],
            ['SUPER_ADMIN'],
        );

        expect(screen.getByText('Plataforma')).toBeTruthy();
        expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    });
});
