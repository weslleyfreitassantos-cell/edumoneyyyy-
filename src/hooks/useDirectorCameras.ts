import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cameraService,
  type CameraMutationInput,
} from '../services/cameraService';

export const directorCameraKeys = {
  all: ['director-cameras'] as const,
  list: (institutionId: string | undefined) => [...directorCameraKeys.all, institutionId ?? 'none'] as const,
};

export const directorGatewayKeys = {
  all: ['director-camera-gateways'] as const,
  list: (institutionId: string | undefined) => [...directorGatewayKeys.all, institutionId ?? 'none'] as const,
};

export function useDirectorCameras(institutionId: string | null) {
  return useQuery({
    queryKey: directorCameraKeys.list(institutionId ?? undefined),
    queryFn: () => cameraService.list(institutionId as string),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
    refetchInterval: 30_000,
  });
}

export function useDirectorCameraGateways(institutionId: string | null) {
  return useQuery({
    queryKey: directorGatewayKeys.list(institutionId ?? undefined),
    queryFn: () => cameraService.listGateways(institutionId as string),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 30,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

function useCameraMutation(institutionId: string | null) {
  const queryClient = useQueryClient();
  return {
    queryClient,
    invalidate: () => queryClient.invalidateQueries({ queryKey: directorCameraKeys.list(institutionId ?? undefined) }),
  };
}

export function useCreateDirectorCamera(institutionId: string | null) {
  const context = useCameraMutation(institutionId);
  return useMutation({
    mutationFn: (input: CameraMutationInput) => cameraService.create(input),
    onSuccess: context.invalidate,
  });
}

export function useUpdateDirectorCamera(institutionId: string | null) {
  const context = useCameraMutation(institutionId);
  return useMutation({
    mutationFn: ({ cameraId, input }: { cameraId: string; input: CameraMutationInput }) => cameraService.update(cameraId, input),
    onSuccess: context.invalidate,
  });
}

export function useSetDirectorCameraActive(institutionId: string | null) {
  const context = useCameraMutation(institutionId);
  return useMutation({
    mutationFn: ({ cameraId, active }: { cameraId: string; active: boolean }) => cameraService.setActive(cameraId, active),
    onSuccess: context.invalidate,
  });
}

export function useDeleteDirectorCamera(institutionId: string | null) {
  const context = useCameraMutation(institutionId);
  return useMutation({
    mutationFn: (cameraId: string) => cameraService.remove(cameraId),
    onSuccess: context.invalidate,
  });
}
