import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  FAVICON_MAX_SIZE_BYTES,
  LOGO_MAX_SIZE_BYTES,
  validateAccountDomainHostname,
  validateBrandingImageFile,
} from './brandingValidation';

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

describe('brandingValidation', () => {
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

  it('bloqueia SVG', async () => {
    const svg = new File(['<svg />'], 'brand.svg', {
      type: 'image/svg+xml',
    });

    expect(
      await validateBrandingImageFile(svg, 'logo'),
    ).toMatch(/PNG, JPEG ou WebP/i);
  });
});
