import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  reenrollmentService,
  type ReenrollmentReviewInput,
  type ReenrollmentAnnualResultInput,
  type ReenrollmentGradeRule,
} from "../services/reenrollmentService";

export const reenrollmentKeys = {
  all: ["reenrollment"] as const,
  campaigns: (institutionId: string) =>
    [...reenrollmentKeys.all, "campaigns", institutionId] as const,
  gradeRules: (institutionId: string) =>
    [...reenrollmentKeys.all, "grade-rules", institutionId] as const,
  status: (institutionId: string, studentIdsKey: string) =>
    [...reenrollmentKeys.all, "status", institutionId, studentIdsKey] as const,
  requests: (institutionId: string, campaignId?: string) =>
    [
      ...reenrollmentKeys.all,
      "requests",
      institutionId,
      campaignId ?? "all",
    ] as const,
  dashboard: (
    institutionId: string,
    campaignId: string | undefined,
    page: number,
    pageSize: number,
  ) =>
    [
      ...reenrollmentKeys.all,
      "dashboard",
      institutionId,
      campaignId ?? "all",
      page,
      pageSize,
    ] as const,
};

export function useReenrollmentCampaigns(institutionId: string) {
  return useQuery({
    queryKey: reenrollmentKeys.campaigns(institutionId),
    queryFn: () => reenrollmentService.listCampaigns(institutionId),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useReenrollmentGradeRules(institutionId: string) {
  return useQuery({
    queryKey: reenrollmentKeys.gradeRules(institutionId),
    queryFn: () => reenrollmentService.listGradeRules(institutionId),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useSaveReenrollmentGradeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      institutionId: string;
      sourceGradeLevel: string;
      destinationGradeLevel: string | null;
      destinationStage: string | null;
      promotionPolicy: ReenrollmentGradeRule["promotion_policy"];
    }) => reenrollmentService.saveGradeRule(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reenrollmentKeys.gradeRules(result.institution_id),
        }),
        queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all }),
      ]);
    },
  });
}

export function useReenrollmentRequests(
  institutionId: string,
  campaignId?: string,
) {
  return useQuery({
    queryKey: reenrollmentKeys.requests(institutionId, campaignId),
    queryFn: () => reenrollmentService.listRequests(institutionId, campaignId),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 30,
  });
}

export function useReenrollmentDashboard(
  institutionId: string,
  campaignId: string | undefined,
  page: number,
  pageSize = 10,
) {
  return useQuery({
    queryKey: reenrollmentKeys.dashboard(
      institutionId,
      campaignId,
      page,
      pageSize,
    ),
    queryFn: () =>
      reenrollmentService.getDashboard(
        institutionId,
        campaignId,
        page,
        pageSize,
      ),
    enabled: Boolean(institutionId && campaignId),
    staleTime: 1000 * 30,
  });
}

export function useReviewReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReenrollmentReviewInput) =>
      reenrollmentService.reviewRequest(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: reenrollmentKeys.requests(result.institution_id),
      });
    },
  });
}

export function useCreateReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      studentId,
    }: {
      campaignId: string;
      studentId: string;
    }) => reenrollmentService.createRequest(campaignId, studentId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: reenrollmentKeys.requests(result.institution_id),
      });
    },
  });
}

export function useAcceptReenrollmentContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      contractVersion,
      contractHash,
    }: {
      requestId: string;
      contractVersion: string;
      contractHash: string;
    }) =>
      reenrollmentService.acceptContract(
        requestId,
        contractVersion,
        contractHash,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useConfirmReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      reenrollmentService.confirmRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useHomologateReenrollmentResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReenrollmentAnnualResultInput) =>
      reenrollmentService.homologateAnnualResult(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: reenrollmentKeys.requests(result.institution_id),
      });
    },
  });
}

export function useCloseReenrollmentAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      institutionId,
      academicYearId,
      notes,
    }: {
      institutionId: string;
      academicYearId: string;
      notes?: string | null;
    }) =>
      reenrollmentService.closeAcademicYear(
        institutionId,
        academicYearId,
        notes,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useEnsureReenrollmentFinance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      reenrollmentService.ensureFinance(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useClearReenrollmentFinance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      status,
      notes,
    }: {
      requestId: string;
      status: "CLEARED" | "BLOCKED" | "WAIVED";
      notes?: string | null;
    }) => reenrollmentService.clearFinance(requestId, status, notes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}

export function useFinalizeReenrollmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      reenrollmentService.finalizeRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });
    },
  });
}
