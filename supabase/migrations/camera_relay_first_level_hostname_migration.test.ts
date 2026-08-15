import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260815000200_camera_relay_first_level_hostname.sql'), 'utf8');

describe('camera relay first-level hostname migration', () => {
  it('derives a stable first-level hostname from the gateway public id', () => {
    expect(sql).toContain("'camera-gw-' || substr(lower(target_public_id), 4) || '.grupotec.dev.br'");
    expect(sql).not.toContain("target_public_id || '.cameras.grupotec.dev.br'");
  });

  it('updates only the old relay values and validates the new hostname in RPCs', () => {
    expect(sql).toContain("lower(gateway.relay_base_url) = 'https://' || lower(gateway.public_id) || '.cameras.grupotec.dev.br'");
    expect(sql).toContain('private.camera_relay_hostname(target_public_id)');
    expect(sql).toContain('private.camera_relay_hostname(gateway.public_id)');
  });
});
