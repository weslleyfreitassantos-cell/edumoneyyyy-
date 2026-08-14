import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260814000300_list_director_camera_gateways.sql'), 'utf8');

describe('list director camera gateways migration', () => {
  it('lista gateways por instituicao e calcula online pelo ultimo heartbeat', () => {
    expect(sql).toMatch(/create or replace function public\.list_director_camera_gateways\(target_institution_id uuid\)/i);
    expect(sql).toMatch(/gateway\.institution_id = target_institution_id/i);
    expect(sql).toMatch(/gateway\.last_seen_at < now\(\) - interval '2 minutes'/i);
    expect(sql).toMatch(/'OFFLINE'::public\.camera_gateway_status/i);
  });

  it('mantem a autorizacao no servidor e o grant somente para usuarios autenticados', () => {
    expect(sql).toMatch(/private\.is_active_camera_director\(target_institution_id\)/i);
    expect(sql).toMatch(/using errcode = '42501'/i);
    expect(sql).toMatch(/revoke all on function public\.list_director_camera_gateways\(uuid\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.list_director_camera_gateways\(uuid\) to authenticated/i);
  });
});
