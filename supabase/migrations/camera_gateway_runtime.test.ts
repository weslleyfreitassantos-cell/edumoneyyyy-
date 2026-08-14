import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260814000200_camera_gateway_runtime.sql'), 'utf8');

describe('camera gateway runtime migration', () => {
  it('cria sessao temporaria e expira em 180 segundos', () => {
    expect(sql).toMatch(/create table if not exists public\.camera_stream_sessions/i);
    expect(sql).toMatch(/generated_expiry := now\(\) \+ interval '180 seconds'/i);
    expect(sql).toMatch(/session_token_hash text not null/i);
  });

  it('amarra pairing, sync e redeem ao hash do token do gateway', () => {
    expect(sql).toMatch(/gateway_token_hash = md5\(generated_token\)/i);
    expect(sql).toMatch(/gateway_token_hash = md5\(target_gateway_token\)/i);
    expect(sql).toMatch(/session_token_hash = md5\(target_session_token\)/i);
    expect(sql).toMatch(/session\.gateway_id = target_gateway_id/i);
    expect(sql).toMatch(/primary key \(gateway_id, request_id\)/i);
    expect(sql).toMatch(/Gateway request replayed/i);
  });

  it('nao concede funcoes runtime para anon/authenticated', () => {
    expect(sql).toMatch(/revoke all on function public\.pair_camera_gateway_runtime[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.pair_camera_gateway_runtime[\s\S]*to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.create_camera_stream_session\(uuid\) to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.accept_camera_gateway_request\(uuid, text, uuid, timestamptz\)/i);
  });

  it('retorna apenas metadados de camera para o gateway', () => {
    expect(sql).toMatch(/camera\.id, camera\.institution_id, camera\.name, camera\.host/i);
    expect(sql).not.toMatch(/credential_secret_ref[\s\S]*sync_camera_gateway_runtime/i);
  });
});
