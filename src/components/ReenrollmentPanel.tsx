import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, LoaderCircle, ReceiptText, RotateCw, X } from "lucide-react";

import { reenrollmentKeys } from "../hooks/useReenrollment";
import { reenrollmentService } from "../services/reenrollmentService";
import type {
  MyReenrollmentCampaign,
  MyReenrollmentStatus,
  ReenrollmentCampaign,
  ReenrollmentInvoiceSummary,
  ReenrollmentRequest,
} from "../services/reenrollmentService";

interface ReenrollmentPanelProps {
  institutionId: string;
  studentIds: string[];
  studentNames?: Record<string, string>;
  title?: string;
}

function statusMessage(status: MyReenrollmentStatus | null | undefined): string {
  switch (status?.state) {
    case "NO_AUTHORIZED_STUDENTS":
      return "Nenhum estudante ativo está autorizado neste perfil.";
    case "GUARDIANSHIP_INVALID":
      return "Não encontramos um vínculo de responsável ativo para esta instituição. Peça à Secretaria que confira o cadastro.";
    case "SOURCE_ENROLLMENT_MISSING":
      return "A matrícula do ano de origem não foi localizada. A Secretaria precisa regularizar o vínculo escolar.";
    case "CAMPAIGN_UPCOMING":
      return "O período de confirmação ainda não começou. A escola divulgará a rematrícula quando estiver disponível.";
    case "CAMPAIGN_ENDED":
      return "O período da campanha de rematrícula já foi encerrado.";
    case "STUDENT_INELIGIBLE":
      return "A série atual não está incluída nas séries elegíveis da campanha.";
    default:
      return "A escola ainda não publicou uma campanha de rematrícula.";
  }
}

function friendlyError(error: unknown): string {
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code === "42501" || /forbidden|permission denied/i.test(candidate?.message ?? "")) {
    return "Seu perfil não tem permissão para consultar essa rematrícula.";
  }
  if (/GUARDIANSHIP_INVALID|NO_AUTHORIZED_STUDENTS/i.test(candidate?.message ?? "")) {
    return "Não foi possível validar o vínculo do estudante com este perfil.";
  }
  return "Não foi possível carregar a rematrícula agora. Tente novamente.";
}

