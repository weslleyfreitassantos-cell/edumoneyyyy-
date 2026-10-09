// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  attempts: [] as Array<Record<string, unknown>>,
  attemptDetail: null as Record<string, unknown> | null,
  saveAnswers: vi.fn().mockResolvedValue({}),
  saveNavigation: vi.fn().mockResolvedValue({}),
  submit: vi.fn().mockResolvedValue({
    score: 50,
    correct_count: 1,
    total_questions: 2,
    area_breakdown: {},
  }),
}));

const storageState = vi.hoisted(() => ({
  createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "profile-1" } }),
}));
vi.mock("../../contexts/InstitutionContext", () => ({
  useInstitution: () => ({ currentInstitutionId: "institution-1" }),
}));
vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => storageState),
    },
  },
}));
vi.mock("../../hooks/useLearningCenter", () => ({
  useLearningStudent: () => ({ data: { id: "student-1" }, isLoading: false }),
  useEnemSimulationTemplates: () => ({
    data: [
      {
        id: "simulation-1",
        title: "Matemática",
        simulation_type: "SUBJECT",
        area: null,
        subject: "MATEMATICA",
        question_count: 2,
        duration_minutes: 20,
        available_count: 2,
        language_options: [],
        metadata: {},
      },
    ],
    isLoading: false,
  }),
  useEnemSimulationAttempt: (attemptId: string | null) => ({
    data: attemptId
      ? (state.attemptDetail ?? {
          attempt_id: attemptId,
          simulation_id: "simulation-1",
          status: "IN_PROGRESS",
          started_at: new Date().toISOString(),
          questions: [
            {
              position: 1,
              question_bank_id: "question-1",
              options: ["Uma", "Duas"],
              statement_assets: [
                {
                  storage_path: null,
                  public_url: "https://example.test/question-1.png",
                },
              ],
            },
            {
              position: 2,
              question_bank_id: "question-2",
              options: ["Três", "Quatro"],
              statement_assets: [
                {
                  storage_path: null,
                  public_url: "https://example.test/question-2.png",
                },
              ],
            },
          ],
          answers: {},
          navigation_state: null,
        })
      : undefined,
    isLoading: false,
    isError: false,
  }),
  useLearningSimulationAttempts: () => ({
    data: state.attempts,
    isLoading: false,
  }),
  useStartEnemSimulation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      attempt_id: "attempt-1",
      created: true,
      question_count: 2,
      language_choice: null,
    }),
    isPending: false,
  }),
  useSaveEnemSimulationAnswers: () => ({
    mutateAsync: state.saveAnswers,
  }),
  useSaveLearningSimulationNavigation: () => ({
    mutateAsync: state.saveNavigation,
    isPending: false,
  }),
  useSubmitEnemSimulation: () => ({
    mutateAsync: state.submit,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import SimulationPage from "./SimulationPage";

afterEach(() => {
  cleanup();
  state.attempts = [];
  state.attemptDetail = null;
  state.saveAnswers.mockClear();
  state.saveNavigation.mockClear();
  state.submit.mockClear();
  storageState.createSignedUrls.mockReset();
  storageState.createSignedUrls.mockResolvedValue({ data: [], error: null });
});

function renderPage(initialEntry = "/student/study/simulation?simulation=simulation-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SimulationPage />
    </MemoryRouter>,
  );
}

function makeQuestions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    question_bank_id: `question-${index + 1}`,
    options: ["Uma", "Duas"],
    statement_assets: [
      {
        storage_path: null,
        public_url: `https://example.test/question-${index + 1}.png`,
      },
    ],
  }));
}

