import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260815000100_camera_remote_relay.sql'), 'utf8');

describe('camera remote relay migration', () => {
  it('adds one HTTPS relay identity per gateway without editing old migrations', () => {
    expect(sql).toMatch(/add column if not exists public_id text/i);
    expect(sql).toMatch(/add column if not exists relay_base_url text/i);
    expect(sql).toMatch(/add column if not exists tunnel_id text/i);
    expect(sql).toMatch(/camera_gateways_public_id_idx/i);
    expect(sql).toMatch(/cameras\.grupotec\.dev\.br/i);
  });

  it('does not return a local HTTP playback URL when a configured relay is stale', () => {
    expect(sql).toMatch(/if target_relay_base_url is not null then/i);
    expect(sql).toMatch(/target_relay_last_seen_at > now\(\) - interval '2 minutes'/i);
    expect(sql).toMatch(/current_setting\('request\.headers', true\)::jsonb ->> 'origin'/i);
    expect(sql).toMatch(/then target_local_base_url/i);
    expect(sql).toMatch(/else null/i);
  });

  it('keeps relay registration behind gateway token validation', () => {
    expect(sql).toMatch(/create or replace function public\.register_camera_gateway_relay/i);
    expect(sql).toMatch(/perform public\.accept_camera_gateway_request/i);
    expect(sql).toMatch(/grant execute on function public\.register_camera_gateway_relay[^\n]*to service_role/i);
  });
});
