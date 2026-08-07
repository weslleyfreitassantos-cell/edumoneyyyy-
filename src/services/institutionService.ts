import { supabase } from '../lib/supabaseClient';

import type {
  AccountStatus,
  CurrentDatabaseRole,
} from '../lib/permissions';

export interface InstitutionSummary {
  id: string;
  name: string;
  subdomain?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  active: boolean | null;
  account_id: string | null;
}

export interface AccountSummary {
  id: string;
  name: string;
  status: AccountStatus;
  institution_limit: number;
}

export interface UserInstitutionMembership {
  id: string;
  institution_id: string;
  role: string;
  active: boolean;
}

export type UserInstitutionAccessSource =
  | 'account_owner'
  | 'membership'
  | 'legacy_admin_membership';

export interface UserInstitution {
  membership: UserInstitutionMembership | null;
  institution: InstitutionSummary;
  account: AccountSummary | null;
  accessSource: UserInstitutionAccessSource;
  effectiveRole: CurrentDatabaseRole;
}

interface InstitutionRelation {
  id: string;
  name: string;
  subdomain?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  active: boolean | null;
  account_id: string | null;
  accounts?: AccountSummary | AccountSummary[] | null;
}

interface AccountInstitutionQueryRow {
  id: string;
  name: string;
  status: AccountStatus | string;
  institution_limit: number | null;
  institutions:
    | InstitutionRelation
    | InstitutionRelation[]
    | null;
}

interface MembershipInstitutionQueryRow {
  id: string;
  institution_id: string;
  role: string;
  active: boolean | null;
  institutions:
    | InstitutionRelation
    | InstitutionRelation[]
    | null;
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeRelationList<T>(
  relation: T | T[] | null,
): T[] {
  if (!relation) {
    return [];
  }

  return Array.isArray(relation)
    ? relation
    : [relation];
}

function isAccountStatus(
  value: string,
): value is AccountStatus {
  return [
    'ACTIVE',
    'SUSPENDED',
    'CANCELED',
  ].includes(value);
}

function normalizeInstitution(
  institution: InstitutionRelation | null,
): InstitutionSummary | null {
  if (
    !institution?.id ||
    !institution.name ||
    institution.active === false
  ) {
    return null;
  }

  return {
    id: institution.id,
    name: institution.name,
    subdomain: institution.subdomain ?? null,
    logo_url: institution.logo_url ?? null,
    primary_color: institution.primary_color ?? null,
    secondary_color: institution.secondary_color ?? null,
    active: institution.active ?? true,
    account_id: institution.account_id ?? null,
  };
}

function normalizeAccount(
  row: AccountInstitutionQueryRow,
): AccountSummary | null {
  if (!row.id || !row.name) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: isAccountStatus(row.status)
      ? row.status
      : 'ACTIVE',
    institution_limit: row.institution_limit ?? 1,
  };
}

function addOwnedInstitutions(
  output: Map<string, UserInstitution>,
  row: AccountInstitutionQueryRow,
): void {
  const account = normalizeAccount(row);

  if (!account || account.status !== 'ACTIVE') {
    return;
  }

  for (const relation of normalizeRelationList(
    row.institutions,
  )) {
    const institution =
      normalizeInstitution(relation);

    if (!institution) {
      continue;
    }

    output.set(institution.id, {
      membership: null,
      institution,
      account,
      accessSource: 'account_owner',
      effectiveRole: 'ADMIN',
    });
  }
}

function normalizeMembershipInstitution(
  row: MembershipInstitutionQueryRow,
): UserInstitution | null {
  if (
    !row.id ||
    !row.institution_id ||
    !row.role ||
    row.active === false
  ) {
    return null;
  }

  const institutionRelation = normalizeRelation(
    row.institutions,
  );

  const institution = normalizeInstitution(
    institutionRelation,
  );

  if (!institution) {
    return null;
  }

  const accountRelation = normalizeRelation(
    institutionRelation?.accounts,
  );

  const account =
    accountRelation && isAccountStatus(accountRelation.status)
      ? {
          id: accountRelation.id,
          name: accountRelation.name,
          status: accountRelation.status,
          institution_limit:
            accountRelation.institution_limit ?? 1,
        }
      : null;

  if (
    account !== null &&
    account.status !== 'ACTIVE'
  ) {
    return null;
  }

  if (
    row.role === 'ADMIN' &&
    institution.account_id !== null
  ) {
    return null;
  }

  const role =
    row.role === 'ADMIN' ||
    row.role === 'DIRECTOR' ||
    row.role === 'SECRETARY' ||
    row.role === 'TEACHER' ||
    row.role === 'STUDENT' ||
    row.role === 'GUARDIAN'
      ? row.role
      : null;

  if (!role) {
    return null;
  }

  return {
    membership: {
      id: row.id,
      institution_id: row.institution_id,
      role: row.role,
      active: row.active ?? true,
    },
    institution,
    account,
    accessSource:
      row.role === 'ADMIN'
        ? 'legacy_admin_membership'
        : 'membership',
    effectiveRole: role,
  };
}