function actionError(error: unknown): string {
  const candidate = error as { code?: string; message?: string } | null;
  const message = candidate?.message ?? "";
  if (/REENROLLMENT_GRADE_RULE_REQUIRED/i.test(message)) {
    return "A escola precisa configurar a progressão desta série antes de iniciar a rematrícula. A Secretaria ou Direção já pode fazer esse ajuste no painel da campanha.";
  }
  if (/REENROLLMENT_NO_SOURCE_ENROLLMENT/i.test(message)) {
    return "A matrícula ativa do ano de origem não foi localizada. Peça à Secretaria que regularize o vínculo escolar.";
  }
  if (/REENROLLMENT_GRADE_NOT_ELIGIBLE/i.test(message)) {
    return "A série atual não está habilitada nesta campanha. A Secretaria pode conferir as séries elegíveis.";
  }
  if (/REENROLLMENT_CAMPAIGN_NOT_OPEN/i.test(message)) {
    return "O período de confirmação mudou ou terminou. Atualizamos a situação; confira o novo status da campanha.";
  }
  if (/REENROLLMENT_STUDENT_NOT_ALLOWED|REENROLLMENT_REQUEST_NOT_ALLOWED/i.test(message) || candidate?.code === "42501") {
    return "Este perfil não está autorizado a iniciar ou confirmar a rematrícula deste estudante.";
  }
  return "Não foi possível iniciar a rematrícula. Atualize a situação e tente novamente.";
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T12:00:00`));
}

function invoiceStatusLabel(status: ReenrollmentInvoiceSummary["status"]): string {
  const labels: Record<ReenrollmentInvoiceSummary["status"], string> = {
    DRAFT: "Em preparação",
    OPEN: "Em aberto",
    PAID: "Pago",
    OVERDUE: "Vencido",
    CANCELLED: "Cancelado",
    PARTIALLY_PAID: "Parcialmente pago",
    NEGOTIATED: "Negociado",
  };
  return labels[status];
}

function requestForStudent(
  requests: ReenrollmentRequest[],
  campaignId: string,
  studentId: string,
): ReenrollmentRequest | undefined {
  return requests.find(
    (request) =>
      request.campaign_id === campaignId && request.student_id === studentId,
  );
}

function requestStatusLabel(request: ReenrollmentRequest): string {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "Aguardando confirmação",
    CONFIRMED: "Confirmada",
    AWAITING_ACADEMIC_RESULT: "Aguardando resultado acadêmico",
    AWAITING_PAYMENT: "Aguardando financeiro",
    READY_FOR_ENROLLMENT: "Pronta para matrícula",
    ENROLLED: "Efetivada",
    CANCELLED: "Cancelada",
    REJECTED: "Rejeitada",
  };
  return labels[request.request_status] ?? request.request_status;
}

function eligibilityMessage(student: MyReenrollmentCampaign["eligible_students"][number]): string | null {
  if (student.eligibility_state === "SOURCE_ENROLLMENT_MISSING") {
    return "Matrícula do ano de origem não localizada. Peça à Secretaria que confira o vínculo.";
  }
  if (student.eligibility_state === "STUDENT_INELIGIBLE") {
    const grade = student.current_grade_level ? ` (${student.current_grade_level})` : "";
    return `A série atual${grade} não está incluída nesta campanha.`;
  }
  if (student.eligibility_state === "GRADE_RULE_REQUIRED") {
    return "A escola precisa configurar a progressão desta série antes de iniciar. Secretaria ou Direção: selecione a campanha no painel de rematrícula e defina o destino acadêmico.";
  }
  return null;
}

export default function ReenrollmentPanel({
  institutionId,
  studentIds,
  studentNames = {},
  title = "Rematrícula",
}: ReenrollmentPanelProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acceptedContracts, setAcceptedContracts] = useState<Record<string, boolean>>({});
  const [invoiceToView, setInvoiceToView] = useState<{ invoice: ReenrollmentInvoiceSummary; studentName: string } | null>(null);
  const studentIdsKey = studentIds.slice().sort().join("|");
  const statusKey = reenrollmentKeys.status(institutionId, studentIdsKey);

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: async () => {
      const [status, requests] = await Promise.all([
        reenrollmentService.getMyStatus(institutionId),
        reenrollmentService.listRequests(institutionId),
      ]);
      return { status, requests };
    },
    enabled: Boolean(institutionId && studentIds.length),
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const status = statusQuery.data?.status;
  const requests = statusQuery.data?.requests ?? [];
  const visibleStudentIds = useMemo(
    () => new Set(studentIdsKey ? studentIdsKey.split("|") : []),
    [studentIdsKey],
  );
  const visibleCampaigns = useMemo(
    () =>
      status?.campaigns.filter((entry) =>
        entry.eligible_students.some((student) => visibleStudentIds.has(student.student_id)),
      ) ?? [],
    [status, visibleStudentIds],
  );

  async function refreshPanel(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: statusKey });
  }

  if (studentIds.length === 0) return null;

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#667085]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando rematrícula...
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <span>{friendlyError(statusQuery.error)}</span>
        <button type="button" onClick={() => void statusQuery.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900">
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
        </button>
      </section>
    );
  }

  if (visibleCampaigns.length === 0) {
    return (
      <section role="status" className="rounded-xl border border-[#dfe3e8] bg-white p-4 text-sm text-[#667085]">
        {statusMessage(status)}
      </section>
    );
  }

  async function startRequest(campaign: ReenrollmentCampaign, studentId: string) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await reenrollmentService.createRequest(campaign.id, studentId);
      await refreshPanel();
      setFeedback("Solicitação preparada. Leia o contrato completo e marque seu aceite para confirmar.");
    } catch (error) {
      setFeedback(actionError(error));
      await refreshPanel();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function acceptAndConfirm(campaign: ReenrollmentCampaign, request: ReenrollmentRequest) {
    const acceptanceKey = `${request.id}:${campaign.contract_hash}`;
    if (!acceptedContracts[acceptanceKey]) return;

    setFeedback(null);
    setIsSubmitting(true);
    try {
      await reenrollmentService.acceptContract(
        request.id,
        campaign.contract_version,
        campaign.contract_hash,
      );
      await reenrollmentService.confirmRequest(request.id);
      await refreshPanel();
      setFeedback("Rematrícula confirmada. Protocolo registrado; a matrícula definitiva depende da revisão da escola.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar a rematrícula.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-[#b9f0d7] bg-[#f2fff8] p-5 shadow-sm"
      aria-labelledby="reenrollment-panel-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Calendário acadêmico</p>
          <h2 id="reenrollment-panel-title" className="mt-1 text-lg font-bold text-[#181c20]">{title}</h2>
          <p className="mt-1 text-sm text-[#4b6358]">Consulte a situação da rematrícula de cada estudante autorizado.</p>
        </div>
      </div>
      {feedback && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-800" role="status">
          {feedback}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {visibleCampaigns.map((entry) => {
          const campaign = entry.campaign;
          const students = entry.eligible_students.filter((student) => visibleStudentIds.has(student.student_id));
          return (
            <article key={campaign.id} className="rounded-lg border border-emerald-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#181c20]">{campaign.title}</h3>
                  <p className="mt-1 text-xs text-[#667085]">
                    {entry.state === "UPCOMING" ? "Abertura em " : "Período até "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                      new Date(entry.state === "UPCOMING" ? campaign.opens_at : campaign.closes_at),
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  {entry.state === "OPEN" ? "Aberta" : entry.state === "UPCOMING" ? "Em breve" : "Encerrada"}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {students.map((student) => {
                  const studentId = student.student_id;
                  const studentName = studentNames[studentId] ?? "Estudante";
                  const request = requestForStudent(requests, campaign.id, studentId);
                  const eligibility = eligibilityMessage(student);
                  const acceptanceKey = request ? `${request.id}:${campaign.contract_hash}` : "";
                  const contractAccepted = acceptanceKey ? acceptedContracts[acceptanceKey] === true : false;
                  const invoice = request?.primary_invoice ?? null;
                  const invoiceActionLabel = invoice?.status === "PAID"
                    ? "Acessar comprovante da rematrícula"
                    : "Acessar boleto da rematrícula";

                  return (
                    <div key={studentId} className="rounded-md border border-[#e2e8f0] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#414754]">{studentName}</span>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {request?.request_status === "PENDING_CONFIRMATION" ? student.can_confirm ? (
                            <button
                              type="button"
                              onClick={() => void acceptAndConfirm(campaign, request)}
                              disabled={isSubmitting || !contractAccepted}
                              aria-label={`Aceitar e confirmar rematrícula de ${studentName}`}
                              className="min-h-9 rounded-md bg-[#005bbf] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              Aceitar e confirmar
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700">A confirmação deve ser feita pelo responsável legal.</span>
                          ) : request ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" /> {requestStatusLabel(request)}
                            </span>
                          ) : eligibility ? (
                            <span className="text-xs font-semibold text-amber-700">{eligibility}</span>
                          ) : entry.state === "UPCOMING" ? (
                            <span className="text-xs font-semibold text-blue-700">A confirmação ainda não está aberta.</span>
                          ) : entry.state === "OPEN" && student.can_confirm ? (
                            <button
                              type="button"
                              onClick={() => void startRequest(campaign, studentId)}
                              disabled={isSubmitting}
                              className="min-h-9 rounded-md border border-[#005bbf] px-3 py-1.5 text-xs font-bold text-[#005bbf] disabled:opacity-60"
                            >
                              Iniciar
                            </button>
                          ) : entry.state === "OPEN" ? (
                            <span className="text-xs font-semibold text-amber-700">A confirmação deve ser feita pelo responsável legal.</span>
                          ) : (
                            <span className="text-xs font-semibold text-[#667085]">Esta campanha foi encerrada.</span>
                          )}
                          {invoice && (
                            <button
                              type="button"
                              onClick={() => setInvoiceToView({ invoice, studentName })}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#005bbf] px-3 py-1.5 text-xs font-bold text-[#005bbf]"
                            >
                              <ReceiptText className="h-4 w-4" aria-hidden="true" />
                              {invoiceActionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                      {request?.request_status === "PENDING_CONFIRMATION" && student.can_confirm && (
                        <section className="mt-3 rounded-md border border-blue-100 bg-blue-50/60 p-3" aria-label={`Contrato da rematrícula de ${studentName}`}>
                          <h4 className="text-sm font-bold text-[#181c20]">Contrato · versão {campaign.contract_version}</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#414754]">{campaign.contract_body}</p>
                          <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#414754]">
                            <input
                              type="checkbox"
                              checked={contractAccepted}
                              onChange={(event) => setAcceptedContracts((current) => ({ ...current, [acceptanceKey]: event.target.checked }))}
                              className="mt-0.5"
                            />
                            <span>Li e aceito o contrato da rematrícula de {studentName}.</span>
                          </label>
                        </section>
                      )}
                      {request?.pending_reason && (
                        <p className="mt-2 text-xs font-medium text-amber-700">Pendência: {request.pending_reason}</p>
                      )}
                      {request?.protocol && (
                        <p className="mt-2 text-xs font-semibold text-[#414754]">Protocolo: {request.protocol}</p>
                      )}
                      {request?.receipt_code && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">Comprovante: {request.receipt_code}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      {invoiceToView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reenrollment-invoice-title">
          <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Rematrícula</p>
                <h3 id="reenrollment-invoice-title" className="mt-1 text-lg font-bold text-[#181c20]">
                  {invoiceToView.invoice.status === "PAID" ? "Comprovante da rematrícula" : "Boleto da rematrícula"}
                </h3>
              </div>
              <button type="button" onClick={() => setInvoiceToView(null)} aria-label="Fechar cobrança da rematrícula" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm text-[#414754]">{invoiceToView.studentName}</p>
            <dl className="mt-4 grid gap-3 rounded-lg border border-[#e2e8f0] bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[#667085]">Referência</dt><dd className="font-semibold">{invoiceToView.invoice.reference}</dd></div>
              <div><dt className="text-xs text-[#667085]">Vencimento</dt><dd className="font-semibold">{formatDate(invoiceToView.invoice.due_date)}</dd></div>
              <div><dt className="text-xs text-[#667085]">Valor</dt><dd className="font-semibold">{formatMoney(invoiceToView.invoice.amount_due)}</dd></div>
              <div><dt className="text-xs text-[#667085]">Pago</dt><dd className="font-semibold">{formatMoney(invoiceToView.invoice.amount_paid)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-[#667085]">Situação</dt><dd className="font-semibold">{invoiceStatusLabel(invoiceToView.invoice.status)}</dd></div>
            </dl>
            {invoiceToView.invoice.status === "PAID" ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">O pagamento desta cobrança já foi identificado pela escola.</p>
            ) : (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">A cobrança foi criada. O PDF, código de barras e linha digitável serão liberados quando a escola concluir o registro e a integração com o banco.</p>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setInvoiceToView(null)} className="min-h-9 rounded-md bg-[#005bbf] px-3 py-1.5 text-xs font-bold text-white">Fechar</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
