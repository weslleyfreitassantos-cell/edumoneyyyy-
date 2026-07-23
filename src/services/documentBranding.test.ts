// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { applyDocumentBranding } from './documentBranding';

afterEach(() => {
  document.title = '';
  document.head.innerHTML = '';
  document.documentElement.style.removeProperty('--brand-primary');
  document.documentElement.style.removeProperty('--brand-secondary');
});

describe('applyDocumentBranding', () => {
  it('aplica titulo, favicon e cores e restaura no cleanup', () => {
    document.title = 'Anterior';
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = '/favicon-old.png';
    document.head.appendChild(favicon);

    const cleanup = applyDocumentBranding({
      scope: 'GLOBAL',
      displayName: 'Marca Global',
      logoUrl: null,
      faviconUrl: 'https://cdn.example.com/favicon.png',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });

    expect(document.title).toBe('Marca Global');
    expect(
      document.documentElement.style.getPropertyValue(
        '--brand-primary',
      ),
    ).toBe('#112233');
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      )?.href,
    ).toBe('https://cdn.example.com/favicon.png');

    cleanup();

    expect(document.title).toBe('Anterior');
    expect(
      document.documentElement.style.getPropertyValue(
        '--brand-primary',
      ),
    ).toBe('');
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      )?.href,
    ).toContain('/favicon-old.png');
  });
});
