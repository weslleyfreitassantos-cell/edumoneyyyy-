import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import {
  useReenrollmentGradeRules,
  useSaveReenrollmentGradeRule,
} from "../../hooks/useReenrollment";
import type { ClassRow } from "../../services/classService";
import type {
  ReenrollmentCampaign,
  ReenrollmentGradeRule,
} from "../../services/reenrollmentService";

interface ReenrollmentGradeRulesEditorProps {
  institutionId: string;
  campaign: ReenrollmentCampaign;
  classes: ClassRow[];
}

interface GradeRuleDraft {
  promotionPolicy: ReenrollmentGradeRule["promotion_policy"];
  destinationGradeLevel: string;
  destinationStage: string;
}

function normalizeGrade(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function ruleErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/REENROLLMENT_GRADE_RULE_NOT_ALLOWED|42501|permission denied/i.test(message)) {
    return "Seu perfil não pode alterar as regras de progressão desta instituição.";
  }
  if (/REENROLLMENT_DESTINATION_GRADE_REQUIRED/i.test(message)) {
    return "Informe a série de destino antes de salvar.";
  }
  return "Não foi possível salvar a regra. Atualize a lista e tente novamente.";
}

export default function ReenrollmentGradeRulesEditor({
  institutionId,
  campaign,
  classes,
}: ReenrollmentGradeRulesEditorProps) {
  const rulesQuery = useReenrollmentGradeRules(institutionId);
  const saveMutation = useSaveReenrollmentGradeRule();
  const [draftState, setDraftState] = useState<{
    campaignId: string;
    drafts: Record<string, GradeRuleDraft>;
  }>({ campaignId: campaign.id, drafts: {} });
  const [feedback, setFeedback] = useState<string | null>(null);
  const drafts = draftState.campaignId === campaign.id ? draftState.drafts : {};

  const sourceGrades = useMemo(() => {
    const activeSourceGrades = classes
      .filter(
        (row) =>
          row.active &&
          row.academic_year_id === campaign.source_academic_year_id &&
          Boolean(row.grade_level?.trim()),
      )
      .map((row) => row.grade_level!.trim());
    const campaignGrades = campaign.eligible_grade_levels
      .map((grade) => grade.trim())
      .filter(Boolean);
    const candidates = campaignGrades.length ? campaignGrades : activeSourceGrades;
    return [...new Map(candidates.map((grade) => [normalizeGrade(grade), grade])).values()]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  }, [campaign.eligible_grade_levels, campaign.source_academic_year_id, classes]);

  const destinationGrades = useMemo(
    () =>
      [...new Set(
        classes
          .filter(
            (row) =>
              row.active &&
              row.academic_year_id === campaign.destination_academic_year_id &&
              Boolean(row.grade_level?.trim()),
          )
          .map((row) => row.grade_level!.trim()),
      )].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    [campaign.destination_academic_year_id, classes],
  );

  useEffect(() => {
    if (!rulesQuery.data) return;
    setDraftState((current) => {
      const sameCampaign = current.campaignId === campaign.id;
      const nextDrafts = sameCampaign ? { ...current.drafts } : {};
      for (const sourceGrade of sourceGrades) {
        const key = normalizeGrade(sourceGrade);
        if (nextDrafts[key]) continue;
        const saved = rulesQuery.data.find(
          (rule) => normalizeGrade(rule.source_grade_level) === key,
        );
        nextDrafts[key] = {
          promotionPolicy: saved?.promotion_policy ?? "PROMOTE",
          destinationGradeLevel: saved?.destination_grade_level ?? "",
          destinationStage: saved?.destination_stage ?? "",
        };
      }
      return { campaignId: campaign.id, drafts: nextDrafts };
    });
  }, [campaign.id, rulesQuery.data, sourceGrades]);

  function updateDraft(sourceGrade: string, updates: Partial<GradeRuleDraft>) {
    const key = normalizeGrade(sourceGrade);
    setDraftState((current) => {
      const currentDrafts = current.campaignId === campaign.id ? current.drafts : {};
      return {
        campaignId: campaign.id,
        drafts: {
          ...currentDrafts,
          [key]: { ...currentDrafts[key], ...updates },
        },
      };
    });
  }

  async function saveRule(sourceGrade: string) {
    const draft = drafts[normalizeGrade(sourceGrade)];
    if (!draft) return;
    if (draft.promotionPolicy !== "GRADUATE" && !draft.destinationGradeLevel.trim()) {
      setFeedback(`Informe o destino de ${sourceGrade}.`);
      return;
    }
    setFeedback(null);
    try {
      await saveMutation.mutateAsync({
        institutionId,
        sourceGradeLevel: sourceGrade,
        destinationGradeLevel:
          draft.promotionPolicy === "GRADUATE"
            ? null
            : draft.destinationGradeLevel.trim(),
        destinationStage: draft.destinationStage.trim() || null,
        promotionPolicy: draft.promotionPolicy,
      });
      setFeedback(`Regra de ${sourceGrade} salva e disponível para esta instituição.`);
    } catch (error) {
      setFeedback(ruleErrorMessage(error));
    }
  }

  return (
    <section className="rounded-lg border border-[#dfe3e8] bg-slate-50 p-4" aria-labelledby="reenrollment-grade-rules-title">
      <div>
        <h3 id="reenrollment-grade-rules-title" className="font-bold text-[#181c20]">
          Progressão de série
        </h3>
        <p className="mt-1 text-xs text-[#667085]">
          Defina explicitamente o destino acadêmico para cada série elegível. A regra é institucional e não altera matrículas existentes.
        </p>
      </div>

      {feedback && (
        <p className="mt-3 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-blue-800" role="status">
          {feedback}
        </p>
      )}

      {rulesQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#667085]">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando regras...
        </div>
      ) : rulesQuery.isError ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          Não foi possível consultar as regras da instituição. Atualize a página ou solicite acesso à Direção.
        </p>
      ) : sourceGrades.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-[#cbd5e1] bg-white p-3 text-sm text-[#667085]">
          A campanha não informa séries elegíveis e não há turmas ativas no ano de origem.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {sourceGrades.map((sourceGrade) => {
            const key = normalizeGrade(sourceGrade);
            const draft = drafts[key] ?? {
              promotionPolicy: "PROMOTE" as const,
              destinationGradeLevel: "",
              destinationStage: "",
            };
            const savedRule = rulesQuery.data?.find(
              (rule) => normalizeGrade(rule.source_grade_level) === key && rule.active,
            );
            const graduating = draft.promotionPolicy === "GRADUATE";

            return (
              <div key={key} className="grid gap-3 rounded-md border border-[#e2e8f0] bg-white p-3 md:grid-cols-[minmax(110px,0.7fr)_minmax(145px,0.8fr)_minmax(150px,1fr)_minmax(145px,1fr)_auto] md:items-end">
                <div>
                  <p className="text-xs text-[#667085]">Série atual</p>
                  <p className="font-semibold text-[#181c20]">{sourceGrade}</p>
                </div>
                <label className="text-xs font-semibold text-[#667085]">
                  Decisão
                  <select
                    aria-label={`Decisão para ${sourceGrade}`}
                    value={draft.promotionPolicy}
                    onChange={(event) => {
                      const policy = event.target.value as GradeRuleDraft["promotionPolicy"];
                      updateDraft(sourceGrade, {
                        promotionPolicy: policy,
                        ...(policy === "RETAIN" ? { destinationGradeLevel: sourceGrade } : {}),
                      });
                    }}
                    className="mt-1 min-h-9 w-full rounded-md border border-[#cbd5e1] px-2 text-sm font-normal text-[#181c20]"
                  >
                    <option value="PROMOTE">Promover</option>
                    <option value="RETAIN">Manter na série</option>
                    <option value="GRADUATE">Concluinte</option>
                    <option value="MANUAL">Definir manualmente</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-[#667085]">
                  Série de destino
                  <input
                    aria-label={`Série de destino para ${sourceGrade}`}
                    list={`destination-grades-${campaign.id}`}
                    value={graduating ? "Conclusão" : draft.destinationGradeLevel}
                    disabled={graduating || draft.promotionPolicy === "RETAIN"}
                    onChange={(event) => updateDraft(sourceGrade, { destinationGradeLevel: event.target.value })}
                    placeholder="Selecione ou informe"
                    className="mt-1 min-h-9 w-full rounded-md border border-[#cbd5e1] px-2 text-sm font-normal text-[#181c20] disabled:bg-slate-100"
                  />
                  <datalist id={`destination-grades-${campaign.id}`}>
                    {destinationGrades.map((grade) => <option key={grade} value={grade} />)}
                  </datalist>
                </label>
                <label className="text-xs font-semibold text-[#667085]">
                  Etapa (opcional)
                  <input
                    aria-label={`Etapa de destino para ${sourceGrade}`}
                    value={draft.destinationStage}
                    onChange={(event) => updateDraft(sourceGrade, { destinationStage: event.target.value })}
                    placeholder="Ex.: Ensino Médio"
                    className="mt-1 min-h-9 w-full rounded-md border border-[#cbd5e1] px-2 text-sm font-normal text-[#181c20]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveRule(sourceGrade)}
                  disabled={saveMutation.isPending || (!graduating && !draft.destinationGradeLevel.trim())}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#005bbf] px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saveMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savedRule ? "Atualizar" : "Salvar regra"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
