import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  Flag,
  ListChecks,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { useInstitution } from "../../contexts/InstitutionContext";
import { supabase } from "../../lib/supabaseClient";
import {
  CURRENT_ENEM_CONTENT_REVISION,
  type EnemContentBlock,
  type EnemSimulationQuestion,
  type EnemStructuredContent,
  type EnemSimulationOption,
} from "../../services/learningCenterService";
import {
  useEnemSimulationAttempt,
  useEnemSimulationTemplates,
  useLearningSimulationAttempts,
  useLearningStudent,
  useSaveEnemSimulationAnswers,
  useSaveLearningSimulationNavigation,
  useStartEnemSimulation,
  useSubmitEnemSimulation,
} from "../../hooks/useLearningCenter";
import { humanizeSubjectArea } from "../../lib/learningPresentation";

function answerMapFromAttempt(
  answers: Record<string, { answer: unknown }> | undefined,
) {
  return Object.fromEntries(
    Object.entries(answers ?? {}).map(([id, value]) => [
      id,
      String(value.answer ?? ""),
    ]),
  );
}

const ENEM_QUESTION_ASSETS_BUCKET = "enem-question-assets";
const ENEM_MEDIA_URL_TTL_SECONDS = 3600;

type MediaAssetReference = {
  storage_path: string | null;
  public_url: string | null;
};

type MediaUrlMap = ReadonlyMap<string, string>;

function directMediaUrl(
  asset: MediaAssetReference | string,
  signedUrls: MediaUrlMap,
) {
  if (typeof asset === "string") {
    return /^https?:\/\//i.test(asset) ? asset : null;
  }
  if (asset.storage_path) {
    if (/^https?:\/\//i.test(asset.storage_path)) return asset.storage_path;
    return signedUrls.get(asset.storage_path) ?? null;
  }
  return asset.public_url && /^https?:\/\//i.test(asset.public_url)
    ? asset.public_url
    : null;
}

function normalizeOption(
  option: EnemSimulationOption | string,
  index: number,
): EnemSimulationOption {
  const fallbackLabel = String.fromCharCode("A".charCodeAt(0) + index) as EnemSimulationOption["label"];
  if (typeof option === "string") {
    return { label: fallbackLabel, text: option, assets: [] };
  }
  return {
    label: option.label ?? fallbackLabel,
    text: option.text ?? null,
    assets: option.assets ?? [],
  };
}

function useSignedMediaUrls(assets: MediaAssetReference[]) {
  const paths = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .map((asset) => asset.storage_path)
            .filter(
              (path): path is string => Boolean(path) && !/^https?:\/\//i.test(path),
            ),
        ),
      ),
    [assets],
  );
  const pathsKey = paths.join("\u0000");
  const [state, setState] = useState<{
    key: string;
    urls: Map<string, string>;
    loading: boolean;
  }>({ key: "", urls: new Map(), loading: false });

  useEffect(() => {
    let cancelled = false;
    if (!paths.length) {
      setState({ key: pathsKey, urls: new Map(), loading: false });
      return () => {
        cancelled = true;
      };
    }

    setState((current) => ({ ...current, key: pathsKey, loading: true }));
    void supabase.storage
      .from(ENEM_QUESTION_ASSETS_BUCKET)
      .createSignedUrls(paths, ENEM_MEDIA_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (cancelled) return;
        const urls = new Map(
          (error ? [] : data ?? [])
            .filter((item) => Boolean(item.path && item.signedUrl))
            .map((item) => [item.path, item.signedUrl] as [string, string]),
        );
        setState({ key: pathsKey, urls, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key: pathsKey, urls: new Map(), loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [pathsKey]);

  return {
    urls: state.key === pathsKey ? state.urls : new Map<string, string>(),
    loading: state.key !== pathsKey || state.loading,
  };
}

function StructuredMedia({
  media,
  signedUrls,
}: {
  media: EnemStructuredContent["essential_media"];
  signedUrls: MediaUrlMap;
}) {
  return (
    <>
      {media.map((item, index) => {
        const url = directMediaUrl(item, signedUrls);
        if (!url) return null;
        return (
          <img
            key={`${url}-${index}`}
            src={url}
            alt="Mídia essencial da questão"
            className="h-auto max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
          />
        );
      })}
    </>
  );
}

function BlockMedia({ block, signedUrls }: { block: EnemContentBlock; signedUrls: MediaUrlMap }) {
  return <StructuredMedia media={block.media ?? []} signedUrls={signedUrls} />;
}

function renderContentBlock(block: EnemContentBlock, index: number, signedUrls: MediaUrlMap) {
  const key = `${block.kind}-${index}-${block.text?.slice(0, 24) ?? ""}`;
  if (block.kind === "IMAGE") return <div key={key}><BlockMedia block={block} signedUrls={signedUrls} /></div>;
  if (block.kind === "LIST") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag key={key} className="list-inside list-disc space-y-1 pl-2">
        {(block.items ?? []).map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{item}</li>)}
      </Tag>
    );
  }
  if (block.kind === "QUOTE") {
    return <blockquote key={key} className="border-l-4 border-slate-300 pl-4 italic">{block.text}</blockquote>;
  }
  return (
    <p key={key} className="whitespace-pre-line">
      {block.text}
    </p>
  );
}

