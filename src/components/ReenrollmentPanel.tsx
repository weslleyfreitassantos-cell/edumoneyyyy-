import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, LoaderCircle } from "lucide-react";

import { reenrollmentService } from "../services/reenrollmentService";
import type {
  ReenrollmentCampaign,
  ReenrollmentRequest,
} from "../services/reenrollmentService";

interface ReenrollmentPanelProps {
  institutionId: string;
  studentIds: string[];
  studentNames?: Record<string, string>;
  title?: string;
}

interface ReenrollmentCacheEntry {
  expiresAt: number;
  campaigns: ReenrollmentCampaign[];
  requests: ReenrollmentRequest[];
}

const CACHE_TTL_MS = 1000 * 60 * 5;
const memoryCache = new Map<string, ReenrollmentCacheEntry>();

function campaignIsOpen(campaign: ReenrollmentCampaign): boolean {
  const now = Date.now();
  return (
    campaign.status === "OPEN" &&
    now >= new Date(campaign.opens_at).getTime() &&
    now <= new Date(campaign.closes_at).getTime()
  );
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
  const [campaigns, setCampaigns] = useState<ReenrollmentCampaign[]>([]);
  const [requests, setRequests] = useState<ReenrollmentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const cacheKey = `${institutionId}:${studentIds.slice().sort().join("|")}`;

  async function loadData(force = false) {
    if (!institutionId || studentIds.length === 0) {
      setIsLoading(false);
      return;
    }

    const cached = memoryCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) {
      setCampaigns(cached.campaigns);
      setRequests(cached.requests);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextCampaigns, nextRequests] = await Promise.all([
        reenrollmentService.listCampaigns(institutionId),
        reenrollmentService.listRequests(institutionId),
      ]);
      memoryCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        campaigns: nextCampaigns,
        requests: nextRequests,
      });
      setCampaigns(nextCampaigns);
      setRequests(nextRequests);
    } catch {
      setCampaigns([]);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // The selected student list is already scoped by the parent dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, studentIds.join("|")]);

  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          campaignIsOpen(campaign) ||
          requests.some((request) => request.campaign_id === campaign.id),
      ),
    [campaigns, requests],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#dfe3e8] bg-white p-5 text-sm text-[#667085]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando
        rematrícula...
      </div>
    );
  }

  if (visibleCampaigns.length === 0 || studentIds.length === 0) return null;

  async function startRequest(
    campaign: ReenrollmentCampaign,
    studentId: string,
  ) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await reenrollmentService.createRequest(campaign.id, studentId);
      await loadData(true);
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
      await loadData(true);
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
            Há uma campanha de rematrícula aberta para revisão.
          </p>
        </div>
      </div>
      {feedback && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
          {feedback}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {visibleCampaigns.map((campaign) => (
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
                  Período até{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                  }).format(new Date(campaign.closes_at))}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                {campaignIsOpen(campaign) ? "Aberta" : "Encerrada"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {studentIds.map((studentId) => {
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
                      {request?.request_status === "PENDING_CONFIRMATION" ? (
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
                      ) : request ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />{" "}
                          {requestStatusLabel(request)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void startRequest(campaign, studentId)}
                          disabled={isSubmitting || !campaignIsOpen(campaign)}
                          className="min-h-9 rounded-md border border-[#005bbf] px-3 py-1.5 text-xs font-bold text-[#005bbf] disabled:opacity-60"
                        >
                          Iniciar
                        </button>
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
        ))}
      </div>
    </section>
  );
}
