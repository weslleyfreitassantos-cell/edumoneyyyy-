import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useAdminOverview', () => ({
  useAdminOverview: vi.fn(),
}));

vi.mock('../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: vi.fn(),
}));

import { getDirectorDashboardTitle } from './DirectorDashboard';

describe('getDirectorDashboardTitle', () => {
  it('diferencia o painel visual do administrador', () => {
    expect(
      getDirectorDashboardTitle('ADMIN'),
    ).toBe('Painel do Administrador');
  });

  it('diferencia o painel visual do diretor', () => {
    expect(
      getDirectorDashboardTitle('DIRECTOR'),
    ).toBe('Painel do Diretor');
  });
});
