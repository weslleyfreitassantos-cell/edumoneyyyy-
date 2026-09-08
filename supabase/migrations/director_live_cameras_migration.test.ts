import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Director live cameras migration audit', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '20260813000100_director_live_cameras.sql'), 'utf8');

  it('cria tabelas, enums e indices do modulo', () => {
    expect(sql).toMatch(/create type public\.camera_gateway_status/i);
    expect(sql).toMatch(/create table if not exists public\.camera_gateways/i);
    expect(sql).toMatch(/create table if not exists public\.institution_cameras/i);
    expect(sql).toMatch(/create table if not exists public\.camera_access_logs/i);
    expect(sql).toMatch(/guardian_access boolean not null default false/i);
    expect(sql).toMatch(/institution_cameras_guardian_access_check/i);
  });

  it('mantem autorização no servidor e RPCs com search_path vazio', () => {
    expect((sql.match(/security definer/gi) ?? []).length).toBeGreaterThanOrEqual(10);
    expect((sql.match(/set search_path = ''/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect(sql).toMatch(/private\.is_active_camera_director/i);
    expect(sql).toMatch(/membership\.role = 'DIRECTOR'/i);
    expect(sql).toMatch(/using errcode = '42501'/i);
    expect(sql).toMatch(/create or replace function public\.pair_camera_gateway/i);
    expect(sql).toMatch(/gateway_token_hash = md5\(gateway_token\)/i);
  });

  it('não salva senha nem URL RTSP e restringe grants a authenticated', () => {
    expect(sql).not.toMatch(/password\s+text/i);
    expect(sql).not.toMatch(/rtsp_url|stream_url/i);
    expect(sql).toMatch(/credential_secret_ref text/i);
    expect(sql).toMatch(/revoke all on table public\.institution_cameras from anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.list_director_cameras[\s\S]*to authenticated/i);
    expect(sql).not.toMatch(/grant execute on function public\.list_director_cameras[\s\S]*to anon/i);
  });
});
