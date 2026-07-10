import { supabase } from '../lib/supabaseClient';

import {
  CURRENT_DATABASE_ROLES,
  type CurrentDatabaseRole,
} from '../lib/permissions';

import { isDatabaseRole } from '../lib/roles';

export interface SchoolUserProfileSummary {
  full_name: string;
  email: string;
  active: boolean | null;
}

export interface SchoolUserRow {
  id: string;
  profile_id: string;
  institution_id: string;
  role: CurrentDatabaseRole;
  active: boolean;
  joined_at?: string;
  profile: SchoolUserProfileSummary | null;
}

interface SchoolUserQueryRow {
  id: string;
  profile_id: string;
  institution_id: string;
  role: string;
  active: boolean | null;
  joined_at: string | null;
  profiles:
    | SchoolUserProfileSummary
    | SchoolUserProfileSummary[]
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

function compareSchoolUsers(
  first: SchoolUserRow,
  second: SchoolUserRow,
): number {
  const roleComparison = first.role.localeCompare(
    second.role,
    'pt-BR',
  );

  if (roleComparison !== 0) {
    return roleComparison;
  }

  const firstName =
    first.profile?.full_name ??
    first.profile?.email ??
    '';

  const secondName =
    second.profile?.full_name ??
    second.profile?.email ??
    '';

  return firstName.localeCompare(
    secondName,
    'pt-BR',
  );
}

function hasCurrentDatabaseRole(
  row: SchoolUserQueryRow,
): row is SchoolUserQueryRow & {
  role: CurrentDatabaseRole;
} {
  return isDatabaseRole(row.role);
}

export const schoolUserService = {
  async list(
    institutionId: string,
  ): Promise<SchoolUserRow[]> {
    const { data, error } = await supabase
      .from('memberships')
      .select(
        `
        id,
        profile_id,
        institution_id,
        role,
        active,
        joined_at,
        profiles:profile_id (
          full_name,
          email,
          active
        )
      `,
      )
      .eq('institution_id', institutionId)
      .in('role', [
        ...CURRENT_DATABASE_ROLES,
      ])
      .order('joined_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const rows =
      (data ?? []) as unknown as SchoolUserQueryRow[];

    const users: SchoolUserRow[] = rows
      .filter(hasCurrentDatabaseRole)
      .map((row) => ({
        id: row.id,
        profile_id: row.profile_id,
        institution_id: row.institution_id,
        role: row.role,
        active: row.active ?? false,
        joined_at:
          row.joined_at ?? undefined,
        profile: normalizeRelation(
          row.profiles,
        ),
      }));

    return users.sort(compareSchoolUsers);
  },
};
