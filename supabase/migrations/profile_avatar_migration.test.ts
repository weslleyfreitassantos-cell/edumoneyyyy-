import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationSql = readFileSync(
  resolve(__dirname, '20260930000900_profile_avatars.sql'),
  'utf8',
);

describe('profile avatar migration', () => {
  it('creates a private, constrained avatar bucket', () => {
    expect(migrationSql).toContain("'profile-avatars'");
    expect(migrationSql).toContain('public = false');
    expect(migrationSql).toContain('5242880');
    expect(migrationSql).toContain("'image/jpeg'");
    expect(migrationSql).toContain("'image/png'");
    expect(migrationSql).toContain("'image/webp'");
  });

  it('limits storage access to the current user canonical path', () => {
    expect(migrationSql).toContain("name = (select auth.uid())::text || '/avatar.webp'");
    expect(migrationSql).toContain('profile_avatars_insert');
    expect(migrationSql).toContain('profile_avatars_update');
    expect(migrationSql).toContain('profile_avatars_delete');
    expect(migrationSql).toContain('profile_avatars_select');
  });

  it('updates only the current profile through a restricted RPC', () => {
    expect(migrationSql).toContain('set_current_profile_avatar');
    expect(migrationSql).toContain('current_user_id uuid := (select auth.uid())');
    expect(migrationSql).toContain('where id = current_user_id');
    expect(migrationSql).toContain('grant execute on function public.set_current_profile_avatar(text)');
    expect(migrationSql).toContain('revoke update (avatar_url) on table public.profiles');
  });
});
