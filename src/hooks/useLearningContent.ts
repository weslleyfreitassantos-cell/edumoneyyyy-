import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  learningContentService,
  type LearningPostFilters,
  type SaveLearningPostInput,
  type UpdateLearningPostInput,
} from '../services/learningContentService';

export const learningContentKeys = {
  all: ['learning-content'] as const,
  posts: (
    institutionId: string | null,
    profileId: string | null,
    filters: LearningPostFilters,
  ) => ['learning-content', 'posts', institutionId, profileId, filters] as const,
  targets: (institutionId: string | null) =>
    ['learning-content', 'targets', institutionId] as const,
};

export function useLearningPosts(
  institutionId: string | null,
  profileId: string | null,
  filters: LearningPostFilters,
) {
  return useQuery({
    queryKey: learningContentKeys.posts(institutionId, profileId, filters),
    queryFn: () => learningContentService.listPosts(institutionId!, profileId!, filters),
    enabled: Boolean(institutionId && profileId),
  });
}

export function useTeacherLearningTargets(institutionId: string | null) {
  return useQuery({
    queryKey: learningContentKeys.targets(institutionId),
    queryFn: () => learningContentService.listTeacherTargets(institutionId!),
    enabled: Boolean(institutionId),
  });
}

export function useStudentLearningTargets(institutionId: string | null) {
  return useQuery({
    queryKey: ['learning-content', 'student-targets', institutionId] as const,
    queryFn: () => learningContentService.listStudentTargets(institutionId!),
    enabled: Boolean(institutionId),
  });
}

function invalidateLearningPosts(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    queryKey: learningContentKeys.all,
  });
}

export function useCreateLearningPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveLearningPostInput) => learningContentService.createPost(input),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}

export function useUpdateLearningPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLearningPostInput) => learningContentService.updatePost(input),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}

export function useArchiveLearningPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => learningContentService.archivePost(postId),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}

export function useToggleLearningPostPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; pinned: boolean }) =>
      learningContentService.togglePinned(input.postId, input.pinned),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}

export function useDeleteLearningPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => learningContentService.deletePost(postId),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}

export function useMarkLearningPostRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; profileId: string }) =>
      learningContentService.markPostRead(input.postId, input.profileId),
    onSuccess: () => invalidateLearningPosts(queryClient),
  });
}
