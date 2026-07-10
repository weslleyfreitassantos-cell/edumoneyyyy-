import { useInstitution } from '../contexts/InstitutionContext';
import type {
  InstitutionSummary,
  UserInstitutionMembership,
} from '../services/institutionService';

export interface CurrentInstitutionResult {
  data: string | null;
  institution: InstitutionSummary | null;
  membership: UserInstitutionMembership | null;
  currentInstitution: InstitutionSummary | null;
  currentMembership: UserInstitutionMembership | null;
  currentInstitutionId: string | null;
  currentRole: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  message: string | null;
  refetch: () => Promise<unknown>;
}

export function useCurrentInstitution(
  profileId: string | undefined,
): CurrentInstitutionResult {
  const institutionContext = useInstitution();

  const hasProfile = Boolean(profileId);
  const hasNoInstitution =
    hasProfile &&
    !institutionContext.isLoading &&
    !institutionContext.error &&
    institutionContext.institutions.length === 0;

  const message = hasNoInstitution
    ? 'Nenhuma escola ativa foi encontrada para este usuário.'
    : null;

  return {
    data: institutionContext.currentInstitutionId,
    institution:
      institutionContext.currentInstitution,
    membership:
      institutionContext.currentMembership,
    currentInstitution:
      institutionContext.currentInstitution,
    currentMembership:
      institutionContext.currentMembership,
    currentInstitutionId:
      institutionContext.currentInstitutionId,
    currentRole:
      institutionContext.currentRole,
    isLoading:
      hasProfile && institutionContext.isLoading,
    isError: Boolean(institutionContext.error),
    error: institutionContext.error,
    message,
    refetch: institutionContext.refresh,
  };
}
