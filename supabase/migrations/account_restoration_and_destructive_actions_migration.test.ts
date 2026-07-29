import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Account Restoration and Destructive Actions Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260729000100_account_restoration_and_destructive_actions.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('creates platform_destructive_actions table', () => {
    expect(migrationSql).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+public\.platform_destructive_actions/i,
    );
  });

  it('has action_type check constraint with RESTORE and HARD_DELETE', () => {
    expect(migrationSql).toMatch(
      /action_type\s+in\s*\(\s*'RESTORE'\s*,\s*'HARD_DELETE'\s*\)/i,
    );
  });

  it('has result_status check constraint with SUCCESS, PARTIAL_SUCCESS, FAILED', () => {
    expect(migrationSql).toMatch(
      /result_status\s+in\s*\(\s*'SUCCESS'\s*,\s*'PARTIAL_SUCCESS'\s*,\s*'FAILED'\s*\)/i,
    );
  });

  it('enables RLS on platform_destructive_actions', () => {
    expect(migrationSql).toMatch(
      /alter\s+table\s+public\.platform_destructive_actions\s+enable\s+row\s+level\s+security/i,
    );
  });

  it('restricts platform_destructive_actions to service_role and select to authenticated', () => {
    expect(migrationSql).toMatch(
      /grant\s+select\s+on\s+table\s+public\.platform_destructive_actions\s+to\s+authenticated/i,
    );
    expect(migrationSql).toMatch(
      /grant\s+all\s+on\s+table\s+public\.platform_destructive_actions\s+to\s+service_role/i,
    );
  });

  it('creates restore_client_account RPC', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.restore_client_account/i,
    );
  });

  it('restore_client_account validates CANCELED status', () => {
    expect(migrationSql).toMatch(
      /ACCOUNT_NOT_CANCELED/i,
    );
    expect(migrationSql).toMatch(
      /account_record\.status\s*<>\s*'CANCELED'/i,
    );
  });

  it('restore_client_account checks domain conflicts', () => {
    expect(migrationSql).toMatch(
      /ACCOUNT_DOMAIN_CONFLICT/i,
    );
    expect(migrationSql).toMatch(/account_domains/i);
  });

  it('restore_client_account checks owner integrity', () => {
    expect(migrationSql).toMatch(
      /ACCOUNT_OWNER_INACTIVE/i,
    );
  });

  it('restore_client_account creates audit event with ACCOUNT_RESTORED', () => {
    expect(migrationSql).toMatch(
      /account_status_events/i,
    );
  });

  it('restore_client_account uses security definer and search_path', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.restore_client_account[\s\S]*?security\s+definer/i,
    );
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.restore_client_account[\s\S]*?set\s+search_path\s*=\s*''/i,
    );
  });

  it('restores only from service_role', () => {
    expect(migrationSql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.restore_client_account\(uuid,\s*uuid,\s*text\)\s+to\s+service_role/i,
    );
  });

  it('creates hard_delete_client_account RPC', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.hard_delete_client_account/i,
    );
  });

  it('hard_delete validates CANCELED only', () => {
    expect(migrationSql).toMatch(
      /ACCOUNT_NOT_CANCELED/i,
    );
  });

  it('hard_delete requires EXCLUIR DEFINITIVAMENTE confirmation', () => {
    expect(migrationSql).toMatch(
      /EXCLUIR DEFINITIVAMENTE/i,
    );
  });

  it('hard_delete requires acknowledgement', () => {
    expect(migrationSql).toMatch(
      /ACKNOWLEDGEMENT_REQUIRED/i,
    );
  });

  it('hard_delete prevents self-deletion', () => {
    expect(migrationSql).toMatch(
      /CANNOT_DELETE_OWN_ACCOUNT/i,
    );
  });

  it('hard_delete prevents superadmin deletion', () => {
    expect(migrationSql).toMatch(
      /CANNOT_DELETE_SUPERADMIN_ACCOUNT/i,
    );
  });

  it('hard_delete classifies exclusive vs shared profiles', () => {
    expect(migrationSql).toMatch(
      /exclusive_profiles/i,
    );
    expect(migrationSql).toMatch(/shared_profiles/i);
  });

  it('hard_delete uses security definer and search_path', () => {
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.hard_delete_client_account[\s\S]*?security\s+definer/i,
    );
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.hard_delete_client_account[\s\S]*?set\s+search_path\s*=\s*''/i,
    );
  });

  it('hard_delete restricted to service_role', () => {
    expect(migrationSql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.hard_delete_client_account\(uuid,\s*uuid,\s*text,\s*text,\s*text,\s*boolean\)\s+to\s+service_role/i,
    );
  });
});
