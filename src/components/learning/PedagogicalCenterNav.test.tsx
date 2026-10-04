// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PedagogicalCenterNav } from './PedagogicalCenterNav';

describe('PedagogicalCenterNav', () => {
  it('prioriza acompanhamento e pacotes como destinos da central', () => {
    render(<MemoryRouter initialEntries={['/teacher/pedagogical-center']}><PedagogicalCenterNav /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Acompanhamento' }).getAttribute('href')).toBe('/teacher/pedagogical-center');
    expect(screen.getByRole('link', { name: 'Pacotes' }).getAttribute('href')).toBe('/teacher/pedagogical-center/content');
    expect(screen.queryByRole('link', { name: 'Atribuir trilha' })).toBeNull();
  });
});
