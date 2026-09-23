import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LoaderCircle,
  Send,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useTeacherAttendanceOfferings } from '../hooks/useAttendance';
import { useSchoolSetupReadiness } from '../hooks/useSchoolSetupReadiness';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import { getLocalDateInputValue } from '../lib/academicTermDates';
import {
  buildSchoolSetupFlow,
  type SchoolSetupFlowStep,
} from '../lib/schoolSetupFlow';
import {
  getAssistantFeatures,
  recordAssistantUsage,
  type AssistantFeature,
  type AssistantAvailability,
  type AssistantMenuItem,
} from '../services/featureRegistry';
import type { UserRole } from '../types';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

type OpenAssistantRoute = (label: string, route: string) => void;

function AssistantContextAction({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition hover:border-[#005bbf] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
    >
      <span className="mt-0.5 shrink-0 text-[#005bbf] dark:text-blue-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-bold text-slate-800 dark:text-slate-100">
          {label}
        </strong>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ArrowRight
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
        aria-hidden="true"
      />
    </button>
  );
}

function AssistantSchoolSetupContext({
  institutionId,
  canEditAcademic,
  onOpen,
}: {
  institutionId: string;
  canEditAcademic: boolean;
  onOpen: OpenAssistantRoute;
}) {
  const readinessQuery = useSchoolSetupReadiness(institutionId);

  if (readinessQuery.isLoading) {
    return (
      <section
        aria-label="Orientação da configuração da escola"
        role="status"
        className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Lendo a configuração da escola...
        </div>
        <div className="h-3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </section>
    );
  }

  if (readinessQuery.isError || !readinessQuery.data) {
    return (
      <section
        aria-label="Orientação da configuração da escola"
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        Não foi possível ler a configuração agora. Abra a Visão geral para revisar as etapas.
      </section>
    );
  }

  const flow = buildSchoolSetupFlow(readinessQuery.data, {
    canEditAcademic,
    includeFoundation: true,
  });
  const steps = flow.sections.flatMap((section) => section.steps);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const timetableStep = stepById.get('timetable');
  const missingTimetableDependencies = (timetableStep?.dependencies ?? [])
    .map((dependency) => stepById.get(dependency))
    .filter(
      (step): step is SchoolSetupFlowStep =>
        Boolean(step) && step.status !== 'COMPLETED',
    );
  const nextStep = flow.recommendedNextStep;
  const timetableBlocked =
    !timetableStep ||
    timetableStep?.status === 'BLOCKED' ||
    missingTimetableDependencies.length > 0;
  const timetableCompleted = timetableStep?.status === 'COMPLETED';

  return (
    <section
      aria-label="Orientação da configuração da escola"
      className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30"
    >
      <div className="flex items-start gap-2">
        <GraduationCap
          className="mt-0.5 h-4 w-4 shrink-0 text-[#005bbf] dark:text-blue-300"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-blue-950 dark:text-blue-100">
            Configuração da escola
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
            O Assistente acompanha as dependências e aponta o próximo módulo certo.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-slate-950">
        <div className="flex items-start gap-2">
          {nextStep ? (
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#005bbf]" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {nextStep ? `Próximo passo: ${nextStep.label}` : 'Configuração principal concluída'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {nextStep?.reason ??
                (flow.operationalReady
                  ? 'A escola está pronta para operar.'
                  : 'Revise as etapas pendentes da configuração.')}
            </p>
            {nextStep && (
              <button
                type="button"
                onClick={() => onOpen(nextStep.label, nextStep.href)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#005bbf] hover:underline dark:text-blue-300"
              >
                {nextStep.actionLabel}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border p-3 ${
          timetableBlocked
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
        }`}
      >
        <div className="flex items-start gap-2">
          {timetableBlocked ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {timetableBlocked
                ? 'O que está bloqueando a grade'
                : timetableCompleted
                  ? 'Grade de horário liberada'
                  : 'Grade de horário pronta para configuração'}
            </p>
            {timetableBlocked ? (
              <>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Faltam estas dependências para gerar e publicar a grade:
                </p>
                <ul className="mt-2 space-y-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                  {missingTimetableDependencies.length > 0 ? (
                    missingTimetableDependencies.map((step) => (
                      <li key={step.id}>• {step.label}</li>
                    ))
                  ) : (
                    <li>• {timetableStep?.reason ?? 'Revise a configuração acadêmica.'}</li>
                  )}
                </ul>
              </>
            ) : timetableCompleted ? (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                As dependências acadêmicas necessárias já estão concluídas.
              </p>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                As dependências estão concluídas. Use o próximo passo acima para abrir o módulo da grade.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AssistantTeacherContext({
  profileId,
  institutionId,
  onOpen,
}: {
  profileId: string;
  institutionId: string;
  onOpen: OpenAssistantRoute;
}) {
  const today = getLocalDateInputValue();
  const dashboardQuery = useTeacherDashboard(profileId, institutionId);
  const todayQuery = useTeacherAttendanceOfferings(
    profileId,
    institutionId,
    today,
  );
  const offerings = dashboardQuery.data?.offerings ?? [];
  const todayLessons = todayQuery.data?.reduce(
    (total, offering) => total + (offering.scheduleSlots?.length ?? 0),
    0,
  );
  const sampleOfferings = offerings.slice(0, 4);

  return (
    <section
      aria-label="Resumo do professor"
      className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"
    >
      <div className="flex items-start gap-2">
        <ClipboardCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-emerald-950 dark:text-emerald-100">
            Seu contexto pedagógico
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
            Atalhos e informações das suas turmas, disciplinas e registros.
          </p>
        </div>
      </div>

      {dashboardQuery.isLoading || todayQuery.isLoading ? (
        <div role="status" className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando suas aulas e atribuições...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-emerald-200 bg-white p-2 dark:border-emerald-900 dark:bg-slate-950">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                {todayLessons ?? '—'}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">aulas hoje</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-2 dark:border-emerald-900 dark:bg-slate-950">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                {dashboardQuery.data?.totals.classes ?? '—'}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">turmas</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-2 dark:border-emerald-900 dark:bg-slate-950">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                {dashboardQuery.data?.totals.subjects ?? '—'}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">disciplinas</p>
            </div>
          </div>

          {dashboardQuery.isError && (
            <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300">
              Não foi possível carregar o resumo das atribuições. Os atalhos continuam disponíveis.
            </p>
          )}

          {sampleOfferings.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-white p-2.5 dark:border-emerald-900 dark:bg-slate-950">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Turmas e disciplinas</p>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {sampleOfferings.map((offering) => (
                  <li key={offering.id}>
                    {offering.subjectName} <span aria-hidden="true">•</span> {offering.className}
                  </li>
                ))}
              </ul>
              {offerings.length > sampleOfferings.length && (
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  +{offerings.length - sampleOfferings.length} atribuição(ões)
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <AssistantContextAction
              icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
              label="Ver aulas do dia"
              description={
                todayQuery.isError
                  ? 'Não foi possível verificar a grade de hoje. Abra a tela para conferir.'
                  : todayLessons === 0
                  ? 'Nenhuma aula foi encontrada na grade de hoje.'
                  : `${todayLessons} aula(s) encontrada(s) na sua grade de hoje.`
              }
              onClick={() => onOpen('Aulas do dia', '/dashboard/timetable')}
            />
            <AssistantContextAction
              icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
              label="Ver chamadas pendentes"
              description="Abra o Diário de Classe para conferir os registros que ainda precisam de atenção."
              onClick={() => onOpen('Chamadas pendentes', '/dashboard/class-diary')}
            />
            <AssistantContextAction
              icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
              label="Abrir Diário de Classe"
              description="Registre conteúdo, atividade, tarefa, observações e frequência."
              onClick={() => onOpen('Diário de Classe', '/dashboard/class-diary')}
            />
            <AssistantContextAction
              icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
              label="Abrir contribuições pedagógicas"
              description="Consulte conselhos de classe e registre suas contribuições."
              onClick={() => onOpen('Contribuições pedagógicas', '/dashboard/class-councils')}
            />
          </div>
        </>
      )}
    </section>
  );
}

export default function AssistantTec({
  role,
  institutionId,
  profileId,
  platformRole,
  membershipRole,
  profileRole,
  menuItems = [],
}: {
  role: UserRole;
  institutionId: string | null;
  profileId?: string | null;
  platformRole?: AssistantAvailability['platformRole'];
  membershipRole?: AssistantAvailability['membershipRole'];
  profileRole?: AssistantAvailability['profileRole'];
  menuItems?: readonly AssistantMenuItem[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Olá! O que você deseja fazer?',
  );
  const [selected, setSelected] =
    useState<AssistantFeature | null>(null);
  const [voiceEnabled, setVoiceEnabled] =
    useState(false);
  const features = getAssistantFeatures(role, {
    platformRole,
    membershipRole,
    profileRole,
  }, menuItems);

  const results = useMemo(() => {
    const terms = normalize(question)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!terms.length) {
      return [];
    }

    return features
      .map((item) => {
        const haystack = normalize(
          `${item.label} ${item.description} ${item.id} ${item.keywords.join(' ')}`,
        );
        const score = terms.reduce(
          (total, term) =>
            total + (haystack.includes(term) ? 1 : 0),
          0,
        );

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .map(({ item }) => item);
  }, [features, question]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function speak(text: string): void {
    if (
      !voiceEnabled ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function go(item: AssistantFeature): void {
    recordAssistantUsage(item.id, institutionId);
    setSelected(item);
    const text = `Encontrei ${item.label}. Vou abrir essa tela para você.`;
    setAnswer(text);
    speak(text);
    navigate(item.route);
    setQuestion('');
  }

  function openContextRoute(label: string, route: string): void {
    const text = `Encontrei ${label}. Vou abrir essa tela para você.`;
    setAnswer(text);
    speak(text);
    navigate(route);
    setQuestion('');
  }

  function ask(): void {
    const best = results[0];

    if (!question.trim()) {
      return;
    }

    if (best) {
      go(best);
      return;
    }

    const text =
      'Ainda não encontrei essa área para o seu perfil. Tente escrever o nome da tela ou do recurso.';
    setAnswer(text);
    speak(text);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente TEC"
        data-print-hide
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#005bbf] text-white shadow-lg transition hover:bg-[#004a9c] sm:bottom-5 sm:right-5"
        title="Assistente TEC"
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Assistente TEC"
          data-print-hide
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[calc(100dvh-7rem)] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:inset-x-auto sm:right-5 sm:max-h-[min(680px,calc(100dvh-7rem))] sm:w-[min(420px,calc(100vw-2.5rem))]"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 bg-[#005bbf] px-4 py-3 text-white">
            <div className="min-w-0">
              <strong className="block truncate">
                Assistente TEC
              </strong>
              <p className="mt-0.5 text-xs text-blue-100">
                Encontre recursos disponíveis para seu perfil.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 space-y-4 overflow-y-auto p-3 sm:p-4">
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
              <Bot
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <span>{answer}</span>
            </div>

            {open &&
              profileId &&
              institutionId &&
              role === 'teacher' && (
                <AssistantTeacherContext
                  profileId={profileId}
                  institutionId={institutionId}
                  onOpen={openContextRoute}
                />
              )}

            {open &&
              institutionId &&
              (role === 'super_admin' ||
                role === 'admin' ||
                role === 'director' ||
                role === 'secretary') && (
                <AssistantSchoolSetupContext
                  institutionId={institutionId}
                  canEditAcademic={role !== 'admin'}
                  onOpen={openContextRoute}
                />
              )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask();
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950"
            >
              <input
                autoFocus
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                placeholder="Digite o que você quer fazer..."
                aria-label="Pergunte ao Assistente TEC"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <button
                type="submit"
                aria-label="Enviar pergunta"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#005bbf] hover:bg-blue-50 dark:hover:bg-slate-800"
                title="Enviar"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <span className="text-xs leading-relaxed text-slate-400">
                Ex.: grade, materiais, avisos, chamadas ou notas.
              </span>
              <button
                type="button"
                onClick={() =>
                  setVoiceEnabled((value) => !value)
                }
                aria-label={
                  voiceEnabled
                    ? 'Desativar áudio'
                    : 'Ativar áudio'
                }
                title={
                  voiceEnabled
                    ? 'Desativar áudio'
                    : 'Ativar áudio'
                }
                className="inline-flex shrink-0 items-center gap-1 self-end text-xs font-semibold text-slate-600 dark:text-slate-300 sm:self-start"
              >
                {voiceEnabled ? (
                  <Volume2
                    className="h-4 w-4 text-[#005bbf]"
                    aria-hidden="true"
                  />
                ) : (
                  <VolumeX
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                Áudio
              </button>
            </div>

            {question.trim() && (
              <div className="space-y-2">
                {results.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-[#005bbf] hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-800 dark:text-slate-100">
                        {item.label}
                      </strong>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                    <Send
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#005bbf]"
                      aria-hidden="true"
                    />
                  </button>
                ))}

                {results.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Não encontrei um recurso correspondente para seu perfil.
                  </p>
                )}
              </div>
            )}

            {selected && (
              <p className="break-words text-right text-[11px] text-slate-400">
                Aberto agora: {selected.label} - {location.pathname}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
