import { useState } from "react";
import { ClipboardCheck, LoaderCircle, RefreshCw } from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { useAcademicYears } from "../../../hooks/useAcademicStructure";
import { useClasses } from "../../../hooks/useClasses";
import { useCurrentInstitution } from "../../../hooks/useCurrentInstitution";
import ReenrollmentGradeRulesEditor from "../../../components/reenrollment/ReenrollmentGradeRulesEditor";
import {
  formatReenrollmentPendingReason,
  formatReenrollmentStatusLabel,
} from "../../../lib/reenrollmentPolicy";
import {
  useCloseReenrollmentAcademicYear,
  useClearReenrollmentFinance,
  useEnsureReenrollmentFinance,
  useAssignReenrollmentDestinationClass,
  useReenrollmentDashboard,
  useReenrollmentCampaigns,
  useReenrollmentDestinationClasses,
  useReenrollmentYearClosePreview,
} from "../../../hooks/useReenrollment";
import type {
  ReenrollmentCampaign,
  ReenrollmentRequest,
} from "../../../services/reenrollmentService";

const closeBlockerLabels: Record<string, string> = {
  NO_ACTIVE_CLASSES: "Não há turmas ativas no ano letivo.",
  NO_ACTIVE_TERMS: "Não há períodos letivos ativos.",
  NO_ACTIVE_OFFERINGS: "Não há disciplinas vinculadas às turmas e períodos.",
  CLASSES_WITHOUT_OFFERINGS: "Há turma ativa sem disciplinas configuradas.",
  NO_ACTIVE_ENROLLMENTS: "Não há matrículas ativas para consolidar.",
  DUPLICATE_ACTIVE_ENROLLMENTS: "Há estudantes com mais de uma matrícula ativa no ano.",
  PENDING_TERM_CLOSURES: "Ainda há períodos/disciplinas sem fechamento oficial.",
  MISSING_FINAL_RESULTS: "Há notas ou frequências finais ausentes ou não finalizadas.",
  DRAFT_RECOVERIES: "Há recuperações em rascunho que precisam ser concluídas ou canceladas.",
  PUBLISHED_RECOVERY_NOT_APPLIED: "Há recuperação publicada que ainda não foi incorporada ao resultado final.",
  TRANSFER_HISTORY_REQUIRES_REVIEW: "Há estudante com troca de turma no ano; o histórico precisa ser revisado antes do cálculo anual.",
  ACADEMIC_POLICY_MISSING_OR_AMBIGUOUS: "A política acadêmica do ano está ausente ou ambígua.",
};

