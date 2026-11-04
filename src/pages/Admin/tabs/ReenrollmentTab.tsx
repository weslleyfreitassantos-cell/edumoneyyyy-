import { useMemo, useState } from "react";
import { ClipboardCheck, LoaderCircle, Plus, RefreshCw } from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { useAcademicYears } from "../../../hooks/useAcademicStructure";
import { useClasses } from "../../../hooks/useClasses";
import { useCurrentInstitution } from "../../../hooks/useCurrentInstitution";
import {
  useCreateReenrollmentCampaign,
  useCloseReenrollmentAcademicYear,
  useClearReenrollmentFinance,
  useEnsureReenrollmentFinance,
  useFinalizeReenrollmentRequest,
  useHomologateReenrollmentResult,
  useReenrollmentDashboard,
  useReenrollmentCampaigns,
  useReviewReenrollmentRequest,
  useSetReenrollmentCampaignStatus,
} from "../../../hooks/useReenrollment";
import type {
  ReenrollmentAcademicStatus,
  ReenrollmentCampaign,
  ReenrollmentCampaignDraft,
  ReenrollmentFinancialStatus,
  ReenrollmentRequest,
} from "../../../services/reenrollmentService";

const dateTimeValue = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function statusLabel(status: string): string {
  return (
    {
      DRAFT: "Rascunho",
      OPEN: "Aberta",
      CLOSED: "Encerrada",
      CANCELLED: "Cancelada",
      ARCHIVED: "Arquivada",
      PENDING_CONFIRMATION: "Aguardando confirmação",
      CONFIRMED: "Confirmada",
      AWAITING_ACADEMIC_RESULT: "Aguardando resultado",
      AWAITING_PAYMENT: "Aguardando financeiro",
      READY_FOR_ENROLLMENT: "Pronta para matrícula",
      ENROLLED: "Matriculada",
      APPROVED: "Aprovado",
      RECOVERY: "Recuperação",
      RETAINED: "Retido",
      TRANSFERRED: "Transferido",
      INELIGIBLE: "Não elegível",
      FAILED: "Reprovado",
      INCOMPLETE: "Resultado incompleto",
      GRADUATING: "Concluinte",
      NOT_EVALUATED: "Não avaliado",
      PENDING: "Pendente",
      CLEARED: "Liberado",
      BLOCKED: "Bloqueado",
      NOT_REQUIRED: "Não exigido",
      WAIVED: "Dispensado",
    }[status] ?? status
  );
}