function compareInstitutions(
  first: UserInstitution,
  second: UserInstitution,
): number {
  return first.institution.name.localeCompare(
    second.institution.name,
    'pt-BR',
  );
}

export const institutionService = {
  async listAllActiveInstitutions(): Promise<UserInstitution[]> {
    const { data, error } = await supabase
      .from('institutions')
      .select(
        `
        id,
        name,
        active,
        account_id,
        accounts:account_id (
          id,
          name,
          status,
          institution_limit
        )
      `,
      )
      .eq('active', true)
      .order('name');

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as unknown as InstitutionRelation[]
    )
      .filter((inst) => {
        const account = normalizeRelation(inst.accounts);

        return (
          inst.account_id === null ||
          account?.status === 'ACTIVE'
        );
      })
      .map((inst) => {
        const account = normalizeRelation(inst.accounts);

        return {
          membership: null,
          institution: {
            id: inst.id,
            name: inst.name,
            active: inst.active ?? true,
            account_id: inst.account_id ?? null,
          },
          account:
            account && isAccountStatus(account.status)
              ? {
                  id: account.id,
                  name: account.name,
                  status: account.status,
                  institution_limit:
                    account.institution_limit ?? 1,
                }
              : null,
          accessSource: 'membership' as const,
          effectiveRole: 'ADMIN' as CurrentDatabaseRole,
        };
      });
  },

  async listForProfile(
    profileId: string,
  ): Promise<UserInstitution[]> {
    if (!profileId) {
      return [];
    }

    const [accountResult, membershipResult] =
      await Promise.all([
        supabase
          .from('accounts')
          .select(
            `
            id,
            name,
            status,
            institution_limit,
            institutions (
              id,
              name,
              subdomain,
              logo_url,
              primary_color,
              secondary_color,
              active,
              account_id
            )
          `,
          )
          .eq('owner_profile_id', profileId),

        supabase
          .from('memberships')
          .select(
            `
            id,
            institution_id,
            role,
            active,
            institutions:institution_id!inner (
              id,
              name,
              subdomain,
              logo_url,
              primary_color,
              secondary_color,
              active,
              account_id,
              accounts:account_id (
                id,
                name,
                status,
                institution_limit
              )
            )
          `,
          )
          .eq('profile_id', profileId)
          .eq('active', true)
          .eq('institutions.active', true),
      ]);

    if (accountResult.error) {
      throw accountResult.error;
    }

    if (membershipResult.error) {
      throw membershipResult.error;
    }

    const institutions = new Map<
      string,
      UserInstitution
    >();

    for (const row of
      (accountResult.data ??
        []) as unknown as AccountInstitutionQueryRow[]) {
      addOwnedInstitutions(institutions, row);
    }

    for (const row of
      (membershipResult.data ??
        []) as unknown as MembershipInstitutionQueryRow[]) {
      const item =
        normalizeMembershipInstitution(row);

      if (!item || institutions.has(item.institution.id)) {
        continue;
      }

      institutions.set(
        item.institution.id,
        item,
      );
    }

    return Array.from(institutions.values()).sort(
      compareInstitutions,
    );
  },
};

/**
 * Operação 1 — Subdomínio (Exclusiva do ADMIN)
 * Altera exclusivamente o subdomínio da instituição.
 * Valida que o usuário é ADMIN e que a instituição pertence à sua conta.
 */