function closeStateLabel(state: string): string {
  return ({
    READY: "Pronto para fechamento",
    READY_AFTER_SOURCE_CHANGE: "Pronto para novo fechamento após atualização",
    READY_AFTER_LEGACY_MARKER: "Pronto para validar o registro anterior",
    ALREADY_CLOSED: "Encerramento consolidado",
    HAS_BLOCKERS: "Com pendências",
  } as Record<string, string>)[state] ?? "Consultando o fechamento";
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
  const closeYearMutation = useCloseReenrollmentAcademicYear();
  const financeMutation = useEnsureReenrollmentFinance();
  const clearFinanceMutation = useClearReenrollmentFinance();
  const assignDestinationClassMutation = useAssignReenrollmentDestinationClass();
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmYearClose, setConfirmYearClose] = useState(false);
  const [destinationClassRequestId, setDestinationClassRequestId] = useState<string | null>(null);
  const [destinationClassDraft, setDestinationClassDraft] = useState("");
  const [destinationClassJustification, setDestinationClassJustification] = useState("");
  const [financeJustificationByRequest, setFinanceJustificationByRequest] = useState<Record<string, string>>({});
  const campaigns = campaignsQuery.data ?? [];
  const years = yearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const yearClosePreviewQuery = useReenrollmentYearClosePreview(
    institutionId,
    selectedCampaign?.source_academic_year_id,
  );
  const destinationClassOptionsQuery = useReenrollmentDestinationClasses(destinationClassRequestId ?? undefined);

  async function prepareFinance(request: ReenrollmentRequest) {
    try {
      await financeMutation.mutateAsync(request.id);
      setFeedback("Vínculo financeiro preparado de forma idempotente.");
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function clearFinance(request: ReenrollmentRequest) {
    const justification = financeJustificationByRequest[request.id]?.trim();
    if (!justification) {
      setFeedback("Informe uma justificativa para registrar a baixa manual.");
      return;
    }
    try {
      await clearFinanceMutation.mutateAsync({
        requestId: request.id,
        status: "CLEARED",
        notes: `${justification} (baixa manual, sem liquidação bancária automática)`,
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
        "Ano letivo encerrado. Resultados anuais calculados, registrados e solicitações reavaliadas.",
      );
      setConfirmYearClose(false);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function assignDestinationClass(request: ReenrollmentRequest) {
    if (!destinationClassDraft || !destinationClassJustification.trim()) {
      setFeedback("Selecione a turma e informe o motivo da escolha.");
      return;
    }
    try {
      await assignDestinationClassMutation.mutateAsync({
        requestId: request.id,
        classId: destinationClassDraft,
        justification: destinationClassJustification.trim(),
      });
      setFeedback("Turma de destino registrada. A efetivação automática reavaliará os demais requisitos.");
      setDestinationClassRequestId(null);
      setDestinationClassDraft("");
      setDestinationClassJustification("");
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  function pendingReasonLabels(reason: string | null | undefined): string[] {
    return formatReenrollmentPendingReason(reason);
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
            A publicação acontece no Calendário escolar. Aqui você acompanha
            solicitações, resultados, pendências e efetivações.
          </p>
        </div>
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-[#005bbf]">
          Publicação pelo Calendário escolar
        </p>
      </header>

      {feedback && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {feedback}
        </div>
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
                    setConfirmYearClose(false);
                    setDestinationClassRequestId(null);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[#181c20]">
                      {campaign.title}
                    </span>
                    <span className="text-xs font-bold text-[#005bbf]">
                      {formatReenrollmentStatusLabel(campaign.status)}
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
                <p className="mt-2 text-xs text-[#667085]">
                  {campaign.academic_calendar_event_id
                    ? "Publicação e período vinculados ao calendário."
                    : "Campanha histórica sem evento; dados preservados para acompanhamento."}
                </p>
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
              <details className="rounded-lg border border-[#dfe3e8] bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-[#414754]">
                  Configurações avançadas: exceções de progressão
                </summary>
                <div className="border-t border-[#e2e8f0] p-4">
                  <ReenrollmentGradeRulesEditor
                    institutionId={institutionId}
                    campaign={selectedCampaign}
                    classes={classes}
                  />
                </div>
              </details>

              <section className="rounded-lg border border-[#dfe3e8] bg-white p-4" aria-labelledby="reenrollment-year-close-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="reenrollment-year-close-title" className="font-bold text-[#181c20]">Fechamento do ano letivo</h2>
                    <p className="mt-1 text-sm text-[#667085]">
                      {campaignYearName(selectedCampaign.source_academic_year_id, years)} → {campaignYearName(selectedCampaign.destination_academic_year_id, years)}
                    </p>
                  </div>
                  {yearClosePreviewQuery.data && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                      {closeStateLabel(yearClosePreviewQuery.data.state)}
                    </span>
                  )}
                </div>

                {yearClosePreviewQuery.isLoading ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-[#667085]"><LoaderCircle className="h-4 w-4 animate-spin" /> Consultando períodos, resultados, recuperações e matrículas...</p>
                ) : yearClosePreviewQuery.isError ? (
                  <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                    Não foi possível consultar os dados oficiais do fechamento. Nenhum fechamento foi realizado.
                  </p>
                ) : yearClosePreviewQuery.data ? (
                  <>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Turmas", yearClosePreviewQuery.data.summary.active_classes],
                        ["Períodos encerrados", `${yearClosePreviewQuery.data.summary.closed_offerings}/${yearClosePreviewQuery.data.summary.active_offerings}`],
                        ["Resultados finais", `${yearClosePreviewQuery.data.summary.complete_student_period_results}/${yearClosePreviewQuery.data.summary.expected_student_period_results}`],
                        ["Alunos em recuperação", yearClosePreviewQuery.data.summary.students_in_recovery],
                        ["Alunos sem resultado final", yearClosePreviewQuery.data.summary.students_missing_final_results],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
                          <p className="text-xs text-[#667085]">{label}</p>
                          <p className="mt-1 font-bold text-[#181c20]">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-[#414754]">
                      <p className="mb-1 text-xs font-semibold text-[#667085]">
                        {yearClosePreviewQuery.data.state === "HAS_BLOCKERS" ? "Prévia parcial; não será consolidada enquanto houver pendências." : "Resultado calculado pela média aritmética por disciplina."}
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        <span>Aprovados: <strong>{yearClosePreviewQuery.data.summary.approved_students}</strong></span>
                        <span>Retidos: <strong>{yearClosePreviewQuery.data.summary.failed_students}</strong></span>
                        <span>Concluintes: <strong>{yearClosePreviewQuery.data.summary.graduating_students}</strong></span>
                        <span>Recuperações em rascunho: <strong>{yearClosePreviewQuery.data.summary.draft_recoveries}</strong></span>
                      </div>
                    </div>

                    {yearClosePreviewQuery.data.blockers.length > 0 && (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3" role="status">
                        <p className="text-sm font-bold text-amber-900">Pendências que impedem o fechamento</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                          {yearClosePreviewQuery.data.blockers.map((blocker) => (
                            <li key={blocker}>{closeBlockerLabels[blocker] ?? "Há uma inconsistência acadêmica que exige revisão."}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {yearClosePreviewQuery.data.state === "ALREADY_CLOSED" && (
                      <p className="mt-3 text-sm text-emerald-800">
                        Fechamento #{yearClosePreviewQuery.data.run_number ?? "?"} em {yearClosePreviewQuery.data.closed_at ? new Date(yearClosePreviewQuery.data.closed_at).toLocaleString("pt-BR") : "data não disponível"}
                        {yearClosePreviewQuery.data.closed_by_name ? ` por ${yearClosePreviewQuery.data.closed_by_name}` : ""}. Repetir não cria outro resultado.
                      </p>
                    )}
                    {yearClosePreviewQuery.data.state === "READY_AFTER_SOURCE_CHANGE" && (
                      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Dados acadêmicos oficiais mudaram depois do último fechamento. A confirmação criará uma nova versão, preservando o snapshot anterior.</p>
                    )}
                    {yearClosePreviewQuery.data.state === "READY_AFTER_LEGACY_MARKER" && (
                      <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Existe apenas um registro antigo de fechamento. A confirmação validará o ano com dados oficiais e manterá o registro anterior no histórico.</p>
                    )}

                    {yearClosePreviewQuery.data.can_close && !confirmYearClose && (
                      <button type="button" onClick={() => setConfirmYearClose(true)} className="mt-4 rounded-md bg-[#005bbf] px-3 py-2 text-sm font-bold text-white">
                        Revisar e confirmar fechamento
                      </button>
                    )}
                    {confirmYearClose && yearClosePreviewQuery.data.can_close && (
                      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3" role="alert">
                        <p className="text-sm font-semibold text-blue-950">
                          O sistema calculará a média aritmética por disciplina, aplicará os limites oficiais de nota e frequência, criará um snapshot auditável e preservará os anteriores. Confirma o encerramento?
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void closeSourceYear()} disabled={closeYearMutation.isPending} className="inline-flex items-center gap-2 rounded-md bg-[#005bbf] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                            {closeYearMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            Confirmar fechamento
                          </button>
                          <button type="button" onClick={() => setConfirmYearClose(false)} disabled={closeYearMutation.isPending} className="rounded-md border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#414754]">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#181c20]">Solicitações</h2>
                  <p className="text-sm text-[#667085]">
                    {selectedCampaign.title}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                          {formatReenrollmentStatusLabel(
                            request.request_status,
                            request.student_sex,
                          )}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-[#667085]">Resultado</p>
                          <p className="text-sm font-semibold">
                            {formatReenrollmentStatusLabel(request.academic_status)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#667085]">Série de destino</p>
                          <p className="text-sm font-semibold">{request.destination_grade_level ?? "Aguardando resultado oficial"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#667085]">Financeiro</p>
                          <p className="text-sm font-semibold">{formatReenrollmentStatusLabel(request.financial_status)}</p>
                        </div>
                      </div>
                      {request.destination_class_name && (
                        <p className="mt-2 text-xs text-[#667085]">Turma de destino: <strong>{request.destination_class_name}</strong></p>
                      )}
                      {pendingReasonLabels(request.pending_reason).length > 0 && (
                        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                          Pendências: {pendingReasonLabels(request.pending_reason).join(" ")}
                        </p>
                      )}
                      {request.receipt_code && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Comprovante: {request.receipt_code}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCampaign.require_financial_clearance &&
                          request.request_status !== "ENROLLED" && (
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              {request.financial_status === "PENDING" && (
                                <button
                                  type="button"
                                  onClick={() => void prepareFinance(request)}
                                  disabled={financeMutation.isPending}
                                  className="rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-60"
                                >
                                  Preparar cobrança
                                </button>
                              )}
                              {selectedCampaign.finance_allow_manual_clearance &&
                                !["CLEARED", "WAIVED"].includes(request.financial_status) && (
                                  <>
                                    <label className="min-w-56 flex-1 text-xs font-semibold text-[#414754]">
                                      Justificativa para baixa manual
                                      <input
                                        value={financeJustificationByRequest[request.id] ?? ""}
                                        onChange={(event) => setFinanceJustificationByRequest((current) => ({ ...current, [request.id]: event.target.value }))}
                                        placeholder="Sem confirmação bancária automática"
                                        className="mt-1 w-full rounded-md border border-[#cbd5e1] px-2.5 py-2 text-sm font-normal"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => void clearFinance(request)}
                                      disabled={clearFinanceMutation.isPending || !financeJustificationByRequest[request.id]?.trim()}
                                      className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-60"
                                    >
                                      Registrar baixa manual
                                    </button>
                                  </>
                                )}
                            </div>
                          )}
                        {request.destination_grade_level &&
                          !request.destination_class_id &&
                          request.request_status !== "ENROLLED" && (
                            <div className="mt-3 w-full rounded-md border border-[#e2e8f0] p-3">
                              <p className="text-xs font-semibold text-[#414754]">
                                A série de destino foi calculada oficialmente. A turma só será atribuída quando houver uma opção compatível e vaga; a efetivação depende das demais validações.
                              </p>
                              {destinationClassRequestId !== request.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDestinationClassRequestId(request.id);
                                    setDestinationClassDraft("");
                                    setDestinationClassJustification("");
                                  }}
                                  className="mt-2 rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700"
                                >
                                  Escolher turma de destino
                                </button>
                              ) : (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <label className="text-xs font-semibold text-[#414754]">
                                    Turmas disponíveis para {request.destination_grade_level}
                                    <select
                                      value={destinationClassDraft}
                                      onChange={(event) => setDestinationClassDraft(event.target.value)}
                                      disabled={destinationClassOptionsQuery.isLoading}
                                      className="mt-1 w-full rounded-md border border-[#cbd5e1] px-2.5 py-2 text-sm font-normal"
                                    >
                                      <option value="">{destinationClassOptionsQuery.isLoading ? "Carregando turmas..." : "Selecione uma turma"}</option>
                                      {(destinationClassOptionsQuery.data ?? []).map((classOption) => (
                                        <option key={classOption.id} value={classOption.id}>
                                          {classOption.name} · {classOption.available_seats === null ? "vagas não limitadas" : `${classOption.available_seats} vaga(s)`}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-xs font-semibold text-[#414754]">
                                    Justificativa da escolha
                                    <input
                                      value={destinationClassJustification}
                                      onChange={(event) => setDestinationClassJustification(event.target.value)}
                                      placeholder="Ex.: turno solicitado pela família"
                                      className="mt-1 w-full rounded-md border border-[#cbd5e1] px-2.5 py-2 text-sm font-normal"
                                    />
                                  </label>
                                  {destinationClassOptionsQuery.isError && (
                                    <p className="text-xs text-rose-700 sm:col-span-2" role="alert">Não foi possível consultar as turmas disponíveis.</p>
                                  )}
                                  {!destinationClassOptionsQuery.isLoading && !destinationClassOptionsQuery.isError && (destinationClassOptionsQuery.data ?? []).length === 0 && (
                                    <p className="text-xs text-amber-800 sm:col-span-2">Não há turma compatível com vaga disponível para a série calculada.</p>
                                  )}
                                  <div className="flex gap-2 sm:col-span-2">
                                    <button
                                      type="button"
                                      onClick={() => void assignDestinationClass(request)}
                                      disabled={assignDestinationClassMutation.isPending || !destinationClassDraft || !destinationClassJustification.trim()}
                                      className="rounded-md bg-[#005bbf] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                    >
                                      {assignDestinationClassMutation.isPending ? "Registrando..." : "Registrar escolha auditada"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDestinationClassRequestId(null)}
                                      className="rounded-md border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#414754]"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
