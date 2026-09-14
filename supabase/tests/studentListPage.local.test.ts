import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

type Client = SupabaseClient<any, any, any>;

const localUrl = process.env.MULTI_TENANT_SUPABASE_URL;
const anonKey = process.env.MULTI_TENANT_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.MULTI_TENANT_SUPABASE_SERVICE_ROLE_KEY;
const localDescribe = localUrl && anonKey && serviceRoleKey ? describe : describe.skip;

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

async function insertOne(
  client: Client,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, any>> {
  const { data, error } = await client.from(table).insert(row).select('*').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return required(data, `${table} insert`);
}

async function createUser(
  service: Client,
  role: string,
  email: string,
): Promise<{ id: string; email: string; password: string }> {
  const password = 'StudentPage!2026';
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`auth ${email}: ${error.message}`);
  const user = required(data.user, `auth ${email}`);
  await insertOne(service, 'profiles', {
    id: user.id,
    full_name: email.split('@')[0],
    email,
    role,
    active: true,
  });
  return { id: user.id, email, password };
}

async function signIn(email: string, password: string): Promise<Client> {
  const client = createClient(localUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) {
    throw new Error(`login ${email}: ${result.error?.message ?? 'no session'}`);
  }
  return client;
}

localDescribe('student list RPC against local PostgREST', () => {
  let director: Client;
  let institutionA = '';
  let institutionB = '';

  beforeAll(async () => {
    const service = createClient(localUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const directorUser = await createUser(
      service,
      'DIRECTOR',
      `student-page-director-${suffix}@local.test`,
    );
    director = await signIn(directorUser.email, directorUser.password);

    const accountA = await insertOne(service, 'accounts', {
      name: `Student page account A ${suffix}`,
      owner_profile_id: directorUser.id,
      institution_limit: 2,
      status: 'ACTIVE',
    });
    institutionA = (await insertOne(service, 'institutions', {
      account_id: accountA.id,
      name: `Student page school A ${suffix}`,
      active: true,
    })).id as string;
    institutionB = (await insertOne(service, 'institutions', {
      account_id: accountA.id,
      name: `Student page school B ${suffix}`,
      active: true,
    })).id as string;
    await insertOne(service, 'memberships', {
      profile_id: directorUser.id,
      institution_id: institutionA,
      role: 'DIRECTOR',
      active: true,
    });

    for (let index = 1; index <= 31; index += 1) {
      const email = `student-page-${String(index).padStart(2, '0')}-${suffix}@local.test`;
      const studentUser = await createUser(service, 'STUDENT', email);
      await insertOne(service, 'students', {
        institution_id: institutionA,
        profile_id: studentUser.id,
        registration_number: `PAGE-${String(index).padStart(2, '0')}-${suffix}`,
        birth_date: '2010-01-01',
        active: true,
      });
      await insertOne(service, 'memberships', {
        profile_id: studentUser.id,
        institution_id: institutionA,
        role: 'STUDENT',
        active: true,
      });
    }

    const foreignUser = await createUser(
      service,
      'STUDENT',
      `student-page-foreign-${suffix}@local.test`,
    );
    await insertOne(service, 'students', {
      institution_id: institutionB,
      profile_id: foreignUser.id,
      registration_number: `FOREIGN-${suffix}`,
      birth_date: '2010-01-01',
      active: true,
    });
    await insertOne(service, 'memberships', {
      profile_id: foreignUser.id,
      institution_id: institutionB,
      role: 'STUDENT',
      active: true,
    });
  }, 120_000);

  it('retorna 25 na primeira página, 6 na segunda e total 31', async () => {
    const first = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: null,
      p_limit: 25,
      p_offset: 0,
    });
    const second = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: null,
      p_limit: 25,
      p_offset: 25,
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toHaveLength(25);
    expect(second.data).toHaveLength(6);
    expect(first.data?.[0]?.total_count).toBe(31);
    expect(second.data?.[0]?.total_count).toBe(31);
  });

  it('pesquisa server-side por RA, nome e e-mail', async () => {
    const byRegistration = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: 'PAGE-01',
      p_limit: 25,
      p_offset: 0,
    });
    const byName = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: 'student-page-02',
      p_limit: 25,
      p_offset: 0,
    });
    const byEmail = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: '@local.test',
      p_limit: 25,
      p_offset: 0,
    });

    expect(byRegistration.error).toBeNull();
    expect(byRegistration.data).toHaveLength(1);
    expect(byName.data).toHaveLength(1);
    expect(byEmail.data).toHaveLength(25);
    expect(byEmail.data?.[0]).not.toHaveProperty('cpf');
    expect(byEmail.data?.[0]).not.toHaveProperty('birth_date');
    expect(byEmail.data?.[0]).not.toHaveProperty('avatar_url');
  });

  it('retorna vazio para texto inexistente e para texto exclusivo de outro tenant', async () => {
    const missing = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: 'does-not-exist',
      p_limit: 25,
      p_offset: 0,
    });
    const foreign = await director.rpc('list_students_page', {
      p_institution_id: institutionA,
      p_search: 'FOREIGN-',
      p_limit: 25,
      p_offset: 0,
    });

    expect(missing.error).toBeNull();
    expect(foreign.error).toBeNull();
    expect(missing.data).toEqual([]);
    expect(foreign.data).toEqual([]);
  });
});
