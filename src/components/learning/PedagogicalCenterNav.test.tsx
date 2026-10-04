// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PedagogicalCenterNav } from './PedagogicalCenterNav';

describe('PedagogicalCenterNav', () => {
  it('mantém somente os destinos essenciais do professor', () => {
    render(<MemoryRouter initialEntries={['/teacher/pedagogical-center']}><PedagogicalCenterNav /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Turma' }).getAttribute('href')).toBe('/teacher/pedagogical-center');
    expect(screen.getByRole('link', { name: 'Alunos' }).getAttribute('href')).toBe('/teacher/pedagogical-center/students');
    expect(screen.queryByRole('link', { name: 'Conteúdos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Resultados' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Jornadas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Revisão' })).toBeNull();
  });
});
