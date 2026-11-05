import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, LoaderCircle, RotateCw } from "lucide-react";

import { reenrollmentService } from "../services/reenrollmentService";
import type {
  ReenrollmentCampaign,
  ReenrollmentRequest,
  MyReenrollmentStatus,
} from "../services/reenrollmentService";

interface ReenrollmentPanelProps {
  institutionId: string;
  studentIds: string[];
  studentNames?: Record<string, string>;
  title?: string;
}

function campaignIsOpen(campaign: ReenrollmentCampaign): boolean {
  const now = Date.now();
  return (
    campaign.status === "OPEN" &&
    now >= new Date(campaign.opens_at).getTime() &&
    now <= new Date(campaign.closes_at).getTime()
  );
}

function statusMessage(status: MyReenrollmentStatus | null): string {
  switch (status?.state) {
    case "NO_AUTHORIZED_STUDENTS":
      return "Nenhum estudante ativo está autorizado neste perfil.";
    case "GUARDIANSHIP_INVALID":
      return "Não encontramos um vínculo de responsável ativo para esta instituição. Peça à Secretaria que confira o cadastro.";
    case "SOURCE_ENROLLMENT_MISSING":
      return "Não encontramos uma matrícula ativa de origem para este estudante. A Secretaria precisa regularizar o vínculo escolar.";
    case "CAMPAIGN_ENDED":
      return "A campanha de rematrícula correspondente já foi encerrada.";
    case "STUDENT_INELIGIBLE":
      return "A série atual do estudante não está incluída nas séries elegíveis desta campanha.";
    default:
      return "Nenhuma campanha de rematrícula está disponível no momento.";
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

export default function ReenrollmentPanel({
  institutionId,
  studentIds,
  studentNames = {},
  title = "Rematrícula",
}: ReenrollmentPanelProps) {
  const [requests, setRequests] = useState<ReenrollmentRequest[]>([]);
  const [status, setStatus] = useState<MyReenrollmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const studentIdsKey = studentIds.slice().sort().join("|");

  async function loadData() {
    if (!institutionId || studentIds.length === 0) {
      setRequests([]);
      setStatus(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextStatus, nextRequests] = await Promise.all([
        reenrollmentService.getMyStatus(institutionId),
        reenrollmentService.listRequests(institutionId),
      ]);
      setStatus(nextStatus);
      setRequests(nextRequests);
    } catch (error) {
      setLoadError(friendlyError(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // The selected student list is already scoped by the parent dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, studentIdsKey]);

  const visibleStudentIds = useMemo(() => new Set(studentIdsKey ? studentIdsKey.split("|") : []), [studentIdsKey]);
  const visibleCampaigns = useMemo(
    () =>
      status?.campaigns.filter((entry) =>
        entry.eligible_students.some((student) => visibleStudentIds.has(student.student_id)),
      ) ?? [],
    [status, visibleStudentIds],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#667085]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando
        rematrícula...
      </div>
    );
  }

  if (studentIds.length === 0) return null;

  if (loadError) {
    return (
      <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <span>{loadError}</span>
        <button type="button" onClick={() => void loadData()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900">
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

  async function startRequest(
    campaign: ReenrollmentCampaign,
    studentId: string,
  ) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await reenrollmentService.createRequest(campaign.id, studentId);
      await loadData();
      setFeedback(
        "Solicitação preparada. Revise o contrato antes de confirmar.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a rematrícula.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function acceptAndConfirm(
    campaign: ReenrollmentCampaign,
    request: ReenrollmentRequest,
  ) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await reenrollmentService.acceptContract(
        request.id,
        campaign.contract_version,
        campaign.contract_hash,
      );
      await reenrollmentService.confirmRequest(request.id);
      await loadData();
      setFeedback(
        "Rematrícula confirmada e registrada. A matrícula definitiva depende da revisão da escola.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a rematrícula.",
      );
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
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Calendário acadêmico
          </p>
          <h2
            id="reenrollment-panel-title"
            className="mt-1 text-lg font-bold text-[#181c20]"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-[#4b6358]">
            Consulte a situação da rematrícula de cada estudante autorizado.
          </p>
        </div>
      </div>
      {feedback && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
          {feedback}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {visibleCampaigns.map((entry) => {
          const campaign = entry.campaign;
          return (
          <article
            key={campaign.id}
            className="rounded-lg border border-emerald-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#181c20]">
                  {campaign.title}
                </h3>
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
              {entry.eligible_students.filter((student) => studentIds.includes(student.student_id)).map(({ student_id: studentId, can_confirm: canConfirm }) => {
                const request = requestForStudent(
                  requests,
                  campaign.id,
                  studentId,
                );
                return (
                  <div
                    key={studentId}
                    className="rounded-md border border-[#e2e8f0] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#414754]">
                        {studentNames[studentId] ?? "Estudante"}
                      </span>
                      {entry.state === "UPCOMING" ? (
                        <span className="text-xs font-semibold text-blue-700">A confirmação ainda não está aberta.</span>
                      ) : request?.request_status === "PENDING_CONFIRMATION" ? canConfirm ? (
                        <button
                          type="button"
                          onClick={() =>
                            void acceptAndConfirm(campaign, request)
                          }
                          disabled={isSubmitting}
                          className="min-h-9 rounded-md bg-[#005bbf] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Aceitar e confirmar
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700">A confirmação deve ser feita pelo responsável legal.</span>
                      ) : request ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />{" "}
                          {requestStatusLabel(request)}
                        </span>
                      ) : entry.state === "OPEN" && canConfirm ? (
                        <button
                          type="button"
                          onClick={() => void startRequest(campaign, studentId)}
                          disabled={isSubmitting || !campaignIsOpen(campaign)}
                          className="min-h-9 rounded-md border border-[#005bbf] px-3 py-1.5 text-xs font-bold text-[#005bbf] disabled:opacity-60"
                        >
                          Iniciar
                        </button>
                      ) : entry.state === "OPEN" ? (
                        <span className="text-xs font-semibold text-amber-700">A confirmação deve ser feita pelo responsável legal.</span>
                      ) : (
                        <span className="text-xs font-semibold text-[#667085]">Esta campanha foi encerrada.</span>
                      )}
                    </div>
                    {request?.pending_reason && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Pendência: {request.pending_reason}
                      </p>
                    )}
                    {request?.receipt_code && (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Comprovante: {request.receipt_code}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#005bbf]">
                Ler contrato ({campaign.contract_version})
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#4b5563]">
                {campaign.contract_body}
              </p>
            </details>
          </article>
          );
        })}
      </div>
    </section>
  );
}