describe("SimulationPage", () => {
  it.each([10, 45])(
    "keeps the question navigator in one horizontal row with %i questions",
    async (questionCount) => {
      state.attemptDetail = {
        attempt_id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        started_at: new Date().toISOString(),
        questions: makeQuestions(questionCount),
        answers: {},
        navigation_state: null,
      };
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Começar prática" }));

      const navigation = await screen.findByRole("navigation", {
        name: "Navegador da prática",
      });
      const questionRail = navigation.querySelector(
        '[aria-label="Navegação das questões"]',
      );

      expect(questionRail).toBeTruthy();
      expect(questionRail?.className).toContain("flex-nowrap");
      expect(questionRail?.className).toContain("overflow-x-auto");
      expect(
        Array.from(navigation.querySelectorAll("button")).filter((button) =>
          button.getAttribute("aria-label")?.startsWith("Questão "),
        ),
      ).toHaveLength(questionCount);
    },
  );

  it("offers navigator, persistent flagging and final review", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Começar prática" }));

    expect(
      await screen.findByRole("navigation", { name: "Navegador da prática" }),
    ).toBeTruthy();
    expect(screen.queryByText("tempo restante")).toBeNull();
    const flag = screen.getByRole("button", {
      name: "Marcar questão para revisar",
    });
    fireEvent.click(flag);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Remover marcação da questão" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    await waitFor(() =>
      expect(state.saveNavigation).toHaveBeenCalledWith({
        attemptId: "attempt-1",
        navigation: { current_index: 0, flagged: ["question-1"] },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("Questão 2 de 2") === true,
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar e finalizar" }),
    );
    expect(screen.getByRole("region", { name: "Revisão final" })).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Revisão final" }).textContent,
    ).toContain("não respondidas");
  });

  it("shows the original ENEM source reference instead of the practice position", async () => {
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          source_kind: "STRUCTURED_PROVIDER",
          source_year: 2018,
          question_number: 117,
          source_reference: {
            source_year: 2018,
            source_exam: "ENEM",
            source_application: "PPL",
            source_question_number: 117,
            source_provider: "xequemat",
          },
          statement: "Enunciado da questão de origem.",
          options: ["A", "B", "C", "D", "E"],
          structured_content: {
            context: "Texto de apoio.",
            prompt: "Enunciado da questão de origem.",
            alternatives: [
              { letter: "A", text: "A" },
              { letter: "B", text: "B" },
              { letter: "C", text: "C" },
              { letter: "D", text: "D" },
              { letter: "E", text: "E" },
            ],
            render_mode: "STRUCTURED_TEXT",
            essential_media: [],
          },
          statement_assets: [],
        },
      ],
      answers: {},
      navigation_state: null,
    };

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Começar prática" }));

    expect(await screen.findByText("ENEM 2018 · PPL · Questão 117")).toBeTruthy();
  });

  it("uses human area labels and does not show the duration timer in the result", async () => {
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          options: ["Uma", "Duas"],
          statement_assets: [{ storage_path: null, public_url: "https://example.test/question-1.png" }],
        },
        {
          position: 2,
          question_bank_id: "question-2",
          options: ["Três", "Quatro"],
          statement_assets: [{ storage_path: null, public_url: "https://example.test/question-2.png" }],
        },
      ],
      answers: {},
      navigation_state: null,
    };
    state.submit.mockResolvedValueOnce({
      score: 50,
      correct_count: 1,
      total_questions: 2,
      area_breakdown: { CIENCIAS_NATUREZA: { correct: 1, total: 2 } },
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Começar prática" }));
    fireEvent.click((await screen.findAllByRole("radio"))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e finalizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar prática" }));

    expect(await screen.findByRole("heading", { name: "Prática concluída" })).toBeTruthy();
    expect(screen.getByText("Ciências Naturais")).toBeTruthy();
    expect(screen.queryByText("CIENCIAS_NATUREZA")).toBeNull();
    expect(screen.queryByText("Duração")).toBeNull();
  });

  it("does not auto-resume a noncanonical content revision", async () => {
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "structured-text-only-v6",
        started_at: new Date(Date.now() - 60_000).toISOString(),
        navigation_state: { current_index: 1, flagged: ["question-2"] },
        answers: { "question-1": { answer: "A" } },
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      started_at: new Date(Date.now() - 60_000).toISOString(),
      navigation_state: { current_index: 1, flagged: ["question-2"] },
      answers: { "question-1": { answer: "A" } },
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          options: ["Uma", "Duas"],
          statement_assets: [
            {
              storage_path: null,
              public_url: "https://example.test/question-1.png",
            },
          ],
        },
        {
          position: 2,
          question_bank_id: "question-2",
          options: ["Três", "Quatro"],
          statement_assets: [
            {
              storage_path: null,
              public_url: "https://example.test/question-2.png",
            },
          ],
        },
      ],
    };
    renderPage();

    expect(await screen.findByRole("heading", { name: "Confirme sua prática" })).toBeTruthy();
    expect(screen.queryByText("Questão 2 de 2")).toBeNull();
  });

  it("auto-resumes the canonical archive content revision", async () => {
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date(Date.now() - 60_000).toISOString(),
        navigation_state: { current_index: 1, flagged: ["question-2"] },
        answers: { "question-1": { answer: "A" } },
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      content_revision: "xequemat-archive-v1",
      started_at: new Date(Date.now() - 60_000).toISOString(),
      navigation_state: { current_index: 1, flagged: ["question-2"] },
      answers: { "question-1": { answer: "A" } },
      questions: [
        { position: 1, question_bank_id: "question-1", options: ["Uma", "Duas"], statement_assets: [] },
        { position: 2, question_bank_id: "question-2", options: ["Três", "Quatro"], statement_assets: [] },
      ],
    };
    renderPage();
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("Questão 2 de 2") === true,
      ),
    ).toBeTruthy();
  });

  it("blocks answering when current archive content is missing", async () => {
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date().toISOString(),
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      content_revision: "xequemat-archive-v1",
      started_at: new Date().toISOString(),
      navigation_state: null,
      answers: {},
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          options: ["Uma", "Duas"],
          statement_assets: [],
        },
      ],
    };
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível carregar o enunciado oficial",
    );
    expect(screen.queryByRole("radio")).toBeNull();
    expect(
      screen.getByText("Resposta indisponível enquanto o enunciado não carregar."),
    ).toBeTruthy();
  });

  it("renders canonical media alternatives from the archive", async () => {
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date().toISOString(),
      },
    ];
    const optionAssets = (label: string) => [
      {
        media_type: "OPTION_CROP",
        storage_path: null,
        public_url: `https://example.test/option-${label}.png`,
        metadata: { asset_role: `OPTION_${label}`, option_label: label },
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date().toISOString(),
      navigation_state: null,
      answers: {},
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          options: (["A", "B", "C", "D", "E"] as const).map((label) => ({
            label,
            text: null,
            assets: optionAssets(label),
          })),
          statement_assets: [
            {
              storage_path: null,
              public_url: "https://example.test/statement.png",
            },
          ],
        },
      ],
    };
    renderPage();

    expect(await screen.findByAltText("Enunciado oficial da questão 1, parte 1")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(6);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("resolves private canonical media with signed URLs", async () => {
    const storagePath = "enem/xequemat-archive-v1/question-175.webp";
    const signedUrl = "https://signed.example/question-175.webp";
    storageState.createSignedUrls.mockResolvedValue({
      data: [{ path: storagePath, signedUrl }],
      error: null,
    });
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date().toISOString(),
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      content_revision: "xequemat-archive-v1",
      started_at: new Date().toISOString(),
      navigation_state: null,
      answers: {},
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          options: ["Uma", "Duas", "Três", "Quatro", "Cinco"],
          statement_assets: [
            {
              storage_path: storagePath,
              public_url: null,
            },
          ],
        },
      ],
    };
    renderPage();

    const image = await screen.findByAltText("Enunciado oficial da questão 1, parte 1");
    expect(image.getAttribute("src")).toBe(signedUrl);
    expect(storageState.createSignedUrls).toHaveBeenCalledWith([storagePath], 3600);
  });

  it("renders verified archive content as selectable text without statement media", async () => {
    state.attempts = [
      {
        id: "attempt-1",
        simulation_id: "simulation-1",
        status: "IN_PROGRESS",
        content_revision: "xequemat-archive-v1",
        started_at: new Date().toISOString(),
      },
    ];
    state.attemptDetail = {
      attempt_id: "attempt-1",
      simulation_id: "simulation-1",
      status: "IN_PROGRESS",
      content_revision: "xequemat-archive-v1",
      started_at: new Date().toISOString(),
      navigation_state: null,
      answers: {},
      questions: [
        {
          position: 1,
          question_bank_id: "question-1",
          structured_content: {
            context: "Contexto estruturado da questão.",
            prompt: "Qual alternativa está correta?",
            alternatives: [],
            render_mode: "STRUCTURED_TEXT",
            essential_media: [],
          },
          options: ["Uma resposta", "Outra resposta", "Terceira resposta", "Quarta resposta", "Quinta resposta"],
          statement_assets: [
            {
              storage_path: null,
              public_url: "https://example.test/legacy-statement.png",
            },
          ],
        },
      ],
    };
    renderPage();
    expect(await screen.findByText("Contexto estruturado da questão.")).toBeTruthy();
    expect(screen.getByText("Qual alternativa está correta?")).toBeTruthy();
    expect(screen.queryByAltText("Enunciado oficial da questão 1, parte 1")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("does not silently replace an invalid simulation with the first template", async () => {
    renderPage("/student/study/simulation?simulation=missing-simulation");
    expect(
      await screen.findByRole("heading", { name: "Prática não disponível" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Começar prática" })).toBeNull();
    expect(screen.queryByText("Escolha uma prática")).toBeNull();
  });
});
