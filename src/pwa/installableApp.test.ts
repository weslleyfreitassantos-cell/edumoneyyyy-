import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as {
  name: string;
  start_url: string;
  icons: Array<{ src: string; sizes: string; purpose: string }>;
};
const worker = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const twa = JSON.parse(readFileSync(resolve(root, 'android/tecescola/twa-manifest.json'), 'utf8')) as {
  host: string;
  packageId: string;
  minSdkVersion: number;
  webManifestUrl: string;
  signingKey: { path: string; alias: string };
};

describe('TecEscola installable app shell', () => {
  it('declares an installable PWA with existing icons and a login entry point', () => {
    expect(manifest.name).toBe('TecEscola');
    expect(manifest.start_url).toContain('/login');
    expect(index).toContain('href="/manifest.webmanifest"');
    expect(index).toContain("register('/sw.js'");
    expect(existsSync(resolve(root, 'public/offline.html'))).toBe(true);
    expect(manifest.icons).toHaveLength(3);
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(root, `public${icon.src}`))).toBe(true);
    }
    expect(manifest.icons.find((icon) => icon.purpose === 'maskable')?.sizes).toBe('512x512');
  });

  it('caches only static assets and never stores navigation or authenticated responses', () => {
    expect(worker).toContain("!url.pathname.startsWith('/assets/')");
    expect(worker).toContain('request.headers.has(\'authorization\')');
    expect(worker).toContain('url.search');
    expect(worker).toContain("request.mode === 'navigate'");
    expect(worker).toContain("fetch(event.request).catch");
  });

  it('keeps the Android wrapper on production origin without embedding release credentials', () => {
    expect(twa.host).toBe('admin.grupotec.dev.br');
    expect(twa.webManifestUrl).toBe('https://admin.grupotec.dev.br/manifest.webmanifest');
    expect(twa.packageId).toBe('br.com.grupotec.tecescola');
    expect(twa.minSdkVersion).toBe(24);
    expect(twa.signingKey.path).toContain('not-configured');
    expect(twa.signingKey.alias).toContain('NOT_CONFIGURED');
    expect(JSON.stringify(twa)).not.toMatch(/127\.0\.0\.1|4175|debug\.keystore/i);
  });
});