export async function updateInstitutionSubdomain({
  institutionId,
  subdomain,
  profileId,
  userRole,
}: {
  institutionId: string;
  subdomain: string;
  profileId: string;
  userRole: string;
}): Promise<InstitutionSummary> {
  if (userRole !== 'ADMIN') {
    throw new Error('Apenas o administrador da conta pode alterar o subdomínio da instituição.');
  }

  const { data: inst, error: fetchErr } = await supabase
    .from('institutions')
    .select('id, name, account_id, active')
    .eq('id', institutionId)
    .single();

  if (fetchErr || !inst) {
    throw new Error('Instituição não encontrada.');
  }

  if (!inst.account_id) {
    throw new Error('A instituição não está vinculada a nenhuma conta.');
  }

  const { data: account, error: accErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', inst.account_id)
    .eq('owner_profile_id', profileId)
    .maybeSingle();

  if (accErr || !account) {
    throw new Error('Você não possui permissão para alterar o subdomínio de uma instituição que não pertence à sua conta.');
  }

  const { validateSubdomain, normalizeSubdomain } = await import('../lib/subdomain');
  const validation = validateSubdomain(subdomain);
  if (!validation.valid) {
    throw new Error(validation.error || 'Subdomínio inválido.');
  }

  const normalized = normalizeSubdomain(subdomain);

  const { data: existing, error: checkError } = await supabase
    .from('institutions')
    .select('id')
    .eq('subdomain', normalized)
    .neq('id', institutionId)
    .maybeSingle();

  if (checkError) {
    throw new Error('Erro ao verificar disponibilidade do subdomínio.');
  }

  if (existing) {
    throw new Error('Este subdomínio já está em uso por outra instituição.');
  }

  const { data, error } = await supabase
    .from('institutions')
    .update({ subdomain: normalized, updated_at: new Date().toISOString() })
    .eq('id', institutionId)
    .select('id, name, subdomain, logo_url, primary_color, secondary_color, active, account_id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao atualizar o subdomínio da instituição.');
  }

  return data;
}

/**
 * Operação 2 — Identidade Visual (Exclusiva do DIRECTOR)
 * Altera exclusivamente logotipo e cores da própria instituição.
 * Valida que o usuário tem membership ativa com papel DIRECTOR na instituição correspondente.
 */
export async function updateInstitutionBranding({
  institutionId,
  profileId,
  logo_url,
  primary_color,
  secondary_color,
}: {
  institutionId: string;
  profileId: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}): Promise<InstitutionSummary> {
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .select('id, role, active, institution_id')
    .eq('profile_id', profileId)
    .eq('institution_id', institutionId)
    .eq('role', 'DIRECTOR')
    .eq('active', true)
    .maybeSingle();

  if (memErr || !membership) {
    throw new Error('Apenas um Diretor com membership ativa pode alterar a identidade visual da instituição.');
  }

  const updateData: {
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (logo_url !== undefined) updateData.logo_url = logo_url;
  if (primary_color !== undefined) updateData.primary_color = primary_color;
  if (secondary_color !== undefined) updateData.secondary_color = secondary_color;

  const { data, error } = await supabase
    .from('institutions')
    .update(updateData)
    .eq('id', institutionId)
    .select('id, name, subdomain, logo_url, primary_color, secondary_color, active, account_id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao atualizar a identidade visual da instituição.');
  }

  return data;
}

export interface ResolveInstitutionResult {
  institution: InstitutionSummary | null;
  error: Error | null;
}

export async function resolveInstitutionBySubdomain(
  subdomain: string,
): Promise<ResolveInstitutionResult> {
  const { validateSubdomain, normalizeSubdomain } = await import('../lib/subdomain');
  const validation = validateSubdomain(subdomain);
  if (!validation.valid) {
    return { institution: null, error: null };
  }

  const normalized = normalizeSubdomain(subdomain);

  const { data, error } = await supabase
    .from('institutions')
    .select(
      `
      id,
      name,
      subdomain,
      logo_url,
      primary_color,
      secondary_color,
      active,
      account_id,
      accounts:account_id (
        id,
        status
      )
    `,
    )
    .eq('subdomain', normalized)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    return { institution: null, error };
  }

  if (!data) {
    return { institution: null, error: null };
  }

  if (data.account_id) {
    const accountRelation = normalizeRelation(
      (data as unknown as { accounts?: AccountSummary | AccountSummary[] | null }).accounts,
    );

    if (!accountRelation || accountRelation.status !== 'ACTIVE') {
      return { institution: null, error: null };
    }
  }

  const institution: InstitutionSummary = {
    id: data.id,
    name: data.name,
    subdomain: data.subdomain ?? null,
    logo_url: data.logo_url ?? null,
    primary_color: data.primary_color ?? null,
    secondary_color: data.secondary_color ?? null,
    active: data.active ?? true,
    account_id: data.account_id ?? null,
  };

  return { institution, error: null };
}

export async function fetchInstitutionBySubdomain(
  subdomain: string,
): Promise<InstitutionSummary | null> {
  const result = await resolveInstitutionBySubdomain(subdomain);
  return result.institution;
}
