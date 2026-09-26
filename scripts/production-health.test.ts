import { describe, expect, it, vi } from 'vitest';
import { runProductionHealth } from './production-health.mjs';

describe('production health probes', () => {
  it('checks frontend, Auth, REST, Storage and the documented Realtime ping without exposing the key', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));
    const result = await runProductionHealth({
      siteUrl: 'https://school.example',
      supabaseUrl: 'https://api.example',
      anonKey: 'do-not-log-this-key',
      fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    expect(result.checks.map(({ name }) => name)).toEqual([
      'frontend',
      'auth',
      'database-rest',
      'storage-api',
      'realtime-ping',
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example/realtime/v1/api/ping',
      expect.objectContaining({
        method: 'GET',
        headers: { apikey: 'do-not-log-this-key' },
        redirect: 'error',
      }),
    );
  });

  it('blocks Supabase probes when the public key is unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));
    const result = await runProductionHealth({
      siteUrl: 'https://school.example',
      supabaseUrl: 'https://api.example',
      anonKey: '',
      fetchImpl,
    });

    expect(result.checks.filter(({ name }) => name !== 'frontend').every(({ status }) => status === 'BLOCKED')).toBe(true);
    expect(result.exitCode).toBe(2);
  });

  it('fails on a service 5xx without recording response bodies', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(url.includes('/api/ping') ? 'sensitive upstream detail' : '', {
        status: url.includes('/api/ping') ? 503 : 200,
      });
    });
    const result = await runProductionHealth({
      siteUrl: 'https://school.example',
      supabaseUrl: 'https://api.example',
      anonKey: 'unused',
      fetchImpl,
    });

    expect(result.checks.find(({ name }) => name === 'realtime-ping')).toMatchObject({
      status: 'FAIL',
      httpStatus: 503,
    });
    expect(JSON.stringify(result)).not.toContain('sensitive upstream detail');
    expect(result.exitCode).toBe(1);
  });
});
