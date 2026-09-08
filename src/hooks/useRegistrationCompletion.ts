import { useQuery } from '@tanstack/react-query';

import { registrationCompletionService } from '../services/registrationCompletionService';

export function useStudentRegistrationCompletion(
  studentId: string | undefined,
  institutionId: string | null,
) {
  return useQuery({
    queryKey: ['student-registration-completion', studentId, institutionId],
    queryFn: () => registrationCompletionService.getStudentCompletion(studentId as string, institutionId as string),
    enabled: Boolean(studentId && institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGuardianRegistrationCompletion(profileId: string | undefined) {
  return useQuery({
    queryKey: ['guardian-registration-completion', profileId],
    queryFn: () => registrationCompletionService.getGuardianCompletion(profileId as string),
    enabled: Boolean(profileId),
    staleTime: 1000 * 60 * 5,
  });
}
