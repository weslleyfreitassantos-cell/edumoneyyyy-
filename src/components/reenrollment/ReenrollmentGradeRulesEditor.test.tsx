// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useReenrollmentGradeRules: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("../../hooks/useReenrollment", () => ({
  useReenrollmentGradeRules: mocks.useReenrollmentGradeRules,
  useSaveReenrollmentGradeRule: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

import ReenrollmentGradeRulesEditor from "./ReenrollmentGradeRulesEditor";
import type { ClassRow } from "../../services/classService";
import type { ReenrollmentCampaign } from "../../services/reenrollmentService";

const campaign = {
  id: "campaign-1",
  source_academic_year_id: "year-1",
  destination_academic_year_id: "year-2",
  eligible_grade_levels: ["1º ano"],
} as ReenrollmentCampaign;

const classes = [
  {
    id: "class-1",
    active: true,
    academic_year_id: "year-1",
    grade_level: "1º ano",
  },
  {
    id: "class-2",
    active: true,
    academic_year_id: "year-2",
    grade_level: "2º ano",
  },
] as ClassRow[];

describe("ReenrollmentGradeRulesEditor", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.useReenrollmentGradeRules.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    mocks.mutateAsync.mockReset().mockResolvedValue({
      id: "rule-1",
      institution_id: "school-1",
    });
  });

  it("requires a justified exception before saving a progression override", async () => {
    render(
      <ReenrollmentGradeRulesEditor
        institutionId="school-1"
        campaign={campaign}
        classes={classes}
      />,
    );

    expect(screen.getByText("1º ano")).toBeTruthy();
    const destination = screen.getByLabelText("Série de destino para 1º ano");
    fireEvent.change(destination, { target: { value: "2º ano" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar regra" }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Justificativa da exceção para 1º ano"), {
      target: { value: "Decisão fundamentada pelo conselho de classe." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar regra" }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      institutionId: "school-1",
      sourceGradeLevel: "1º ano",
      destinationGradeLevel: "2º ano",
      destinationStage: null,
      promotionPolicy: "PROMOTE",
      justification: "Decisão fundamentada pelo conselho de classe.",
    });
    expect(await screen.findByText(/Exceção de 1º ano salva com justificativa e auditoria/)).toBeTruthy();
  });

  it("does not infer or save a promotion destination that was not configured", () => {
    render(
      <ReenrollmentGradeRulesEditor
        institutionId="school-1"
        campaign={campaign}
        classes={classes.filter((row) => row.academic_year_id !== "year-2")}
      />,
    );

    expect((screen.getByLabelText("Série de destino para 1º ano") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Salvar regra" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps other unsaved grade drafts when saved rules refresh", async () => {
    const multiGradeCampaign = {
      ...campaign,
      eligible_grade_levels: ["1º ano", "2º ano"],
    } as ReenrollmentCampaign;
    const { rerender } = render(
      <ReenrollmentGradeRulesEditor
        institutionId="school-1"
        campaign={multiGradeCampaign}
        classes={classes}
      />,
    );

    const secondGradeDestination = screen.getByLabelText("Série de destino para 2º ano");
    fireEvent.change(secondGradeDestination, { target: { value: "3º ano" } });

    mocks.useReenrollmentGradeRules.mockReturnValue({
      data: [{
        id: "rule-1",
        institution_id: "school-1",
        source_grade_level: "1º ano",
        destination_grade_level: "2º ano",
        destination_stage: null,
        promotion_policy: "PROMOTE",
        active: true,
      }],
      isLoading: false,
      isError: false,
    });
    rerender(
      <ReenrollmentGradeRulesEditor
        institutionId="school-1"
        campaign={multiGradeCampaign}
        classes={classes}
      />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("Série de destino para 2º ano") as HTMLInputElement).value)
        .toBe("3º ano");
    });
  });
});
