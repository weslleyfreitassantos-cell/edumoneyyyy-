import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('restore-client-account', () => {
  it('calls restore_client_account RPC', () => {
    expect(source).toContain('restore_client_account');
  });

  it('requires accountId and reason', () => {
    expect(source).toContain('accountId');
    expect(source).toContain('reason');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('maps business errors to HTTP errors', () => {
    expect(source).toContain('ACCOUNT_NOT_FOUND');
    expect(source).toContain('ACCOUNT_NOT_CANCELED');
    expect(source).toContain('ACCOUNT_DOMAIN_CONFLICT');
    expect(source).toContain('ACCOUNT_OWNER_INACTIVE');
  });

  it('reads Supabase error fields beyond message', () => {
    expect(source).toContain('"details"');
    expect(source).toContain('"hint"');
    expect(source).toContain('"code"');
  });

  it('returns success response with status fields', () => {
    expect(source).toContain('success: true');
    expect(source).toContain('previousStatus');
    expect(source).toContain('new_status');
    expect(source).toContain('audit_event_id');
  });

  it('handles method not allowed', () => {
    expect(source).toContain('METHOD_NOT_ALLOWED');
    expect(source).toContain('status: 405');
  });
});
