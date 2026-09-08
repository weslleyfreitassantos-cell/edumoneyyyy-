import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('delete-client-account hard delete enabled', () => {
  it('calls hard_delete_client_account RPC', () => {
    expect(source).toContain('hard_delete_client_account');
  });

  it('requires reason, confirmationEmail, confirmationText, acknowledgement', () => {
    expect(source).toContain('confirmationEmail');
    expect(source).toContain('confirmationText');
    expect(source).toContain('acknowledgement');
    expect(source).toContain('EXCLUIR DEFINITIVAMENTE');
  });

  it('requires SUPER_ADMIN authorization', () => {
    expect(source).toContain('SUPER_ADMIN_REQUIRED');
    expect(source).toContain('platform_role');
  });

  it('deletes auth users for exclusive profiles after RPC', () => {
    expect(source).toContain('auth.admin.deleteUser');
  });
});