function campaignYearName(
  yearId: string,
  years: Array<{ id: string; name: string }>,
): string {
  return years.find((year) => year.id === yearId)?.name ?? "Ano não encontrado";
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export default function ReenrollmentTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? "";
  const yearsQuery = useAcademicYears(institutionId);
  const classesQuery = useClasses(institutionId);
  const campaignsQuery = useReenrollmentCampaigns(institutionId);
  const createCampaignMutation = useCreateReenrollmentCampaign();
  const reviewMutation = useReviewReenrollmentRequest();
  const homologateMutation = useHomologateReenrollmentResult();
  const closeYearMutation = useCloseReenrollmentAcademicYear();
  const financeMutation = useEnsureReenrollmentFinance();
  const clearFinanceMutation = useClearReenrollmentFinance();
  const finalizeMutation = useFinalizeReenrollmentRequest();
  const statusMutation = useSetReenrollmentCampaignStatus();
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    string | undefined
  >();
  const [dashboardPage, setDashboardPage] = useState(1);
  const dashboardQuery = useReenrollmentDashboard(
    institutionId,
    selectedCampaignId,
    dashboardPage,
    10,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [destinationClassByRequest, setDestinationClassByRequest] = useState<
    Record<string, string>
  >({});
  const [financialStatusByRequest, setFinancialStatusByRequest] = useState<
    Record<string, ReenrollmentFinancialStatus>
  >({});
  const [draft, setDraft] = useState<ReenrollmentCampaignDraft>({
    institution_id: institutionId,
    source_academic_year_id: "",
    destination_academic_year_id: "",
    title: "Rematrícula para o próximo ano letivo",
    description: "",
    status: "DRAFT",
    opens_at: dateTimeValue(0),
    closes_at: dateTimeValue(30),
    contract_version: "v1",
    contract_hash: "PREENCHER-HASH-DO-CONTRATO",
    contract_body:
      "Declaro que conferi os dados e solicito a continuidade da matrícula do estudante.",
    finance_mode: "NOT_REQUIRED",
    finance_monthly_amount_cents: null,
    finance_enrollment_fee_cents: 0,
    finance_installment_count: null,
    finance_first_due_date: null,
    finance_due_day: null,
    finance_allow_manual_clearance: false,
    created_by: profile?.id ?? "",
  });

  const campaigns = campaignsQuery.data ?? [];
  const years = yearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const destinationClasses = useMemo(
    () =>
      classes.filter(
        (classRow) =>
          classRow.academic_year_id ===
          selectedCampaign?.destination_academic_year_id,
      ),
    [classes, selectedCampaign?.destination_academic_year_id],
  );

  function openCreateForm() {
    setFormError(null);
    setFeedback(null);
    setDraft((current) => ({
      ...current,
      institution_id: institutionId,
      created_by: profile?.id ?? "",
      source_academic_year_id:
        current.source_academic_year_id || years[0]?.id || "",
      destination_academic_year_id:
        current.destination_academic_year_id || years[1]?.id || "",
    }));
    setFormOpen(true);
  }

  async function submitCampaign() {
    setFormError(null);
    setFeedback(null);
    try {
      const campaign = await createCampaignMutation.mutateAsync({
        ...draft,
        institution_id: institutionId,
        created_by: profile?.id ?? "",
      });
      setSelectedCampaignId(campaign.id);
      setFormOpen(false);
      setFeedback(
        "Campanha salva em rascunho. A abertura continua sob controle da escola.",
      );
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  async function reviewRequest(
    request: ReenrollmentRequest,
    academicStatus: ReenrollmentAcademicStatus,
  ) {
    if (academicStatus === "NOT_EVALUATED") return;
    try {
      await reviewMutation.mutateAsync({
        requestId: request.id,
        academicStatus,
        financialStatus:
          financialStatusByRequest[request.id] ?? request.financial_status,
        destinationClassId:
          destinationClassByRequest[request.id] ?? request.destination_class_id,
      });
      setFeedback(
        "Resultado acadêmico atualizado. Nenhuma matrícula ou cobrança foi criada.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function homologateRequest(request: ReenrollmentRequest) {
    if (
      request.academic_status === "NOT_EVALUATED" ||
      request.academic_status === "PENDING"
    )
      return;
    try {
      await homologateMutation.mutateAsync({
        requestId: request.id,
        resultStatus: request.academic_status,
        destinationGradeLevel: request.destination_grade_level,
        notes: request.notes,
      });
      setFeedback(
        "Resultado anual homologado. A efetivação continuará bloqueada enquanto houver pendências.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function prepareFinance(request: ReenrollmentRequest) {
    try {
      await financeMutation.mutateAsync(request.id);
      setFeedback("Vínculo financeiro preparado de forma idempotente.");
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function clearFinance(request: ReenrollmentRequest) {
    try {
      await clearFinanceMutation.mutateAsync({
        requestId: request.id,
        status: "CLEARED",
        notes:
          "Baixa manual autorizada pela instituição, sem liquidação bancária automática.",
      });
      setFeedback(
        "Financeiro liberado com auditoria explícita de baixa manual.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function closeSourceYear() {
    if (!selectedCampaign) return;
    try {
      await closeYearMutation.mutateAsync({
        institutionId,
        academicYearId: selectedCampaign.source_academic_year_id,
        notes: `Fechamento para a campanha ${selectedCampaign.title}`,
      });
      setFeedback(
        "Ano letivo fechado para homologação dos resultados da rematrícula.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function finalizeRequest(request: ReenrollmentRequest) {
    try {
      const result = (await finalizeMutation.mutateAsync(request.id)) as {
        ready?: boolean;
        receipt_code?: string;
        pending_reason?: string;
        blockers?: string[];
      };
      if (result.ready) {
        setFeedback(
          `Rematrícula efetivada. Comprovante ${result.receipt_code ?? request.protocol}.`,
        );
      } else {
        setFeedback(
          `Ainda não efetivada: ${result.pending_reason ?? result.blockers?.join(", ") ?? "há pendências verificáveis."}`,
        );
      }
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function setCampaignStatus(
    campaign: ReenrollmentCampaign,
    status: "OPEN" | "CLOSED",
  ) {
    try {
      await statusMutation.mutateAsync({
        campaignId: campaign.id,
        institutionId,
        status,
      });
      setFeedback(
        status === "OPEN"
          ? "Campanha aberta para os responsáveis e alunos."
          : "Campanha encerrada.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  if (campaignsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-[#667085]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando campanhas
        de rematrícula...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">
            Operação escolar
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#181c20]">
            Rematrícula automática
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#667085]">
            Prepare campanhas anuais, acompanhe confirmações e revise o
            resultado acadêmico antes de qualquer matrícula definitiva.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9c]"
        >
          <Plus className="h-4 w-4" /> Nova campanha
        </button>
      </header>

      {feedback && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {feedback}
        </div>
      )}

      {formOpen && (
        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#181c20]">
              Configurar campanha
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm font-semibold text-[#667085]"
            >
              Fechar
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-[#414754] md:col-span-2">
              Título
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Ano de origem
              <select
                value={draft.source_academic_year_id}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    source_academic_year_id: event.target.value,
                  })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              >
                <option value="">Selecione</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Ano de destino
              <select
                value={draft.destination_academic_year_id}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    destination_academic_year_id: event.target.value,
                  })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              >
                <option value="">Selecione</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Abertura
              <input
                type="datetime-local"
                value={draft.opens_at}
                onChange={(event) =>
                  setDraft({ ...draft, opens_at: event.target.value })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Encerramento
              <input
                type="datetime-local"
                value={draft.closes_at}
                onChange={(event) =>
                  setDraft({ ...draft, closes_at: event.target.value })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754] md:col-span-2">
              Texto do contrato
              <textarea
                value={draft.contract_body}
                onChange={(event) =>
                  setDraft({ ...draft, contract_body: event.target.value })
                }
                className="mt-1 min-h-24 w-full rounded-lg border border-[#cbd5e1] px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Versão
              <input
                value={draft.contract_version}
                onChange={(event) =>
                  setDraft({ ...draft, contract_version: event.target.value })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Hash do contrato
              <input
                value={draft.contract_hash}
                onChange={(event) =>
                  setDraft({ ...draft, contract_hash: event.target.value })
                }
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[#414754]">
              Cobrança da rematrícula
              <select
                value={draft.finance_mode ?? "NOT_REQUIRED"}
                onChange={(event) => {
                  const financeMode = event.target.value as
                    "NOT_REQUIRED" | "MANUAL" | "AUTO";
                  setDraft({
                    ...draft,
                    finance_mode: financeMode,
                    require_financial_clearance: financeMode !== "NOT_REQUIRED",
                    finance_allow_manual_clearance:
                      financeMode === "MANUAL"
                        ? draft.finance_allow_manual_clearance
                        : false,
                  });
                }}
                className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] px-3 font-normal"
              >
                <option value="NOT_REQUIRED">Não exigir</option>
                <option value="MANUAL">Recebimento manual autorizado</option>
                <option value="AUTO">Gerar contrato e faturas</option>
              </select>
            </label>
            {draft.finance_mode !== "NOT_REQUIRED" && (
              <div className="grid gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4 md:col-span-2 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#414754]">
                  Mensalidade (centavos)
                  <input
                    type="number"
                    min="1"
                    value={draft.finance_monthly_amount_cents ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_monthly_amount_cents: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-[#414754]">
                  Taxa de matrícula (centavos)
                  <input
                    type="number"
                    min="0"
                    value={draft.finance_enrollment_fee_cents ?? 0}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_enrollment_fee_cents:
                          Number(event.target.value) || 0,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-[#414754]">
                  Quantidade de parcelas
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={draft.finance_installment_count ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_installment_count: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-[#414754]">
                  Primeiro vencimento
                  <input
                    type="date"
                    value={draft.finance_first_due_date ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_first_due_date: event.target.value || null,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-[#414754]">
                  Dia padrão de vencimento
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={draft.finance_due_day ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_due_day: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 font-normal"
                  />
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-[#414754]">
                  <input
                    type="checkbox"
                    checked={draft.finance_allow_manual_clearance ?? false}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        finance_allow_manual_clearance: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  Permitir baixa manual sem liquidação bancária
                </label>
              </div>
            )}
          </div>
          {formError && (
            <p className="mt-3 text-sm text-red-700">{formError}</p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={createCampaignMutation.isPending}
              onClick={() => void submitCampaign()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {createCampaignMutation.isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}{" "}
              Salvar rascunho
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <div className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-[#181c20]">Campanhas</h2>
            <RefreshCw className="h-4 w-4 text-[#7b879d]" />
          </div>
          <div className="mt-3 space-y-2">
            {campaigns.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#cbd5e1] p-4 text-sm text-[#667085]">
                Nenhuma campanha criada ainda.
              </p>
            )}
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`w-full rounded-lg border p-3 transition-colors ${selectedCampaignId === campaign.id ? "border-[#005bbf] bg-blue-50" : "border-[#e2e8f0] hover:bg-slate-50"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaignId(campaign.id);
                    setDashboardPage(1);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[#181c20]">
                      {campaign.title}
                    </span>
                    <span className="text-xs font-bold text-[#005bbf]">
                      {statusLabel(campaign.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#667085]">
                    {campaignYearName(campaign.source_academic_year_id, years)}{" "}
                    →{" "}
                    {campaignYearName(
                      campaign.destination_academic_year_id,
                      years,
                    )}
                  </p>
                </button>
                <div className="mt-2 flex gap-2">
                  {campaign.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => void setCampaignStatus(campaign, "OPEN")}
                      disabled={statusMutation.isPending}
                      className="text-xs font-bold text-emerald-700"
                    >
                      Abrir campanha
                    </button>
                  )}
                  {campaign.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => void setCampaignStatus(campaign, "CLOSED")}
                      disabled={statusMutation.isPending}
                      className="text-xs font-bold text-amber-700"
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
          {!selectedCampaign ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center text-sm text-[#667085]">
              <ClipboardCheck className="mb-3 h-8 w-8 text-[#7b879d]" />
              Selecione uma campanha para acompanhar as solicitações.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#181c20]">Solicitações</h2>
                  <p className="text-sm text-[#667085]">
                    {selectedCampaign.title}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void closeSourceYear()}
                    disabled={closeYearMutation.isPending}
                    className="inline-flex min-h-8 items-center gap-2 rounded-md border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800 disabled:opacity-60"
                  >
                    {closeYearMutation.isPending && (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Fechar ano de origem
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#414754]">
                    {dashboardQuery.data?.total_count ?? 0} registros
                  </span>
                </div>
              </div>
              {dashboardQuery.isLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-[#667085]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />{" "}
                  Carregando...
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {(dashboardQuery.data?.rows ?? []).length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#cbd5e1] p-4 text-sm text-[#667085]">
                      As solicitações aparecerão quando responsáveis ou alunos
                      iniciarem a campanha.
                    </p>
                  )}
                  {(dashboardQuery.data?.rows ?? []).map((request) => (
                    <article
                      key={request.id}
                      className="rounded-lg border border-[#e2e8f0] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#181c20]">
                            {request.student_name ??
                              `Aluno ${request.student_id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-[#667085]">
                            Protocolo {request.protocol} ·{" "}
                            {request.source_grade_level ??
                              "Série não informada"}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                          {statusLabel(request.request_status)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-[#667085]">Resultado</p>
                          <p className="text-sm font-semibold">
                            {statusLabel(request.academic_status)}
                          </p>
                        </div>
                        <label className="text-xs font-semibold text-[#667085]">
                          Financeiro
                          <select
                            value={
                              financialStatusByRequest[request.id] ??
                              request.financial_status
                            }
                            onChange={(event) =>
                              setFinancialStatusByRequest((current) => ({
                                ...current,
                                [request.id]: event.target
                                  .value as ReenrollmentFinancialStatus,
                              }))
                            }
                            className="mt-1 min-h-9 w-full rounded-md border border-[#cbd5e1] px-2 text-sm font-normal"
                          >
                            {(
                              [
                                "NOT_REQUIRED",
                                "PENDING",
                                "CLEARED",
                                "BLOCKED",
                                "WAIVED",
                              ] as const
                            ).map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-[#667085]">
                          Turma de destino
                          <select
                            value={
                              destinationClassByRequest[request.id] ??
                              request.destination_class_id ??
                              ""
                            }
                            onChange={(event) =>
                              setDestinationClassByRequest((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                            className="mt-1 min-h-9 w-full rounded-md border border-[#cbd5e1] px-2 text-sm font-normal"
                          >
                            <option value="">Ainda não definida</option>
                            {destinationClasses.map((classRow) => (
                              <option key={classRow.id} value={classRow.id}>
                                {classRow.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {request.pending_reason && (
                        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                          Pendência: {request.pending_reason}
                        </p>
                      )}
                      {request.receipt_code && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Comprovante: {request.receipt_code}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.request_status === "CONFIRMED" &&
                          (
                            [
                              "APPROVED",
                              "RECOVERY",
                              "RETAINED",
                              "FAILED",
                              "INCOMPLETE",
                              "GRADUATING",
                              "INELIGIBLE",
                            ] as const
                          ).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                void reviewRequest(request, status)
                              }
                              disabled={reviewMutation.isPending}
                              className="rounded-md border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#414754] hover:bg-slate-50 disabled:opacity-60"
                            >
                              {statusLabel(status)}
                            </button>
                          ))}
                        {!["NOT_EVALUATED", "PENDING"].includes(
                          request.academic_status,
                        ) && (
                          <button
                            type="button"
                            onClick={() => void homologateRequest(request)}
                            disabled={homologateMutation.isPending}
                            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          >
                            Homologar resultado
                          </button>
                        )}
                        {selectedCampaign.require_financial_clearance &&
                          request.request_status !== "ENROLLED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => void prepareFinance(request)}
                                disabled={financeMutation.isPending}
                                className="rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-60"
                              >
                                Preparar financeiro
                              </button>
                              {selectedCampaign.finance_allow_manual_clearance && (
                                <button
                                  type="button"
                                  onClick={() => void clearFinance(request)}
                                  disabled={clearFinanceMutation.isPending}
                                  className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-60"
                                >
                                  Liberar manualmente
                                </button>
                              )}
                            </>
                          )}
                        <button
                          type="button"
                          onClick={() => void finalizeRequest(request)}
                          disabled={
                            finalizeMutation.isPending ||
                            request.request_status === "ENROLLED"
                          }
                          className="rounded-md bg-[#005bbf] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Verificar efetivação
                        </button>
                      </div>
                    </article>
                  ))}
                  {(dashboardQuery.data?.total_count ?? 0) > 10 && (
                    <div className="flex items-center justify-between gap-3 border-t border-[#e2e8f0] pt-3 text-xs text-[#667085]">
                      <span>
                        Página {dashboardQuery.data?.page ?? dashboardPage} de{" "}
                        {Math.max(
                          1,
                          Math.ceil(
                            (dashboardQuery.data?.total_count ?? 0) / 10,
                          ),
                        )}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDashboardPage((page) => Math.max(1, page - 1))
                          }
                          disabled={
                            dashboardPage <= 1 || dashboardQuery.isFetching
                          }
                          className="rounded-md border border-[#cbd5e1] px-2.5 py-1.5 font-semibold disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardPage((page) => page + 1)}
                          disabled={
                            dashboardPage >=
                              Math.ceil(
                                (dashboardQuery.data?.total_count ?? 0) / 10,
                              ) || dashboardQuery.isFetching
                          }
                          className="rounded-md border border-[#cbd5e1] px-2.5 py-1.5 font-semibold disabled:opacity-50"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
