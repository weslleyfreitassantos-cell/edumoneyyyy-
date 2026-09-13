// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ActionGroup } from './ActionGroup';

afterEach(() => {
  cleanup();
});

describe('ActionGroup', () => {
  it('preserva os filhos e aceita customização de classe', () => {
    render(
      <ActionGroup className="md:flex-nowrap">
        <button type="button">Editar</button>
        <button type="button">Excluir</button>
      </ActionGroup>,
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' }).parentElement?.className).toContain('md:flex-nowrap');
  });
});
