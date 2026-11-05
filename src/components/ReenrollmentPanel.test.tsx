// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reenrollmentService } from "../services/reenrollmentService";
import ReenrollmentPanel from "./ReenrollmentPanel";

vi.mock("../services/reenrollmentService", () => ({
  reenrollmentService: {
    getMyStatus: vi.fn(),
    listRequests: vi.fn(),
    createRequest: vi.fn(),
    acceptContract: vi.fn(),
    confirmRequest: vi.fn(),
  },
}));

const institutionId = "institution-1";
const studentId = "student-1";
const campaignId = "campaign-1";

function availableStatus(canConfirm: boolean) {
  const now = Date.now();
  return {
    state: "AVAILABLE",
    campaigns: [{
      state: "OPEN",
      campaign: {
        id: campaignId,
        title: "Rematrícula 2027",
        status: "OPEN",
        opens_at: new Date(now - 60_000).toISOString(),
        closes_at: new Date(now + 86_400_000).toISOString(),
        contract_version: "v1",
        contract_hash: "sha256:test",
        contract_body: "Termos de teste da campanha.",
      },
      eligible_students: [{ student_id: studentId, can_confirm: canConfirm }],
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reenrollmentService.listRequests).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("ReenrollmentPanel", () => {
  it("mostra erro e permite tentar novamente em vez de ocultar falha como lista vazia", async () => {
    vi.mocked(reenrollmentService.getMyStatus)
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce({ state: "NO_CAMPAIGN", campaigns: [] });

    render(<ReenrollmentPanel institutionId={institutionId} studentIds={[studentId]} />);

    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma campanha de rematrícula está disponível no momento.")).toBeTruthy();
    });
    expect(reenrollmentService.getMyStatus).toHaveBeenCalledTimes(2);
  });

  it("não permite ao estudante menor confirmar por conta própria", async () => {
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(availableStatus(false) as never);

    render(<ReenrollmentPanel
      institutionId={institutionId}
      studentIds={[studentId]}
      studentNames={{ [studentId]: "Estudante menor" }}
    />);

    expect(await screen.findByText("A confirmação deve ser feita pelo responsável legal.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
  });
});
