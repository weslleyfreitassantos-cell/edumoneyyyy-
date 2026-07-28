import { supabase } from '../lib/supabaseClient';

import type {
  AccountStatus,
  CurrentDatabaseRole,
} from '../lib/permissions';

export interface InstitutionSummary {
  id: string;
  name: string;
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

  if (institution.account_id !== null && !account) {
    return null;
  }

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
