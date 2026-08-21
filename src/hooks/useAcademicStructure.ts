import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';

import {
  academicStructureService,
  type AcademicYearRow,
} from '../services/academicStructureService';

import type {
  AcademicYearFormData,
  AcademicYearUpdateData,
  TermFormData,
  TermUpdateData,
} from '../schemas/adminSchemas';

export const academicStructureKeys = {
  all: ['academic-structure'] as const,

  years: (institutionId: string) =>
    [
      ...academicStructureKeys.all,
      'years',
      institutionId,
    ] as const,
};

function invalidateAcademicStructure(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        academicStructureKeys.years(
          institutionId,
        ),
    }),
    queryClient.invalidateQueries({
      queryKey:
        adminOverviewKeys.detail(
          institutionId,
        ),
    }),
  ]);
}

export function useAcademicYears(
  institutionId: string,
) {
  return useQuery<AcademicYearRow[]>({
    queryKey:
      academicStructureKeys.years(
        institutionId,
      ),

    queryFn: () =>
      academicStructureService
        .listAcademicYears(institutionId),

    enabled: Boolean(institutionId),
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: AcademicYearFormData,
    ) =>
      academicStructureService
        .createAcademicYear(data),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: AcademicYearUpdateData;
    }) =>
      academicStructureService
        .updateAcademicYear(
          id,
          institutionId,
          data,
        ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
    }: {
      id: string;
      institutionId: string;
    }) =>
      academicStructureService.deleteAcademicYear(
        id,
        institutionId,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useSetAcademicYearActive() {
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
    }) =>
      academicStructureService
        .setAcademicYearActive(
          id,
          institutionId,
          active,
        ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      data,
    }: {
      institutionId: string;
      data: TermFormData;
    }) =>
      academicStructureService.createTerm(
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useUpdateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      academicYearId,
      data,
    }: {
      id: string;
      institutionId: string;
      academicYearId: string;
      data: TermUpdateData;
    }) =>
      academicStructureService.updateTerm(
        id,
        institutionId,
        academicYearId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useSetTermActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      academicYearId,
      active,
    }: {
      id: string;
      institutionId: string;
      academicYearId: string;
      active: boolean;
    }) =>
      academicStructureService.setTermActive(
        id,
        institutionId,
        academicYearId,
        active,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAcademicStructure(
        queryClient,
        variables.institutionId,
      );
    },
  });
}
