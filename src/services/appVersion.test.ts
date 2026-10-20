// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { getModuleEntryUrl, hasNewAppVersion } from './appVersion';

describe('app version detection', () => {
  it('extracts the module entry asset path from the current page', () => {
    expect(
      getModuleEntryUrl(
        '<script type="module" crossorigin src="/assets/index-old.js"></script>',
        'https://school.example.com/login',
      ),
    ).toBe('https://school.example.com/assets/index-old.js');
  });

  it('detects a new entry bundle but ignores query-string differences', () => {
    const current = '<script type="module" src="/assets/index-old.js?v=1"></script>';
    const unchanged = '<script type="module" src="/assets/index-old.js?v=2"></script>';
    const updated = '<script type="module" src="/assets/index-new.js"></script>';

    expect(
      hasNewAppVersion(current, unchanged, 'https://school.example.com/'),
    ).toBe(false);
    expect(
      hasNewAppVersion(current, updated, 'https://school.example.com/'),
    ).toBe(true);
  });

  it('does not report an update when the served HTML has no module entry', () => {
    expect(
      hasNewAppVersion(
        '<script type="module" src="/assets/index-old.js"></script>',
        '<main>Temporariamente indisponível</main>',
        'https://school.example.com/',
      ),
    ).toBe(false);
  });
});
