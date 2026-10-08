import { useQuery } from '@tanstack/react-query';

import { registrationCompletionService } from '../services/registrationCompletionService';

export const REGISTRATION_COMPLETION_STALE_TIME = 1000 * 60 * 5;

export const registrationCompletionKeys = {
  student: (studentId: string, institutionId: string) =>
    ['student-registration-completion', studentId, institutionId] as const,
  guardian: (profileId: string) =>
    ['guardian-registration-completion', profileId] as const,
};

export function useStudentRegistrationCompletion(
  studentId: string | undefined,
  institutionId: string | null,
) {
  return useQuery({
    queryKey: registrationCompletionKeys.student(
      studentId ?? '',
      institutionId ?? '',
    ),
    queryFn: () => registrationCompletionService.getStudentCompletion(studentId as string, institutionId as string),
    enabled: Boolean(studentId && institutionId),
    staleTime: REGISTRATION_COMPLETION_STALE_TIME,
  });
}

export function useGuardianRegistrationCompletion(profileId: string | undefined) {
  return useQuery({
    queryKey: registrationCompletionKeys.guardian(profileId ?? ''),
    queryFn: () => registrationCompletionService.getGuardianCompletion(profileId as string),
    enabled: Boolean(profileId),
    staleTime: REGISTRATION_COMPLETION_STALE_TIME,
  });
}
