// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { PsychologyRouteGate } from './PsychologyRouteGate';
import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { usePsychologyModuleStatus } from '../hooks/usePsychologyModuleStatus';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/InstitutionContext', () => ({ useInstitution: vi.fn() }));
vi.mock('../hooks/usePsychologyModuleStatus', () => ({ usePsychologyModuleStatus: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="current-route">{location.pathname}</p>;
}

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/psychology/*" element={<PsychologyRouteGate><><p>Conteúdo protegido</p><LocationProbe /></></PsychologyRouteGate>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockAuth = vi.mocked(useAuth);
const mockInstitution = vi.mocked(useInstitution);
const mockStatus = vi.mocked(usePsychologyModuleStatus);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PsychologyRouteGate', () => {
  it('redirects clinical users when the module is disabled', () => {
    mockAuth.mockReturnValue({ profile: { id: 'student-1', role: 'STUDENT' } } as ReturnType<typeof useAuth>);
    mockInstitution.mockReturnValue({ currentInstitutionId: 'school-1', currentRole: 'STUDENT' } as ReturnType<typeof useInstitution>);
    mockStatus.mockReturnValue({ state: 'disabled', canManage: false });

    renderGate('/psychology/agendar');

    expect(screen.getByTestId('current-route').textContent).toBe('/dashboard');
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
  });

  it('keeps the authorized director configuration reachable while disabled', () => {
    mockAuth.mockReturnValue({ profile: { id: 'director-1', role: 'DIRECTOR' } } as ReturnType<typeof useAuth>);
    mockInstitution.mockReturnValue({ currentInstitutionId: 'school-1', currentRole: 'DIRECTOR' } as ReturnType<typeof useInstitution>);
    mockStatus.mockReturnValue({ state: 'disabled', canManage: true });

    renderGate('/psychology/configuracao');

    expect(screen.getByText('Conteúdo protegido')).not.toBeNull();
  });

  it('redirects the student authorization route into the booking flow', () => {
    mockAuth.mockReturnValue({ profile: { id: 'student-1', role: 'STUDENT' } } as ReturnType<typeof useAuth>);
    mockInstitution.mockReturnValue({ currentInstitutionId: 'school-1', currentRole: 'STUDENT' } as ReturnType<typeof useInstitution>);
    mockStatus.mockReturnValue({ state: 'enabled', canManage: false });

    renderGate('/psychology/autorizacao');

    expect(screen.getByTestId('current-route').textContent).toBe('/psychology/agendar');
    expect(screen.getByText('Conteúdo protegido')).not.toBeNull();
  });

  it.each([
    ['responsável', 'GUARDIAN', 'guardian-1'],
    ['psicóloga', 'PSYCHOLOGIST', 'psychologist-1'],
  ])('blocks direct clinical URLs for %s while disabled', (_label, role, profileId) => {
    mockAuth.mockReturnValue({ profile: { id: profileId, role } } as ReturnType<typeof useAuth>);
    mockInstitution.mockReturnValue({ currentInstitutionId: 'school-1', currentRole: role } as ReturnType<typeof useInstitution>);
    mockStatus.mockReturnValue({ state: 'disabled', canManage: false });

    renderGate(role === 'GUARDIAN' ? '/psychology/autorizacao' : '/psychology/agenda');

    expect(screen.getByTestId('current-route').textContent).toBe('/dashboard');
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
  });

  it('keeps configuration for an explicitly authorized secretary and blocks it otherwise', () => {
    mockAuth.mockReturnValue({ profile: { id: 'secretary-1', role: 'SECRETARY' } } as ReturnType<typeof useAuth>);
    mockInstitution.mockReturnValue({ currentInstitutionId: 'school-1', currentRole: 'SECRETARY' } as ReturnType<typeof useInstitution>);
    mockStatus.mockReturnValue({ state: 'disabled', canManage: false });
    const denied = renderGate('/psychology/configuracao');
    expect(screen.getByTestId('current-route').textContent).toBe('/admin');
    denied.unmount();

    mockStatus.mockReturnValue({ state: 'disabled', canManage: true });
    renderGate('/psychology/configuracao');
    expect(screen.getByText('Conteúdo protegido')).not.toBeNull();
  });
});
