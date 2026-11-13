// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reenrollmentKeys } from "../hooks/useReenrollment";
import { reenrollmentService } from "../services/reenrollmentService";
import type { MyReenrollmentStatus, ReenrollmentCampaign, ReenrollmentRequest } from "../services/reenrollmentService";
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
const secondStudentId = "student-2";
const campaignId = "campaign-1";
const contractHash = "sha256:test";

function availableStatus(canConfirm: boolean): MyReenrollmentStatus {
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
        contract_hash: contractHash,
        contract_body: "Termos completos de teste para a campanha de rematrícula escolar.",
      } as ReenrollmentCampaign,
      eligible_students: [{
        student_id: studentId,
        can_confirm: canConfirm,
        eligibility_state: "ELIGIBLE",
        current_grade_level: "1º ano",
      }],
    }],
  };
}

function renderPanel(
  props: Partial<ComponentProps<typeof ReenrollmentPanel>> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ReenrollmentPanel institutionId={institutionId} studentIds={[studentId]} {...props} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
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

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("A escola ainda não publicou uma campanha de rematrícula.")).toBeTruthy();
    expect(reenrollmentService.getMyStatus).toHaveBeenCalledTimes(2);
  });

  it("não permite ao estudante menor confirmar por conta própria", async () => {
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(availableStatus(false));

    renderPanel({ studentNames: { [studentId]: "Estudante menor" } });

    expect(await screen.findByText("A confirmação deve ser feita pelo responsável legal.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
  });

  it("mostra individualmente dependentes elegíveis e inelegíveis em séries diferentes", async () => {
    const status = availableStatus(true);
    status.campaigns[0].eligible_students.push({
      student_id: secondStudentId,
      can_confirm: true,
      eligibility_state: "STUDENT_INELIGIBLE",
      current_grade_level: "2º ano",
    });
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(status);

    renderPanel({
      studentIds: [studentId, secondStudentId],
      studentNames: { [studentId]: "Aluno do 1º ano", [secondStudentId]: "Aluno do 2º ano" },
    });

    expect(await screen.findByText("Aluno do 1º ano")).toBeTruthy();
    expect(screen.getByText("Aluno do 2º ano")).toBeTruthy();
    expect(screen.getByText("A série atual (2º ano) não está incluída nesta campanha.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Iniciar" })).toHaveLength(1);
  });

  it("explica quando falta matrícula de origem e não permite iniciar", async () => {
    const status = availableStatus(true);
    status.campaigns[0].eligible_students[0].eligibility_state = "SOURCE_ENROLLMENT_MISSING";
    status.campaigns[0].eligible_students[0].current_grade_level = null;
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(status);

    renderPanel({ studentNames: { [studentId]: "Aluno sem matrícula" } });

    expect(await screen.findByText("Matrícula do ano de origem não localizada. Peça à Secretaria que confira o vínculo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar" })).toBeNull();
  });

  it("mostra o contrato antes do aceite, exige confirmação explícita e exibe o protocolo", async () => {
    const status = availableStatus(true);
    const pendingRequest = {
      id: "request-1",
      institution_id: institutionId,
      campaign_id: campaignId,
      student_id: studentId,
      request_status: "PENDING_CONFIRMATION",
      protocol: "REM-2027-0001",
      receipt_code: null,
    } as ReenrollmentRequest;
    let created = false;
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(status);
    vi.mocked(reenrollmentService.listRequests).mockImplementation(async () => created ? [pendingRequest] : []);
    vi.mocked(reenrollmentService.createRequest).mockImplementation(async () => {
      created = true;
      return pendingRequest;
    });
    vi.mocked(reenrollmentService.acceptContract).mockResolvedValue({} as never);
    vi.mocked(reenrollmentService.confirmRequest).mockResolvedValue({} as never);

    renderPanel({ studentNames: { [studentId]: "Aluno autorizado" } });
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar" }));

    expect(await screen.findByText(status.campaigns[0].campaign.contract_body)).toBeTruthy();
    expect(screen.getByText("Protocolo: REM-2027-0001")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Aceitar e confirmar rematrícula de Aluno autorizado" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Li e aceito o contrato da rematrícula de Aluno autorizado." }));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(reenrollmentService.acceptContract).toHaveBeenCalledWith("request-1", "v1", contractHash);
      expect(reenrollmentService.confirmRequest).toHaveBeenCalledWith("request-1");
    });
  });

  it("atualiza após invalidação compartilhada sem remontar o painel", async () => {
    vi.mocked(reenrollmentService.getMyStatus)
      .mockResolvedValueOnce({ state: "NO_CAMPAIGN", campaigns: [] })
      .mockResolvedValueOnce(availableStatus(true));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    renderPanel({}, queryClient);
    expect(await screen.findByText("A escola ainda não publicou uma campanha de rematrícula.")).toBeTruthy();

    await queryClient.invalidateQueries({ queryKey: reenrollmentKeys.all });

    expect(await screen.findByRole("button", { name: "Iniciar" })).toBeTruthy();
    expect(reenrollmentService.getMyStatus).toHaveBeenCalledTimes(2);
  });

  it("explica quando a campanha ainda não abriu", async () => {
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue({
      state: "CAMPAIGN_UPCOMING",
      campaigns: [],
    });

    renderPanel();

    expect(await screen.findByText("O período de confirmação ainda não começou. A escola divulgará a rematrícula quando estiver disponível.")).toBeTruthy();
  });

  it("mostra o boleto da rematrícula quando a cobrança já foi preparada", async () => {
    vi.mocked(reenrollmentService.getMyStatus).mockResolvedValue(availableStatus(true));
    vi.mocked(reenrollmentService.listRequests).mockResolvedValue([{
      id: "request-finance-1",
      institution_id: institutionId,
      campaign_id: campaignId,
      student_id: studentId,
      request_status: "AWAITING_PAYMENT",
      financial_status: "PENDING",
      protocol: "REM-2027-0002",
      primary_invoice: {
        id: "invoice-1",
        reference: "Rematrícula 2027",
        due_date: "2026-12-10",
        amount_due: 120000,
        amount_paid: 0,
        status: "OPEN",
      },
    } as ReenrollmentRequest]);

    renderPanel({ studentNames: { [studentId]: "Aluno com cobrança" } });

    fireEvent.click(await screen.findByRole("button", { name: "Acessar boleto da rematrícula" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Boleto da rematrícula")).toBeTruthy();
    expect(within(dialog).getByText("Rematrícula 2027")).toBeTruthy();
    expect(within(dialog).getByText(/1\.200,00/)).toBeTruthy();
    expect(within(dialog).getByText(/PDF, código de barras e linha digitável/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fechar cobrança da rematrícula" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
