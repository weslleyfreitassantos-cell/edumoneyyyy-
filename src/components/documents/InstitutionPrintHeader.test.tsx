// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/InstitutionContext', () => ({
  useOptionalInstitution: () => null,
}));

import { InstitutionPrintHeader } from './InstitutionPrintHeader';

describe('InstitutionPrintHeader', () => {
  it('renders the selected school logo and brand color', () => {
    render(
      <InstitutionPrintHeader
        institution={{
          name: 'Escola de Teste',
          logo_url: 'https://assets.example.test/logo.png',
          primary_color: '#123456',
        }}
        documentTitle="Declaração de frequência"
      />,
    );

    expect(screen.getByRole('img', { name: 'Logo de Escola de Teste' }).getAttribute('src'))
      .toBe('https://assets.example.test/logo.png');
    expect(screen.getByRole('banner').getAttribute('style'))
      .toContain('--institution-print-primary: #123456');
    expect(screen.getByRole('heading', { name: 'Declaração de frequência' })).toBeTruthy();
  });
});
