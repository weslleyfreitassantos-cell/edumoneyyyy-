import type {
  V3StudentPlan,
  V3TeacherHeatmapRow,
  V3KnowledgeGraphSkill,
} from '../../services/adaptiveLearningService';

interface TeacherKnowledgeGraphPanelProps {
  skills?: V3KnowledgeGraphSkill[];
  isLoading?: boolean;
  isError?: boolean;
}

interface TeacherKnowledgeHeatmapProps {
  rows?: V3TeacherHeatmapRow[];
  isLoading?: boolean;
  isError?: boolean;
}

interface StudentAdaptiveBridgeCardProps {
  plan?: V3StudentPlan | null;
  isLoading?: boolean;
}

function stateLabel(state: string): string {
  if (state === 'MASTERED') return 'Dominado';
  if (state === 'PRACTICING' || state === 'IN_PROGRESS') return 'Em prática';
  if (state === 'NEEDS_REVIEW') return 'Precisa revisar';
  return 'Não iniciado';
}

function misconceptionLabel(code: string): string {
  const labels: Record<string, string> = {
    PERCENT_BASE_CONFUSION: 'Confunde a base usada no cálculo percentual',
    WHOLE_VALUE_CONFUSION: 'Confunde o valor total com a parte percentual',
    DISTANCE_TIME_INVERSION: 'Inverte distância e tempo',
    UNSUPPORTED_INFERENCE: 'Conclui além das pistas do texto',
    UNIT_CONVERSION_ERROR: 'Mistura unidades antes de calcular',
  };
  if (labels[code]) return labels[code];
  return code
    .replace(/_/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function percent(value: number): number {
  const normalized = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

function PanelState({
  children,
  tone = 'slate',
}: {
  children: string;
  tone?: 'slate' | 'red';
}) {
  return (
    <p className={tone === 'red' ? 'mt-4 text-sm text-red-700 dark:text-red-300' : 'mt-4 text-sm text-slate-500'}>
      {children}
    </p>
  );
}

export function TeacherKnowledgeGraphPanel({
  skills = [],
  isLoading = false,
  isError = false,
}: TeacherKnowledgeGraphPanelProps) {
  return (
    <section aria-label="Mapa de aprendizagem" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h2 className="font-bold dark:text-white">Mapa de aprendizagem</h2>
        <p className="mt-1 text-sm text-slate-500">Acompanhe estado, evidências e sinais confirmados por habilidade.</p>
      </div>
      {isLoading ? <PanelState>Carregando mapa de aprendizagem...</PanelState> : null}
      {isError ? <PanelState tone="red">Não foi possível carregar o mapa de aprendizagem.</PanelState> : null}
      {!isLoading && !isError && skills.length === 0 ? <PanelState>Ainda não há evidências mapeadas para este aluno.</PanelState> : null}
      {!isLoading && !isError && skills.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {skills.map((skill) => (
            <article key={`${skill.subjectCode}-${skill.skillCode}`} className="rounded-lg border p-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">{skill.subjectName}</p>
                  <h3 className="mt-1 font-semibold dark:text-white">{skill.skillTitle}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{stateLabel(skill.state)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>Domínio: <strong>{percent(skill.mastery)}%</strong></span>
                <span>Confiança: <strong>{percent(skill.confidence)}%</strong></span>
                <span>{skill.evidenceCount} evidência(s)</span>
                <span>{skill.strongEvidenceCount} forte(s)</span>
              </div>
              {skill.confirmedMisconceptions.length > 0 ? (
                <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                  Sinais confirmados: {skill.confirmedMisconceptions.map((item) => misconceptionLabel(item.code)).join(', ')}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TeacherKnowledgeHeatmap({
  rows = [],
  isLoading = false,
  isError = false,
}: TeacherKnowledgeHeatmapProps) {
  return (
    <section aria-label="Mapa de aprendizagem da turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h2 className="font-bold dark:text-white">Mapa da turma</h2>
        <p className="mt-1 text-sm text-slate-500">Veja a distribuição por habilidade sem ranking entre alunos.</p>
      </div>
      {isLoading ? <PanelState>Carregando mapa da turma...</PanelState> : null}
      {isError ? <PanelState tone="red">Não foi possível carregar o mapa da turma.</PanelState> : null}
      {!isLoading && !isError && rows.length === 0 ? <PanelState>Escolha uma turma com evidências para visualizar o mapa.</PanelState> : null}
      {!isLoading && !isError && rows.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={`${row.subjectCode}-${row.skillCode}`} className="rounded-lg border p-4 dark:border-slate-700">
              <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">{row.subjectCode}</p>
              <h3 className="mt-1 font-semibold dark:text-white">{row.skillCode}</h3>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Dominado {row.masteredCount}</span>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Em prática {row.practicingCount}</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Precisa revisar {row.needsReviewCount}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Não iniciado {row.unknownCount}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function StudentAdaptiveBridgeCard({
  plan,
  isLoading = false,
}: StudentAdaptiveBridgeCardProps) {
  if (!isLoading && !plan) return null;

  let message = 'Você está no caminho certo. Continue no objetivo atual.';
  if (isLoading) message = 'Preparando seu próximo passo...';
  else if (plan?.decision === 'CROSS_SUBJECT_BRIDGE' || plan?.reasonCode === 'PREREQUISITE_CONFIRMED_GAP') {
    message = 'Vamos reforçar um ponto importante antes de continuar. Depois, voltamos ao seu objetivo.';
  } else if (plan?.decision === 'DIAGNOSTIC_NEEDED') {
    message = 'Vamos fazer uma atividade curta para descobrir por onde continuar.';
  }

  return (
    <section aria-label="Orientação de aprendizagem" className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-5">
      <h2 className="font-bold text-blue-950 dark:text-blue-100">Seu próximo passo</h2>
      <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">{message}</p>
    </section>
  );
}
