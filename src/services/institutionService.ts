import { supabase } from '../lib/supabaseClient';

export interface InstitutionSummary {
  id: string;
  name: string;
  active: boolean | null;
}

export interface UserInstitutionMembership {
  id: string;
  institution_id: string;
  role: string;
  active: boolean;
}

export interface UserInstitution {
  membership: UserInstitutionMembership;
  institution: InstitutionSummary;
}

interface InstitutionRelation {
  id: string;
  name: string;
  active: boolean | null;
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

function normalizeUserInstitution(
  row: MembershipInstitutionQueryRow,
): UserInstitution | null {
  const institution = normalizeRelation(
    row.institutions,
  );

  if (
    !row.id ||
    !row.institution_id ||
    !row.role ||
    !institution?.id ||
    !institution.name
  ) {
    return null;
  }

  if (row.active === false || institution.active === false) {
    return null;
  }

  return {
    membership: {
      id: row.id,
      institution_id: row.institution_id,
      role: row.role,
      active: row.active ?? true,
    },
    institution: {
      id: institution.id,
      name: institution.name,
      active: institution.active ?? true,
    },
  };
}

export const institutionService = {
  async listForProfile(
    profileId: string,
  ): Promise<UserInstitution[]> {
    if (!profileId) {
      return [];
    }

    const { data, error } = await supabase
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
          active
        )
      `,
      )
      .eq('profile_id', profileId)
      .eq('active', true)
      .eq('institutions.active', true);

    if (error) {
      throw error;
    }

    const rows =
      (data ?? []) as unknown as MembershipInstitutionQueryRow[];

    return rows
      .map(normalizeUserInstitution)
      .filter(
        (
          institution,
        ): institution is UserInstitution =>
          Boolean(institution),
      )
      .sort((first, second) =>
        first.institution.name.localeCompare(
          second.institution.name,
          'pt-BR',
        ),
      );
  },
};