function StructuredText({
  content,
  signedUrls,
}: {
  content: EnemStructuredContent;
  signedUrls: MediaUrlMap;
}) {
  const contentBlocks = content.content_blocks ?? [];
  const paragraphs = [content.context, content.prompt]
    .flatMap((value) => value.split(/\r?\n\s*\r?\n/gu))
    .map((value) => value.replace(/!\[[^\]]*\]\([^)]*\)/gu, "").replace(/[\*_`~]/gu, "").trim())
    .filter(Boolean);
  return (
    <article
      aria-label="Enunciado estruturado da questão"
      className="max-w-4xl space-y-4 text-base leading-7 text-slate-800 dark:text-slate-100"
    >
      {contentBlocks.length
        ? contentBlocks.map((block, index) => renderContentBlock(block, index, signedUrls))
        : paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      {contentBlocks.length ? null : <StructuredMedia media={content.essential_media} signedUrls={signedUrls} />}
    </article>
  );
}

function sourceReferenceForQuestion(question: EnemSimulationQuestion) {
  const metadata = question.metadata ?? {};
  const nested = metadata.source_provenance && typeof metadata.source_provenance === "object"
    ? metadata.source_provenance as Record<string, unknown>
    : {};
  const source = (question.source_reference ?? (metadata.source_reference && typeof metadata.source_reference === "object"
    ? metadata.source_reference as Record<string, unknown>
    : nested)) as Record<string, unknown>;
  const year = typeof source.source_year === "number"
    ? source.source_year
    : typeof source.year === "number" ? source.year : question.source_year;
  const application = source.source_application === "REGULAR" || source.source_application === "PPL"
    ? source.source_application
    : source.application === "REGULAR" || source.application === "PPL" ? source.application : null;
  const number = typeof source.source_question_number === "number"
    ? source.source_question_number
    : typeof source.question_number === "number" ? source.question_number : question.question_number;
  const exam = typeof source.source_exam === "string"
    ? source.source_exam
    : typeof source.exam === "string" ? source.exam : question.source_kind === "OFFICIAL_OCCURRENCE" ? "ENEM" : null;
  if (!exam || !year || !application || !number) return null;
  return {
    label: `${exam} ${year} · ${application === "PPL" ? "PPL" : "Regular"} · Questão ${number}`,
    url: typeof source.source_url === "string"
      ? source.source_url
      : typeof source.url === "string" ? source.url : null,
  };
}

type SimulationResult = {
  score: number;
  correct_count: number;
  total_questions: number;
  area_breakdown?: Record<string, { correct: number; total: number }>;
  skill_breakdown?: Record<string, { correct: number; total: number }>;
  answered_count: number;
  duration_seconds: number;
};

export default function SimulationPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const student = useLearningStudent(
    currentInstitutionId ?? undefined,
    profile?.id,
  );
  const templates = useEnemSimulationTemplates(
    currentInstitutionId ?? undefined,
  );
  const attempts = useLearningSimulationAttempts(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSimulationId, setSelectedSimulationId] = useState(
    () => searchParams.get("simulation") ?? "",
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [navigationStatus, setNavigationStatus] = useState<
    "idle" | "saving" | "error"
  >("idle");
  const [reviewing, setReviewing] = useState(false);
  const [languageChoice, setLanguageChoice] = useState<"ENGLISH" | "SPANISH">(
    "ENGLISH",
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [failedStatementAssets, setFailedStatementAssets] = useState<
    Record<string, boolean>
  >({});
  const [failedOptionAssets, setFailedOptionAssets] = useState<
    Record<string, boolean>
  >({});
  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);
  const questionNavigatorRef = useRef<HTMLDivElement>(null);
  const hydratedAttemptRef = useRef<string | null>(null);

  const simulation = useMemo(() => {
    const available = templates.data ?? [];
    return available.find((item) => item.id === selectedSimulationId) ?? null;
  }, [selectedSimulationId, templates.data]);
  const languageOptions = useMemo(
    () =>
      (simulation?.language_options ?? []).filter(
        (value): value is "ENGLISH" | "SPANISH" =>
          value === "ENGLISH" || value === "SPANISH",
      ),
    [simulation?.language_options],
  );
  const openAttempt = useMemo(
    () =>
      (attempts.data ?? []).find(
        (item) =>
          item.simulation_id === simulation?.id &&
          item.status === "IN_PROGRESS" &&
          item.content_revision === CURRENT_ENEM_CONTENT_REVISION,
      ),
    [attempts.data, simulation?.id],
  );
  const attempt = useEnemSimulationAttempt(attemptId);
  const start = useStartEnemSimulation(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const saveAnswers = useSaveEnemSimulationAnswers();
  const saveNavigation = useSaveLearningSimulationNavigation();
  const submit = useSubmitEnemSimulation(
    currentInstitutionId ?? undefined,
    student.data?.id,
  );
  const questions = useMemo(
    () =>
      [...(attempt.data?.questions ?? [])].sort(
        (left, right) => left.position - right.position,
      ),
    [attempt.data?.questions],
  );
  const completedAttempts = useMemo(
    () =>
      (attempts.data ?? []).filter(
        (item) =>
          item.simulation_id === simulation?.id && item.status === "COMPLETED",
      ),
    [attempts.data, simulation?.id],
  );
  const answeredCount = questions.filter((question) =>
    Boolean(answers[question.question_bank_id]?.trim()),
  ).length;
  const flaggedIds = questions
    .filter((question) => flagged[question.question_bank_id])
    .map((question) => question.question_bank_id);
  const currentQuestion = questions[currentIndex] ?? questions[0];
  const currentSourceReference = currentQuestion
    ? sourceReferenceForQuestion(currentQuestion)
    : null;
  const structuredContent = currentQuestion?.structured_content ?? null;
  const isCurrentTextOnlyAttempt =
    attempt.data?.content_revision?.startsWith("structured-text-only-") ?? false;
  const questionUnavailable =
    Boolean(currentQuestion) && isCurrentTextOnlyAttempt && !structuredContent;
  const currentStatementAssets = useMemo(
    () => currentQuestion?.statement_assets ?? [],
    [currentQuestion?.statement_assets],
  );
  const currentOptions = useMemo(
    () => currentQuestion?.options.map(normalizeOption) ?? [],
    [currentQuestion?.options],
  );
  const currentMediaAssets = useMemo<MediaAssetReference[]>(() => {
    if (!currentQuestion) return [];
    return [
      ...currentStatementAssets,
      ...(structuredContent?.essential_media ?? []).filter(
        (asset): asset is MediaAssetReference => typeof asset !== "string",
      ),
      ...(structuredContent?.content_blocks ?? []).flatMap(
        (block) => block.media ?? [],
      ),
      ...currentOptions.flatMap((option) => option.assets),
    ];
  }, [currentOptions, currentQuestion, currentStatementAssets, structuredContent]);
  const signedMedia = useSignedMediaUrls(currentMediaAssets);
  const missingStatementAsset =
    questionUnavailable ||
    (Boolean(currentQuestion) &&
    !structuredContent &&
    !signedMedia.loading &&
    (currentStatementAssets.length === 0 ||
      currentStatementAssets.some((asset, index) => {
        const url = directMediaUrl(asset, signedMedia.urls);
        return (
          !url ||
          failedStatementAssets[`${currentQuestion.question_bank_id}:${index}`]
        );
      })));
  const missingOptionAsset = Boolean(currentQuestion) && currentOptions.some((option) => {
    if (questionUnavailable) return true;
    if (structuredContent) return !option.text?.trim();
    if (option.text?.trim()) return false;
    if (signedMedia.loading) return false;
    return option.assets.length === 0 || option.assets.every((asset, index) => {
      const url = directMediaUrl(asset, signedMedia.urls);
      return !url || failedOptionAssets[`${currentQuestion!.question_bank_id}:${option.label}:${index}`];
    });
  });

  useEffect(() => {
    if (!questionUnavailable || !currentQuestion) return;
    console.error("[ENEM] Questão text-only sem conteúdo estruturado", {
      attemptId,
      questionBankId: currentQuestion.question_bank_id,
      contentRevision: attempt.data?.content_revision,
    });
  }, [
    attempt.data?.content_revision,
    attemptId,
    currentQuestion?.question_bank_id,
    questionUnavailable,
  ]);

  useEffect(() => {
    const available = templates.data ?? [];
    if (!available.length) return;
    const requestedId = searchParams.get("simulation");
    if (requestedId && available.some((item) => item.id === requestedId)) {
      if (selectedSimulationId !== requestedId) setSelectedSimulationId(requestedId);
      return;
    }
    if (selectedSimulationId && !available.some((item) => item.id === selectedSimulationId)) {
      setSelectedSimulationId("");
    }
  }, [searchParams, selectedSimulationId, templates.data]);

  useEffect(() => {
    if (simulation?.area !== "LINGUAGENS" || languageOptions.length === 0) return;
    if (!languageOptions.includes(languageChoice)) {
      setLanguageChoice(languageOptions[0]);
    }
  }, [languageChoice, languageOptions, simulation?.area]);

  useEffect(() => {
    if (!attemptId && openAttempt?.id) setAttemptId(openAttempt.id);
  }, [attemptId, openAttempt?.id]);

  useEffect(() => {
    const detail = attempt.data;
    if (!detail || detail.status !== "IN_PROGRESS" || !attemptId) return;
    if (hydratedAttemptRef.current === detail.attempt_id) return;
    hydratedAttemptRef.current = detail.attempt_id;
    setStartedAt(new Date(detail.started_at).getTime());
    setAnswers(answerMapFromAttempt(detail.answers));
    const restoredFlags = detail.navigation_state?.flagged ?? [];
    setFlagged(Object.fromEntries(restoredFlags.map((id) => [id, true])));
    setCurrentIndex(
      Math.min(
        Math.max(detail.navigation_state?.current_index ?? 0, 0),
        Math.max(detail.questions.length - 1, 0),
      ),
    );
  }, [attempt.data?.attempt_id, attemptId]);

  const persistNavigation = (
    index: number,
    nextFlagged: Record<string, boolean>,
  ) => {
    if (!attemptId) return;
    setNavigationStatus("saving");
    void saveNavigation
      .mutateAsync({
        attemptId,
        navigation: {
          current_index: index,
          flagged: Object.keys(nextFlagged).filter((id) => nextFlagged[id]),
        },
      })
      .then(() => setNavigationStatus("idle"))
      .catch(() => setNavigationStatus("error"));
  };

  const moveToQuestion = (index: number) => {
    setCurrentIndex(index);
    setReviewing(false);
    persistNavigation(index, flagged);
  };

  useEffect(() => {
    const activeQuestion = questionNavigatorRef.current?.querySelector<HTMLButtonElement>(
      '[aria-current="step"]',
    );
    if (typeof activeQuestion?.scrollIntoView !== "function") return;
    activeQuestion.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex, questions.length]);

  const toggleFlag = (questionId: string) => {
    const nextFlagged = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(nextFlagged);
    persistNavigation(currentIndex, nextFlagged);
  };

  const resetForSimulation = (simulationId: string) => {
    setSelectedSimulationId(simulationId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("simulation", simulationId);
    setSearchParams(nextParams, { replace: true });
    setAttemptId(null);
    hydratedAttemptRef.current = null;
    setStartedAt(null);
    setAnswers({});
    setFlagged({});
    setSaveStatus("idle");
    setNavigationStatus("idle");
    setCurrentIndex(0);
    setReviewing(false);
    setResult(null);
    setFailedStatementAssets({});
  };

  if (templates.isLoading || student.isLoading)
    return (
      <div className="grid min-h-48 place-items-center text-sm text-slate-500">
        Carregando práticas oficiais...
      </div>
    );
  if (templates.isError)
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Não foi possível verificar as práticas oficiais agora. Tente novamente
        em instantes.
      </section>
    );
  if (!simulation)
    return (
      <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <h1 className="text-lg font-bold">Prática não disponível</h1>
        <p className="mt-2">
          Este simulado não está disponível ou ainda não passou pela validação
          dos enunciados e das imagens.
        </p>
        <Link
          to="/student/study"
          className="mt-4 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 font-bold text-white"
        >
          Voltar para a Central de Estudos
        </Link>
      </section>
    );
  if (attemptId && attempt.isLoading)
    return (
      <div className="grid min-h-48 place-items-center text-sm text-slate-500">
        Preparando sua tentativa...
      </div>
    );
  if (attemptId && attempt.isError)
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Não foi possível carregar esta tentativa. Atualize a página para tentar
        novamente.
      </section>
    );

  const begin = () => {
    void start
      .mutateAsync({
        simulationId: simulation.id,
        languageChoice:
          simulation.area === "LINGUAGENS" ? languageChoice : undefined,
      })
      .then((started) => {
        setAttemptId(started.attempt_id);
        setStartedAt(Date.now());
        setSaveStatus("idle");
        setNavigationStatus("idle");
        setFailedStatementAssets({});
      });
  };

  const answerQuestion = (value: string) => {
    if (!currentQuestion || questionUnavailable || missingStatementAsset || missingOptionAsset) return;
    const nextAnswers = {
      ...answers,
      [currentQuestion.question_bank_id]: value,
    };
    setAnswers(nextAnswers);
    if (!attemptId) return;
    const version = saveVersionRef.current + 1;
    saveVersionRef.current = version;
    const payload = (Object.entries(nextAnswers) as Array<[string, string]>)
      .filter(([, currentAnswer]) => currentAnswer.trim())
      .map(([question_bank_id, currentAnswer]) => ({
        question_bank_id,
        answer: currentAnswer,
      }));
    setSaveStatus("saving");
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveAnswers.mutateAsync({ attemptId, answers: payload }))
      .then(() => {
        if (saveVersionRef.current === version) setSaveStatus("saved");
      })
      .catch(() => {
        if (saveVersionRef.current === version) setSaveStatus("error");
      });
  };

  const finish = () => {
    if (!attemptId) return;
    const payload = (Object.entries(answers) as Array<[string, string]>)
      .filter(([, currentAnswer]) => currentAnswer.trim())
      .map(([question_bank_id, currentAnswer]) => ({
        question_bank_id,
        answer: currentAnswer,
      }));
    const elapsedSeconds = startedAt
      ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      : 0;
    void submit
      .mutateAsync({
        attemptId,
        answers: payload,
        durationSeconds: elapsedSeconds,
      })
      .then((submitted) =>
        setResult({
          ...submitted,
          answered_count: payload.length,
          duration_seconds: elapsedSeconds,
        }),
      );
  };

  if (result) {
    const unanswered = Math.max(
      0,
      result.total_questions - result.answered_count,
    );
    const wrong = Math.max(
      0,
      result.total_questions - result.correct_count - unanswered,
    );
    return (
      <section className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold dark:text-white">
            Prática concluída
          </h1>
          <p className="mt-2 text-slate-500">
            {result.correct_count} de {result.total_questions} acertos ·{" "}
            {result.score}%
          </p>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            O resultado alimentou suas evidências de aprendizagem. Ele não é uma
            nota oficial do ENEM.
          </p>
        </div>
        <section
          aria-label="Resumo do resultado"
          className="grid gap-2 sm:grid-cols-3"
        >
          <div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xl font-bold text-emerald-600">
              {result.correct_count}
            </p>
            <p className="text-xs text-slate-500">Acertos</p>
          </div>
          <div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xl font-bold text-rose-600">{wrong}</p>
            <p className="text-xs text-slate-500">Incorretas</p>
          </div>
          <div className="rounded-lg border bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xl font-bold text-amber-600">{unanswered}</p>
            <p className="text-xs text-slate-500">Não respondidas</p>
          </div>
        </section>
        {result.area_breakdown &&
        Object.keys(result.area_breakdown).length > 0 ? (
          <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-bold dark:text-white">Leitura do resultado</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                Object.entries(result.area_breakdown) as Array<
                  [string, { correct: number; total: number }]
                >
              ).map(([area, value]) => (
                <div
                  key={area}
                  className="rounded-lg border p-3 text-sm dark:border-slate-700"
                >
                  <p className="font-semibold dark:text-white">{humanizeSubjectArea(area)}</p>
                  <p className="mt-1 text-slate-500">
                    {value.correct}/{value.total} acertos
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <section
          aria-label="Próximos passos"
          className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="font-bold dark:text-white">Próximos passos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use o resultado para decidir como continuar, sem transformar esta
            prática em nota oficial.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/student/study#study-progress"
              className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"
            >
              Revisar habilidades
            </Link>
            <Link
              to="/student/study"
              className="rounded-lg border px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white"
            >
              Continuar estudo
            </Link>
            <button
              type="button"
              onClick={() => resetForSimulation(simulation.id)}
              className="rounded-lg border px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-white"
            >
              Nova prática
            </button>
          </div>
        </section>
      </section>
    );
  }

  if (!attemptId)
    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <Link
          to="/student/study"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">
            Preparação para o ENEM
          </p>
          <h1 className="mt-1 text-2xl font-bold dark:text-white">
            Confirme sua prática
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Você está prestes a iniciar apenas a prática selecionada.
          </p>
        </header>
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-bold dark:text-white">
            {simulation.title}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {simulation.question_count} questões oficiais ·{" "}
            {simulation.duration_minutes ?? 20} min
          </p>
          {simulation.area === "LINGUAGENS" ? (
            <fieldset className="mt-5">
              <legend className="text-sm font-bold dark:text-white">
                Escolha o idioma das 5 questões de língua estrangeira
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {languageOptions.includes("ENGLISH") ? <label
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${languageChoice === "ENGLISH" ? "border-[#005bbf] bg-blue-50 text-[#005bbf]" : "dark:border-slate-700 dark:text-white"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="language"
                    checked={languageChoice === "ENGLISH"}
                    onChange={() => setLanguageChoice("ENGLISH")}
                  />
                  Inglês
                </label>
                  : null}
                {languageOptions.includes("SPANISH") ? <label
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${languageChoice === "SPANISH" ? "border-[#005bbf] bg-blue-50 text-[#005bbf]" : "dark:border-slate-700 dark:text-white"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="language"
                    checked={languageChoice === "SPANISH"}
                    onChange={() => setLanguageChoice("SPANISH")}
                  />
                  Espanhol
                </label>
                  : null}
              </div>
            </fieldset>
          ) : null}
          <button
            type="button"
            onClick={begin}
            disabled={start.isPending || !student.data}
            className="mt-6 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {start.isPending
              ? "Preparando..."
              : simulation.area
                ? "Começar simulado"
                : "Começar prática"}
          </button>
        </div>
        {completedAttempts.length > 0 ? (
          <section className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-bold dark:text-white">
              Histórico desta prática
            </h2>
            <div className="mt-3 divide-y dark:divide-slate-700">
              {completedAttempts.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-slate-500">
                    {new Date(
                      item.completed_at ?? item.started_at,
                    ).toLocaleDateString("pt-BR")}
                  </span>
                  <strong className="dark:text-white">
                    {item.correct_count}/{item.total_questions} · {item.score}%
                  </strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    );

  if (!currentQuestion || !attempt.data)
    return (
      <div className="grid min-h-48 place-items-center text-sm text-slate-500">
        Carregando questões oficiais...
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Link
        to="/student/study"
        className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"
      >
        <ChevronLeft className="h-4 w-4" />
        Central de Estudos
      </Link>
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">
              {simulation.area ? "Simulado por área" : "Prática por matéria"}
            </p>
            <h1 className="mt-1 text-2xl font-bold dark:text-white">
              {simulation.title}
            </h1>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <ListChecks className="h-4 w-4" />
          Questão {currentIndex + 1} de {questions.length} · {answeredCount}{" "}
          respondida(s)
        </p>
      </header>
      <nav
        aria-label="Navegador da prática"
        className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold dark:text-white">Navegação</p>
          <p className="text-xs text-slate-500">
            {flaggedIds.length} marcada(s) para revisar
          </p>
        </div>
        <div
          ref={questionNavigatorRef}
          aria-label="Navegação das questões"
          className="mt-3 -mx-1 flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden px-1 pb-2 snap-x snap-mandatory"
        >
          {questions.map((question, index) => {
            const isAnswered = Boolean(
              answers[question.question_bank_id]?.trim(),
            );
            const isFlagged = Boolean(flagged[question.question_bank_id]);
            return (
              <button
                key={question.question_bank_id}
                type="button"
                onClick={() => moveToQuestion(index)}
                aria-label={`Questão ${index + 1}${isAnswered ? ", respondida" : ", não respondida"}${isFlagged ? ", marcada" : ""}`}
                aria-current={index === currentIndex ? "step" : undefined}
                className={`relative min-h-10 min-w-10 shrink-0 snap-center rounded-lg border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${index === currentIndex ? "border-[#005bbf] bg-blue-50 text-[#005bbf]" : isAnswered ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300"}`}
              >
                {index + 1}
                {isFlagged && (
                  <Flag
                    className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-500 text-amber-600"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
            Respondida
          </span>
          <span className="inline-flex items-center gap-1">
            <Circle className="h-2.5 w-2.5 text-slate-400" />
            Não respondida
          </span>
          <span className="inline-flex items-center gap-1">
            <Flag className="h-3 w-3 fill-amber-500 text-amber-600" />
            Marcada
          </span>
        </div>
      </nav>
      {reviewing ? (
        <section
          aria-label="Revisão final"
          className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30"
        >
          <h2 className="text-lg font-bold text-blue-950 dark:text-blue-100">
            Revise antes de finalizar
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900">
              <strong className="block text-xl text-emerald-600">
                {answeredCount}
              </strong>
              respondidas
            </div>
            <div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900">
              <strong className="block text-xl text-amber-600">
                {questions.length - answeredCount}
              </strong>
              não respondidas
            </div>
            <div className="rounded-lg bg-white p-3 text-center text-sm dark:bg-slate-900">
              <strong className="block text-xl text-amber-600">
                {flaggedIds.length}
              </strong>
              marcadas
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-800 dark:bg-slate-900 dark:text-blue-200"
            >
              Voltar às questões
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={submit.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submit.isPending ? "Enviando..." : "Finalizar prática"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                {currentSourceReference ? (
                  <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                    {currentSourceReference.url ? (
                      <a
                        href={currentSourceReference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {currentSourceReference.label}
                      </a>
                    ) : currentSourceReference.label}
                  </div>
                ) : null}
                {questionUnavailable ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                  >
                    <p className="font-bold">Questão indisponível nesta tentativa.</p>
                    <p className="mt-1">
                      O conteúdo textual desta questão não está disponível para a revisão atual.
                    </p>
                  </div>
                ) : structuredContent ? (
                  <StructuredText content={structuredContent} signedUrls={signedMedia.urls} />
                ) : currentStatementAssets.map((asset, index) => {
                  const url = directMediaUrl(asset, signedMedia.urls);
                  const assetKey = `${currentQuestion.question_bank_id}:${index}`;
                  return url && !failedStatementAssets[assetKey] ? (
                    <img
                      key={`${asset.storage_path ?? asset.public_url}-${index}`}
                      src={url}
                      onError={() =>
                        setFailedStatementAssets((current) => ({
                          ...current,
                          [assetKey]: true,
                        }))
                      }
                      alt={`Enunciado oficial da questão ${currentIndex + 1}, parte ${index + 1}`}
                      className="h-auto max-h-[70vh] w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                    />
                  ) : null;
                })}
                {!questionUnavailable && (missingStatementAsset || missingOptionAsset) ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                  >
                    <p className="font-bold">Não foi possível carregar o enunciado oficial e todo o conteúdo visual.</p>
                    <p className="mt-1">
                      As alternativas ficam bloqueadas até que o enunciado e as
                      imagens oficiais disponíveis estejam carregados.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFailedStatementAssets((current) => {
                          const next = { ...current };
                          currentStatementAssets.forEach((_, index) => {
                            delete next[`${currentQuestion.question_bank_id}:${index}`];
                          });
                          return next;
                        });
                        setFailedOptionAssets((current) => {
                          const next = { ...current };
                          currentOptions.forEach((option) => option.assets.forEach((_, index) => {
                            delete next[`${currentQuestion.question_bank_id}:${option.label}:${index}`];
                          }));
                          return next;
                        });
                      }}
                      className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 font-bold text-rose-800"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => toggleFlag(currentQuestion.question_bank_id)}
                aria-pressed={Boolean(
                  flagged[currentQuestion.question_bank_id],
                )}
                aria-label={
                  flagged[currentQuestion.question_bank_id]
                    ? "Remover marcação da questão"
                    : "Marcar questão para revisar"
                }
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] ${flagged[currentQuestion.question_bank_id] ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}
              >
                <Flag
                  className="h-4 w-4"
                  fill={
                    flagged[currentQuestion.question_bank_id]
                      ? "currentColor"
                      : "none"
                  }
                />
              </button>
            </div>
            {questionUnavailable ? null : missingStatementAsset || missingOptionAsset ? (
              <p className="mt-5 text-sm font-semibold text-rose-700" role="status">
                {missingStatementAsset
                  ? "Resposta indisponível enquanto o enunciado não carregar."
                  : "Resposta indisponível enquanto as alternativas oficiais não carregarem."}
              </p>
            ) : (
            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">
                Alternativas da questão {currentIndex + 1}
              </legend>
              {currentOptions.map((option, index) => {
                const label = option.label;
                const visibleAssets = option.assets.map((asset, assetIndex) => ({
                  asset,
                  assetIndex,
                  url: directMediaUrl(asset, signedMedia.urls),
                })).filter(({ assetIndex, url }) => url && !failedOptionAssets[`${currentQuestion.question_bank_id}:${label}:${assetIndex}`]);
                const showText = Boolean(option.text?.trim()) && visibleAssets.length === 0;
                return (
                  <label
                    key={`${label}-${option.text ?? index}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition dark:border-slate-700 dark:text-slate-200 ${answers[currentQuestion.question_bank_id] === label ? "border-[#005bbf] bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  >
                    <input
                      className="mt-0.5"
                      type="radio"
                      name={currentQuestion.question_bank_id}
                      value={label}
                      checked={
                        answers[currentQuestion.question_bank_id] === label
                      }
                      onChange={() => answerQuestion(label)}
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="mr-2">{label}.</strong>
                      {showText ? option.text : null}
                      {visibleAssets.map(({ asset, assetIndex, url }) => (
                        <img
                          key={`${asset.storage_path ?? asset.public_url}-${assetIndex}`}
                          src={url ?? undefined}
                          onError={() => setFailedOptionAssets((current) => ({
                            ...current,
                            [`${currentQuestion.question_bank_id}:${label}:${assetIndex}`]: true,
                          }))}
                          alt={`Alternativa oficial ${label} da questão ${currentIndex + 1}`}
                          className="mt-2 h-auto max-h-[45vh] max-w-full rounded-md border border-slate-200 object-contain dark:border-slate-700"
                        />
                      ))}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            )}
          </section>
          <div className="flex items-center justify-between gap-3">
            <div
              className="min-h-5 text-xs text-slate-500"
              role="status"
              aria-live="polite"
            >
              {saveStatus === "saving"
                ? "Salvando resposta..."
                : saveStatus === "saved"
                  ? "Resposta salva."
                  : saveStatus === "error"
                    ? "Não foi possível salvar a resposta."
                    : navigationStatus === "saving"
                      ? "Salvando navegação..."
                      : navigationStatus === "error"
                        ? "Navegação não salva."
                        : ""}
            </div>
            <div className="flex gap-3">
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => moveToQuestion(currentIndex + 1)}
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"
                >
                  Próxima
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReviewing(true)}
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"
                >
                  Revisar e finalizar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
