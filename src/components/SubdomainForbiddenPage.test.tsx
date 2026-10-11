// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SubdomainForbiddenPage } from './SubdomainForbiddenPage';

vi.mock('../pages/Login', () => ({
  Login: ({ subdomainMismatch }: { subdomainMismatch?: boolean }) => (
    <div data-testid="login-page" data-subdomain-mismatch={String(subdomainMismatch)} />
  ),
}));

describe('SubdomainForbiddenPage', () => {
  it('renders the login page with the school-subdomain warning enabled', () => {
    render(<SubdomainForbiddenPage />);

    expect(
      screen.getByTestId('login-page').getAttribute('data-subdomain-mismatch'),
    ).toBe('true');
  });
});
