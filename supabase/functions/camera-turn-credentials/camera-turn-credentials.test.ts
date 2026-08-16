import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

describe('camera-turn-credentials', () => {
  it('keeps the Cloudflare TURN key and token server-side', () => {
    expect(source).toContain('CLOUDFLARE_TURN_KEY_ID');
    expect(source).toContain('CLOUDFLARE_TURN_API_TOKEN');
    expect(source).not.toContain('VITE_CLOUDFLARE');
    expect(source).not.toContain('localStorage');
  });

  it('requires an authenticated, unexpired camera session owned by the user', () => {
    expect(source).toContain('auth.getUser(token)');
    expect(source).toContain('camera_stream_sessions');
    expect(source).toContain('.eq("profile_id", userId)');
    expect(source).toContain('.gt("expires_at"');
    expect(source).toContain('SESSION_REJECTED');
  });

  it('generates short-lived ICE credentials and filters browser-blocked port 53', () => {
    expect(source).toContain('generate-ice-servers');
    expect(source).toContain('ttl: TURN_CREDENTIAL_TTL_SECONDS');
    expect(source).toContain('30 * 60');
    expect(source).toContain('withoutBrowserBlockedPort');
  });

  it('never returns provider errors or secrets to the client', () => {
    expect(source).toContain('TURN_CREDENTIALS_FAILED');
    expect(source).toContain('TURN_NOT_CONFIGURED');
    expect(source).not.toContain('apiToken: turnApiToken');
    expect(source).not.toContain('return json(request, { apiToken');
  });
});
