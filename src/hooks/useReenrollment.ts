import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  reenrollmentService,
  type ReenrollmentCampaignDraft,
  type ReenrollmentReviewInput,
  type ReenrollmentCampaignStatus,
} from '../services/reenrollmentService';

export const reenrollmentKeys = {
  all: ['reenrollment'] as const,
  campaigns: (institutionId: string) => [...reenrollmentKeys.all, 'campaigns', institutionId] as const,
  requests: (institutionId: string, campaignId?: string) => [...reenrollmentKeys.all, 'requests', institutionId, campaignId ?? 'all'] as const,
};

export function useReenrollmentCampaigns(institutionId: string) {
  return useQuery({
    queryKey: reenrollmentKeys.campaigns(institutionId),
    queryFn: () => reenrollmentService.listCampaigns(institutionId),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useReenrollmentRequests(institutionId: string, campaignId?: string) {
  return useQuery({
    queryKey: reenrollmentKeys.requests(institutionId, campaignId),
    queryFn: () => reenrollmentService.listRequests(institutionId, campaignId),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 30,
  });
}

export function useCreateReenrollmentCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReenrollmentCampaignDraft) => reenrollmentService.createCampaign(input),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.campaigns(input.institution_id) });
    },
  });
}

export function useSetReenrollmentCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, institutionId, status }: { campaignId: string; institutionId: string; status: ReenrollmentCampaignStatus }) =>
      reenrollmentService.setCampaignStatus(campaignId, institutionId, status),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.campaigns(input.institutionId) });
    },
  });
}

export function useReviewReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReenrollmentReviewInput) => reenrollmentService.reviewRequest(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.requests(result.institution_id) });
    },
  });
}

export function useCreateReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, studentId }: { campaignId: string; studentId: string }) =>
      reenrollmentService.createRequest(campaignId, studentId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.requests(result.institution_id) });
    },
  });
}

export function useAcceptReenrollmentContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, contractVersion, contractHash }: { requestId: string; contractVersion: string; contractHash: string }) =>
      reenrollmentService.acceptContract(requestId, contractVersion, contractHash),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useConfirmReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => reenrollmentService.confirmRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}
