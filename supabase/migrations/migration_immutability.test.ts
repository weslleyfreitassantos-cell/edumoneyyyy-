import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const historical = readFileSync(
  new URL('./20261001000100_adaptive_learning_pedagogical_depth_v4.sql', import.meta.url),
  'utf8',
);
const contentImport = readFileSync(
  new URL('./20261004000100_adaptive_learning_content_pack_v4.sql', import.meta.url),
  'utf8',
);

describe('BNCC content migration immutability', () => {
  it('keeps the applied V4 migration on its pre-canary content hash', () => {
    expect(historical).toContain('-- V4_CONTENT_HASH=eb0f5b80d5cfba9fd1f66f17ff69b435956e3a6808135302bcd32b4e61659e23');
    expect(historical).not.toContain('-- V4_CONTENT_HASH=3d4b6baa4c55d69e4793d7c45bde4f9dd6eceba52afb64fa0760d681eba74b4a');
  });

  it('moves new content to a later forward-only import', () => {
    expect(contentImport).toContain('-- V4_CONTENT_HASH=3d4b6baa4c55d69e4793d7c45bde4f9dd6eceba52afb64fa0760d681eba74b4a');
    expect(contentImport).toContain('v4-authored-mathematics-percent-base-probe-01');
    expect(contentImport).toContain('on conflict');
  });
});
