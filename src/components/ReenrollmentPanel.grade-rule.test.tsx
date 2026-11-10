// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMyStatus: vi.fn(),
  listRequests: vi.fn(),
  createRequest: vi.fn(),
}));

vi.mock("../services/reenrollmentService", () => ({
  reenrollmentService: {
    getMyStatus: mocks.getMyStatus,
    listRequests: mocks.listRequests,
    createRequest: mocks.createRequest,
  },
}));

import ReenrollmentPanel from "./ReenrollmentPanel";
import type { MyReenrollmentStatus } from "../services/reenrollmentService";

describe("ReenrollmentPanel grade setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRequests.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("explains missing progression setup and does not offer a failing start action", async () => {
    mocks.getMyStatus.mockResolvedValue({
      state: "AVAILABLE",
      campaigns: [{
        campaign: {
          id: "campaign-1",
          title: "Rematrícula 2027",
          status: "OPEN",
          opens_at: "2026-01-01T00:00:00.000Z",
          closes_at: "2026-01-02T00:00:00.000Z",
        },
        state: "OPEN",
        eligible_students: [{
          student_id: "student-1",
          can_confirm: true,
          eligibility_state: "GRADE_RULE_REQUIRED",
          current_grade_level: "1º ano",
        }],
      }],
    } as unknown as MyReenrollmentStatus);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ReenrollmentPanel
          institutionId="school-1"
          studentIds={["student-1"]}
          studentNames={{ "student-1": "Aluno Teste" }}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/A escola precisa configurar a progressão desta série/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
    expect(mocks.createRequest).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
