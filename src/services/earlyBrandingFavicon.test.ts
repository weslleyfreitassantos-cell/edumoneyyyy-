import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const worker = readFileSync(
  new URL('../../worker/index.ts', import.meta.url),
  'utf8',
);
const bootstrap = html.match(
  /<script id="early-favicon-bootstrap">([\s\S]*?)<\/script>/,
)?.[1]?.replace(/\r\n/g, '\n');

if (!bootstrap) {
  throw new Error('The early favicon bootstrap must remain inline in index.html');
}

function applyCachedFavicon(
  cache: unknown,
  hostname = 'colegiocrescimento.grupotec.dev.br',
) {
  const link = { href: '', rel: '', isConnected: false };
  const getItem = vi.fn(() => JSON.stringify(cache));
  const window = {
    location: { hostname },
    localStorage: { getItem },
  };
  const document = {
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => link),
    head: { appendChild: vi.fn() },
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
    const appModuleIndex = html.indexOf('<script type="module"');

    expect(faviconBootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(faviconBootstrapIndex).toBeLessThan(appModuleIndex);
    expect(html).not.toContain('/branding-favicon-bootstrap.js');
    expect(html).not.toContain('<link rel="icon"');
  });

  it('allows only this exact inline script through the Worker CSP hash', () => {
    const digest = createHash('sha256')
      .update(bootstrap, 'utf8')
      .digest('base64');

    expect(worker).toContain(`'sha256-${digest}'`);
  });

  it('applies this institution host cached favicon before app startup', () => {
    const { href, getItem } = applyCachedFavicon({
      version: 1,
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

  it.each([
    [
      'non-institution branding',
      { scope: 'FALLBACK', faviconUrl: 'https://school.example/favicon.png' },
    ],
    [
      'non-HTTPS favicon',
      { scope: 'INSTITUTION', faviconUrl: 'http://school.example/favicon.png' },
    ],
  ])('leaves the static icon unchanged for %s', (_label, branding) => {
    const { href } = applyCachedFavicon({
      version: 1,
      cachedAt: Date.now(),
      branding,
    });

    expect(href).toBe('/icons/tecescola-192.png');
  });

  it('leaves the static icon unchanged when cached data is invalid', () => {
    const { href } = applyCachedFavicon({
      version: 1,
      cachedAt: Date.now(),
      branding: { scope: 'INSTITUTION', faviconUrl: 'javascript:alert(1)' },
    });

    expect(href).toBe('/icons/tecescola-192.png');
  });

  it('installs the initial fallback when no icon link exists yet', () => {
    const { document } = applyCachedFavicon(null);

    expect(document.head.appendChild).toHaveBeenCalledWith(
      expect.objectContaining({
        rel: 'icon',
        href: '/icons/tecescola-192.png',
      }),
    );
  });
});
