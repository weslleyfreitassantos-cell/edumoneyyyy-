// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PLATFORM_ORIGIN } from '../lib/subdomain';
import { SubdomainForbiddenPage } from './SubdomainForbiddenPage';

describe('SubdomainForbiddenPage', () => {
  it('sends the user to the current administrative login', () => {
    render(<SubdomainForbiddenPage />);

    expect(
      screen
        .getByRole('link', { name: 'Ir para a plataforma' })
        .getAttribute('href'),
    ).toBe(`${PLATFORM_ORIGIN}/login`);
  });
});
