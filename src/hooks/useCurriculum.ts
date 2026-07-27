import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminOverviewKeys } from './useAdminOverview';
import { classKeys } from './useClasses';
import { subjectKeys } from './useSubjects';
import { assignmentKeys } from './useAssignments';
import {
  curriculumService,
  type CurriculumItemRow,
  type CurriculumCreateData,
  type CurriculumUpdateData,
} from '../services/curriculumService';

export const curriculumKeys = {
  all: ['curriculum'] as const,
  list: (institutionId: string) => [...curriculumKeys.all, institutionId] as const,
};

function invalidateCurriculum(
  queryClient: ReturnType<typeof useQueryClient>,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: curriculumKeys.list(institutionId) }),
    queryClient.invalidateQueries({ queryKey: classKeys.list(institutionId) }),
    queryClient.invalidateQueries({ queryKey: subjectKeys.list(institutionId) }),
    queryClient.invalidateQueries({ queryKey: assignmentKeys.list(institutionId) }),
    queryClient.invalidateQueries({ queryKey: adminOverviewKeys.detail(institutionId) }),
  ]);
}

export function useCurriculum(institutionId: string) {
  return useQuery<CurriculumItemRow[]>({
    queryKey: curriculumKeys.list(institutionId),
    queryFn: () => curriculumService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateCurriculumItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CurriculumCreateData) => curriculumService.create(data),
    onSuccess: async (_result, variables) => {
      await invalidateCurriculum(queryClient, variables.institution_id);
    },
  });
}

export function useUpdateCurriculumItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: CurriculumUpdateData;
    }) => curriculumService.update(id, institutionId, data),
    onSuccess: async (_result, variables) => {
      await invalidateCurriculum(queryClient, variables.institutionId);
    },
  });
}

export function useSetCurriculumItemActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      active,
    }: {
      id: string;
      institutionId: string;
      active: boolean;
    }) => curriculumService.setActive(id, institutionId, active),
    onSuccess: async (_result, variables) => {
      await invalidateCurriculum(queryClient, variables.institutionId);
    },
  });
}
