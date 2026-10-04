// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PedagogicalCenterNav } from './PedagogicalCenterNav';

describe('PedagogicalCenterNav', () => {
  it('prioriza decisões pedagógicas como destinos da central', () => {
    render(<MemoryRouter initialEntries={['/teacher/pedagogical-center']}><PedagogicalCenterNav /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Visão da turma' }).getAttribute('href')).toBe('/teacher/pedagogical-center');
    expect(screen.getByRole('link', { name: 'Conteúdos' }).getAttribute('href')).toBe('/teacher/pedagogical-center/content');
    expect(screen.getByRole('link', { name: 'Resultados' }).getAttribute('href')).toBe('/teacher/pedagogical-center/map');
    expect(screen.queryByRole('link', { name: 'Jornadas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Revisão' })).toBeNull();
  });
});
