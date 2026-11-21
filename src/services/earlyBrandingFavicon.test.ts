import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const worker = readFileSync(
  new URL('../../worker/index.ts', import.meta.url),
  'utf8',
);
const manifest = JSON.parse(
  readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'),
) as { name: string; short_name: string; icons: Array<{ src: string }> };
const fallbackSvg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
const bootstrap = html.match(
  /<script id="early-favicon-bootstrap">([\s\S]*?)<\/script>/,
)?.[1]?.replace(/\r\n/g, '\n');

if (!bootstrap) {
  throw new Error('The early favicon bootstrap must remain inline in index.html');
}

function applyCachedFavicon(
  cache: unknown,
  hostname = 'colegiocrescimento.grupotec.dev.br',
  existingHref?: string,
) {
  const link = {
    href: existingHref ?? '',
    rel: 'icon',
    isConnected: Boolean(existingHref),
    removeAttribute(name: string) {
      if (name === 'href') this.href = '';
    },
  };
  const getItem = vi.fn(() => JSON.stringify(cache));
  const window = {
    location: { hostname },
    localStorage: { getItem },
  };
  const document = {
    querySelector: vi.fn(() => (existingHref ? link : null)),
    createElement: vi.fn(() => link),
    head: { appendChild: vi.fn() },
    title: '',
  };

  new Function('window', 'document', 'URL', 'Date', bootstrap)(
    window,
    document,
    URL,
    Date,
  );

  return { href: link.href, getItem, document };
}

describe('early branding favicon bootstrap', () => {
  it('runs inline from the document head before the React module', () => {
    const faviconBootstrapIndex = html.indexOf('id="early-favicon-bootstrap"');
    const explicitFaviconIndex = html.indexOf('rel="icon" type="image/png"');
    const appModuleIndex = html.indexOf('<script type="module"');

    expect(explicitFaviconIndex).toBeGreaterThanOrEqual(0);
    expect(explicitFaviconIndex).toBeLessThan(faviconBootstrapIndex);
    expect(faviconBootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(faviconBootstrapIndex).toBeLessThan(appModuleIndex);
    expect(html).not.toContain('/branding-favicon-bootstrap.js');
    expect(html).not.toContain('href="/media/tec-escola-favicon.png?v=1401"');
    expect(html).toContain('<title></title>');
    expect(html).not.toContain('EduManager Pro');
    expect(html).toContain("const defaultFavicon = '/media/tec-escola-favicon.png?v=1401'");
    expect(bootstrap).not.toContain('/icons/tecescola-192.png');
    expect(manifest.name).toBe('TecEscola');
    expect(manifest.short_name).toBe('TecEscola');
    expect(JSON.stringify(manifest)).not.toContain('EduManager Pro');
    expect(manifest.icons).toHaveLength(3);
    expect(fallbackSvg).toContain('data:image/png;base64,');
    expect(fallbackSvg).toContain('<title id="title">Tec Escola</title>');
    expect(fallbackSvg).not.toContain('#0d61bd');
  });

  it('allows only this exact inline script through the Worker CSP hash', () => {
    const digest = createHash('sha256')
      .update(bootstrap, 'utf8')
      .digest('base64');

    expect(worker).toContain(`'sha256-${digest}'`);
  });

  it('applies this institution host cached favicon before app startup', () => {
    const { href, getItem } = applyCachedFavicon({
      version: 2,
      hostname: 'colegiocrescimento.grupotec.dev.br',
      cachedAt: Date.now(),
      branding: {
        scope: 'INSTITUTION',
        faviconUrl: 'https://api-edu-vps.grupotec.dev.br/storage/favicon.png',
      },
    });

    expect(href).toBe(
      'https://api-edu-vps.grupotec.dev.br/storage/favicon.png',
    );
    expect(getItem).toHaveBeenCalledWith(
      'tecescola:public-branding:colegiocrescimento.grupotec.dev.br',
    );
  });

  it('keeps the Tec Escola favicon on the platform host without a custom icon', () => {
    const { href } = applyCachedFavicon({
      version: 2,
      hostname: 'admin.grupotec.dev.br',
      cachedAt: Date.now(),
      branding: { scope: 'FALLBACK', faviconUrl: null },
    }, 'admin.grupotec.dev.br');

    expect(href).toBe('/media/tec-escola-favicon.png?v=1401');
  });

  it('does not show the Tec Escola favicon on an institution host while identity is unresolved', () => {
    const { href } = applyCachedFavicon({
      version: 2,
      hostname: 'colegiocrescimento.grupotec.dev.br',
      cachedAt: Date.now(),
      branding: {
        scope: 'INSTITUTION',
        faviconUrl: 'http://school.example/favicon.png',
        logoUrl: 'http://school.example/logo.png',
      },
    });

    expect(href).toBe('');
  });

  it('installs the platform fallback when no icon link exists yet', () => {
    const { document } = applyCachedFavicon(null, 'admin.grupotec.dev.br');

    expect(document.head.appendChild).toHaveBeenCalledWith(
      expect.objectContaining({
        rel: 'icon',
        href: '/media/tec-escola-favicon.png?v=1401',
      }),
    );
  });

  it("removes a previous school's icon when another institution host has no matching cache", () => {
    const { href, getItem } = applyCachedFavicon(null, 'outraescola.grupotec.dev.br', '/old-school-icon.png');

    expect(getItem).toHaveBeenCalledWith(
      'tecescola:public-branding:outraescola.grupotec.dev.br',
    );
    expect(href).toBe('');
  });
});
