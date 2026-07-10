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
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const user = {
    id: 'user-1',
} as User;

const adminProfile: Profile = {
    id: 'user-1',
    full_name: 'Administrador',
    email: 'admin@example.com',
    avatar_url: null,
    role: 'ADMIN',
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
                    path="/protected"
                    element={
                        <ProtectedRoute allowedRoles={allowedRoles}>
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

    it('envia papéis sem permissão para acesso não autorizado', () => {
        mockedUseAuth.mockReturnValue(
            createAuthState({
                user,
                profile: adminProfile,
            }),
        );

        renderProtectedRoute(['DIRECTOR']);

        expect(
            screen.getByText('Acesso não autorizado'),
        ).toBeTruthy();
    });
});