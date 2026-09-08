import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260814000400_allow_local_camera_gateway_hosts.sql'), 'utf8');

describe('allow local camera gateway hosts migration', () => {
  it('permite destinos locais para o gateway e continua bloqueando hosts perigosos', () => {
    expect(sql).toMatch(/create or replace function private\.valid_camera_host/i);
    expect(sql).not.toMatch(/lower\(target_host\) not in \('localhost', '::1'/i);
    expect(sql).toMatch(/lower\(target_host\) not in \('0\.0\.0\.0'\)/i);
    expect(sql).toMatch(/169\\\.254/i);
  });
});
