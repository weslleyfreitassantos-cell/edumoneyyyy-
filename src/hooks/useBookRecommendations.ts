import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bookRecommendationService,
  type BookRecommendationFilters,
  type BookRecommendationInput,
} from '../services/bookRecommendationService';

export const bookRecommendationKeys = {
  all: ['book-recommendations'] as const,
  teacher: (
    institutionId: string | null,
    profileId: string | null,
    filters: BookRecommendationFilters,
  ) => ['book-recommendations', 'teacher', institutionId, profileId, filters] as const,
  student: (
    institutionId: string | null,
    filters: BookRecommendationFilters,
  ) => ['book-recommendations', 'student', institutionId, filters] as const,
  offerings: (
    institutionId: string | null,
    profileId: string | null,
  ) => ['book-recommendations', 'offerings', institutionId, profileId] as const,
};

export function useTeacherBookRecommendations(
  institutionId: string | null,
  profileId: string | null,
  filters: BookRecommendationFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: bookRecommendationKeys.teacher(institutionId, profileId, filters),
    queryFn: () => bookRecommendationService.listForTeacher(institutionId!, profileId!, filters),
    enabled: Boolean(enabled && institutionId && profileId),
  });
}

export function useStudentBookRecommendations(
  institutionId: string | null,
  filters: Omit<BookRecommendationFilters, 'status'>,
  enabled = true,
) {
  return useQuery({
    queryKey: bookRecommendationKeys.student(institutionId, filters),
    queryFn: () => bookRecommendationService.listForStudent(institutionId!, filters),
    enabled: Boolean(enabled && institutionId),
  });
}

export function useTeacherBookOfferings(
  institutionId: string | null,
  profileId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: bookRecommendationKeys.offerings(institutionId, profileId),
    queryFn: () => bookRecommendationService.listTeacherOfferings(institutionId!, profileId!),
    enabled: Boolean(enabled && institutionId && profileId),
  });
}

function invalidateBookRecommendations(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: bookRecommendationKeys.all });
}

export function useCreateBookRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, createdBy }: { input: BookRecommendationInput; createdBy: string }) =>
      bookRecommendationService.create(input, createdBy),
    onSuccess: () => invalidateBookRecommendations(queryClient),
  });
}

export function useUpdateBookRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookRecommendationInput }) =>
      bookRecommendationService.update(id, input),
    onSuccess: () => invalidateBookRecommendations(queryClient),
  });
}

export function useSetBookRecommendationActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, institutionId, active }: { id: string; institutionId: string; active: boolean }) =>
      bookRecommendationService.setActive(id, institutionId, active),
    onSuccess: () => invalidateBookRecommendations(queryClient),
  });
}
