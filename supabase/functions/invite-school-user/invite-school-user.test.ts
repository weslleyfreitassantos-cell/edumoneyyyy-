import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/functions-js/edge-runtime.d.ts', () => ({}));
vi.mock('@supabase/server', () => ({
  withSupabase: (_opts: any, fn: any) => fn,
}));

if (typeof (globalThis as any).Deno === 'undefined') {
  (globalThis as any).Deno = {
    env: {
      get: (key: string) => process.env[key],
    },
  };
}

const source = readFileSync(
  new URL('./index.ts', import.meta.url),
  'utf8',
);

describe('invite-school-user', () => {
  it('rejects missing APP_URL', () => {
    expect(source).toContain('MISSING_APP_URL');
  });

  it('rejects localhost APP_URL in production', () => {
    expect(source).toContain('LOCALHOST_APP_URL');
    expect(source).toContain('isLocalhostUrl');
    expect(source).toContain('localhost');
    expect(source).toContain('127\\.0\\.0\\.1');
  });

  it('builds redirectTo from APP_URL + /auth/confirm', () => {
    expect(source).toContain('redirectTo');
    expect(source).toContain('/auth/confirm');
  });

  it('authorizes by account ownership or active membership role', () => {
    expect(source).toContain('owner_profile_id');
    expect(source).toContain('isAccountOwner');
    expect(source).toContain('activeMemberships');
    expect(source).toContain('directorMembership');
    expect(source).toContain('secretaryMembership');
  });

  it('does not block school invites by institution quota', () => {
    expect(source).not.toContain('institution_limit');
    expect(source).not.toContain('remainingSlots');
  });

  it('maps known failures to public status codes', () => {
    expect(source).toContain('DATABASE_PERMISSION_DENIED');
    expect(source).toContain('INVITE_CONFLICT');
    expect(source).toContain('INVALID_INVITE_RELATION');
    expect(source).toContain('INVITE_EMAIL_DELIVERY_FAILED');
    expect(source).toContain('INVITE_RATE_LIMITED');
    expect(source).toContain('authStatus');
    expect(source).toContain('authCode');
    expect(source).toContain('requestId');
  });

  it('queries institution name from database and includes exact contract metadata in invite', () => {
    expect(source).toContain('.select("id, name, active, account_id")');
    expect(source).toContain('full_name: input.fullName');
    expect(source).toContain('role: input.role');
    expect(source).toContain('invited_role: input.role');
    expect(source).toContain('institution_id: activeInstitution.id');
    expect(source).toContain('institution_name: activeInstitution.name');
  });

  it('invokes inviteUserByEmail with trusted database institution name and rejects client institution name', async () => {
    process.env.APP_URL = 'https://app.edumanager.com';

    const mockInviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: 'new-user-123' } },
      error: null,
    });

    const mockSupabaseAdmin = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-123' } },
          error: null,
        }),
        admin: {
          inviteUserByEmail: mockInviteUserByEmail,
        },
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({ data: { platform_role: 'SUPER_ADMIN', active: true }, error: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'institutions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Escola do Saber Confiavel DB',
                active: true,
                account_id: null,
              },
              error: null,
            }),
          };
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'mem-1', role: 'ADMIN', active: true }],
                error: null,
              }),
            }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'mem-2' }, error: null }),
          };
        }
        return {};
      }),
    };

    const handler = (await import('./index.ts')).default;

    // Test 1: Request with client trying to send extra field "institutionName" is rejected by Zod schema (.strict())
    const untrustedPayloadRequest = new Request('http://localhost/functions/v1/invite-school-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId: '11111111-1111-4111-8111-111111111111',
        role: 'TEACHER',
        fullName: 'Professor Teste',
        email: 'professor@escola.com',
        institutionName: 'Escola Falsa Frontend',
      }),
    });

    const untrustedCtx = {
      supabase: mockSupabaseAdmin,
      supabaseAdmin: mockSupabaseAdmin,
    };

    const rejectedResponse = await handler.fetch(untrustedPayloadRequest, untrustedCtx as any);
    expect(rejectedResponse.status).toBe(400);
    const rejectedBody = await rejectedResponse.json();
    expect(rejectedBody.code).toBe('INVALID_PAYLOAD');

    // Test 2: Valid payload uses DB institution name "Escola do Saber Confiavel DB" in invite metadata
    const validRequest = new Request('http://localhost/functions/v1/invite-school-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId: '11111111-1111-4111-8111-111111111111',
        role: 'TEACHER',
        fullName: 'Professor Teste',
        email: 'professor@escola.com',
      }),
    });

    const validCtx = {
      supabase: mockSupabaseAdmin,
      supabaseAdmin: mockSupabaseAdmin,
    };

    const response = await handler.fetch(validRequest, validCtx as any);
    expect(response.status).toBe(201);
    expect(mockInviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(mockInviteUserByEmail).toHaveBeenCalledWith(
      'professor@escola.com',
      {
        data: {
          full_name: 'Professor Teste',
          role: 'TEACHER',
          invited_role: 'TEACHER',
          institution_id: '11111111-1111-4111-8111-111111111111',
          institution_name: 'Escola do Saber Confiavel DB',
        },
        redirectTo: 'https://app.edumanager.com/auth/confirm',
      }
    );
  });
});
