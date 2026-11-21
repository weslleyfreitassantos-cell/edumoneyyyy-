// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  applyDocumentTitle,
  applyDocumentBranding,
  applyDocumentFavicon,
  defaultFaviconHref,
  fallbackDocumentTitle,
} from './documentBranding';

afterEach(() => {
  document.title = '';
  document.head.innerHTML = '';
  document.documentElement.style.removeProperty('--brand-primary');
  document.documentElement.style.removeProperty('--brand-secondary');
});

describe('applyDocumentBranding', () => {
  it('atualiza somente o favicon quando a marca carregada muda', () => {
    document.title = 'Título atual';
    document.documentElement.style.setProperty('--brand-primary', '#123456');

    applyDocumentFavicon({
      scope: 'INSTITUTION',
      displayName: 'Colégio',
      logoUrl: null,
      faviconUrl: 'https://cdn.example.com/school.png',
      primaryColor: '#abcdef',
      secondaryColor: '#fedcba',
    });

    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href)
      .toBe('https://cdn.example.com/school.png');
    expect(document.title).toBe('Título atual');
    expect(document.documentElement.style.getPropertyValue('--brand-primary'))
      .toBe('#123456');
  });

  it('preserva o favicon existente quando a identidade nao define outro', () => {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = '/custom-favicon.png';
    document.head.appendChild(favicon);

    applyDocumentFavicon({
      scope: 'INSTITUTION',
      displayName: 'Colégio',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#abcdef',
      secondaryColor: '#fedcba',
    });

    expect(favicon.href).toContain('/custom-favicon.png');
  });

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

  it('prioriza o nome da instituição no título da aba sem alterar o nome de exibição', () => {
    applyDocumentBranding({
      scope: 'INSTITUTION',
      documentTitle: 'Colégio Helita Vieira',
      displayName: 'Portal Acadêmico',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });

    expect(document.title).toBe('Colégio Helita Vieira');
  });

  it('permite atualizar o título da instituição antes de carregar imagens de marca', () => {
    applyDocumentTitle({
      scope: 'INSTITUTION',
      documentTitle: 'Colégio Helita Vieira',
      displayName: 'Portal Acadêmico',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });

    expect(document.title).toBe('Colégio Helita Vieira');
  });

  it('usa Tec Escola quando a identidade ainda nao tem nome', () => {
    applyDocumentBranding({
      scope: 'FALLBACK',
      displayName: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#005bbf',
      secondaryColor: '#55e6b5',
    });

    expect(document.title).toBe('Tec Escola');
  });

  it('usa Tec Escola como título padrão antes de carregar a identidade', () => {
    expect(fallbackDocumentTitle).toBe('Tec Escola');
  });

  it('mantem um favicon quadrado da Tec Escola sem favicon personalizado', () => {
    applyDocumentBranding({
      scope: 'FALLBACK',
      displayName: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#005bbf',
      secondaryColor: '#55e6b5',
    });

    expect(
      document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href,
    ).toContain(defaultFaviconHref);
  });
});
