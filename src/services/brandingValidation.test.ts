import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  FAVICON_MAX_SIZE_BYTES,
  isValidBrandingAssetPath,
  isValidBrandingAssetUrl,
  LOGO_MAX_SIZE_BYTES,
  validateAccountDomainHostname,
  validateBrandingImageFile,
} from './brandingValidation';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherAccountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const assetId = '11111111-2222-4333-8444-555555555555';

function pngFile(size = 16): File {
  const bytes = new Uint8Array(Math.max(size, 12));
  bytes.set([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);

  return new File([bytes], 'brand.png', {
    type: 'image/png',
  });
}

function jpegFile(name = 'brand.jpg', size = 16): File {
  const bytes = new Uint8Array(Math.max(size, 12));
  bytes.set([0xff, 0xd8, 0xff]);

  return new File([bytes], name, {
    type: 'image/jpeg',
  });
}

function webpFile(name = 'brand.webp', size = 16): File {
  const bytes = new Uint8Array(Math.max(size, 12));
  bytes.set([
    0x52,
    0x49,
    0x46,
    0x46,
    0x00,
    0x00,
    0x00,
    0x00,
    0x57,
    0x45,
    0x42,
    0x50,
  ]);

  return new File([bytes], name, {
    type: 'image/webp',
  });
}

describe('brandingValidation', () => {
  it('valida paths exatos de assets GLOBAL e ACCOUNT', () => {
    expect(
      isValidBrandingAssetPath(
        `branding/global/logo/${assetId}.png`,
        { scope: 'GLOBAL', kind: 'logo' },
      ),
    ).toBe(true);
    expect(
      isValidBrandingAssetPath(
        `branding/accounts/${accountId}/favicon/${assetId}.jpg`,
        {
          scope: 'ACCOUNT',
          accountId,
          kind: 'favicon',
        },
      ),
    ).toBe(true);
    expect(
      isValidBrandingAssetPath(
        `branding/global/logo/sub/${assetId}.png`,
      ),
    ).toBe(false);
    expect(
      isValidBrandingAssetPath(
        `branding/global/qualquer/${assetId}.png`,
      ),
    ).toBe(false);
    expect(
      isValidBrandingAssetPath('branding/global/logo/evil.svg'),
    ).toBe(false);
    expect(
      isValidBrandingAssetPath(
        `branding/global/logo/${assetId}.png.jpg`,
      ),
    ).toBe(false);
    expect(
      isValidBrandingAssetPath(
        `branding/accounts/${otherAccountId}/logo/${assetId}.png`,
        { scope: 'ACCOUNT', accountId },
      ),
    ).toBe(false);
  });

  it('valida URL publica do Supabase coerente com o path', () => {
    const path = `branding/accounts/${accountId}/logo/${assetId}.webp`;
    const url =
      `https://whztnyifxpqgilvurymx.supabase.co/storage/v1/object/public/institution-branding/${path}?v=123`;

    expect(isValidBrandingAssetUrl(url, path)).toBe(true);
    expect(isValidBrandingAssetUrl(null, null)).toBe(false);
    expect(isValidBrandingAssetUrl(url, null)).toBe(false);
    expect(
      isValidBrandingAssetUrl(
        `https://evil.example/storage/v1/object/public/institution-branding/${path}`,
        path,
      ),
    ).toBe(false);
    expect(
      isValidBrandingAssetUrl(
        `https://whztnyifxpqgilvurymx.supabase.co/storage/v1/object/public/other-bucket/${path}`,
        path,
      ),
    ).toBe(false);
    expect(
      isValidBrandingAssetUrl(
        `https://whztnyifxpqgilvurymx.supabase.co/storage/v1/object/public/institution-branding/branding/global/logo/${assetId}.png`,
        path,
      ),
    ).toBe(false);
    expect(isValidBrandingAssetUrl('data:image/png;base64,abc', path)).toBe(
      false,
    );
    expect(isValidBrandingAssetUrl('javascript:alert(1)', path)).toBe(
      false,
    );
    expect(
      isValidBrandingAssetUrl(
        `https://whztnyifxpqgilvurymx.supabase.co/storage/v1/object/public/institution-branding/${path}?download=1`,
        path,
      ),
    ).toBe(false);
  });

  it('normaliza hostname para minusculas', () => {
    expect(
      validateAccountDomainHostname('Escola.Exemplo.COM').hostname,
    ).toBe('escola.exemplo.com');
  });

  it('rejeita protocolo, caminho, query string e reservado', () => {
    expect(
      validateAccountDomainHostname('https://escola.com').error,
    ).toMatch(/sem protocolo/i);
    expect(
      validateAccountDomainHostname('escola.com/login').error,
    ).toMatch(/sem caminho/i);
    expect(
      validateAccountDomainHostname('escola.com?x=1').error,
    ).toMatch(/sem caminho/i);
    expect(
      validateAccountDomainHostname('localhost').error,
    ).toMatch(/reservado/i);
    expect(
      validateAccountDomainHostname(
        'edumoneyyyy.weslleyfreitassantos.workers.dev',
      ).error,
    ).toMatch(/reservado/i);
  });

  it('valida tamanho de logo e favicon', async () => {
    expect(
      await validateBrandingImageFile(pngFile(), 'logo'),
    ).toBeNull();

    expect(
      await validateBrandingImageFile(
        pngFile(LOGO_MAX_SIZE_BYTES + 1),
        'logo',
      ),
    ).toMatch(/2 MB/i);

    expect(
      await validateBrandingImageFile(
        pngFile(FAVICON_MAX_SIZE_BYTES + 1),
        'favicon',
      ),
    ).toMatch(/512 KB/i);
  });

  it('valida PNG, JPEG e WebP coerentes', async () => {
    expect(
      await validateBrandingImageFile(pngFile(), 'logo'),
    ).toBeNull();
    expect(
      await validateBrandingImageFile(jpegFile(), 'logo'),
    ).toBeNull();
    expect(
      await validateBrandingImageFile(webpFile(), 'favicon'),
    ).toBeNull();
  });

  it('bloqueia MIME divergente da extensao', async () => {
    expect(
      await validateBrandingImageFile(jpegFile('brand.png'), 'logo'),
    ).toMatch(/extensao/i);
  });

  it('bloqueia SVG', async () => {
    const svg = new File(['<svg />'], 'brand.svg', {
      type: 'image/svg+xml',
    });

    expect(
      await validateBrandingImageFile(svg, 'logo'),
    ).toMatch(/PNG, JPEG ou WebP/i);
  });
});
