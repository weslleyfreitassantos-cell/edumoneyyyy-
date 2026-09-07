import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  Search,
  X,
} from 'lucide-react';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  useCreateManyMissingSubjects,
  useCreateSubject,
  useSetSubjectActive,
  useSubjects,
  useUpdateSubject,
} from '../../../hooks/useSubjects';

import {
  subjectSchema,
  subjectUpdateSchema,
} from '../../../schemas/adminSchemas';

import type {
  SubjectBatchInput,
  SubjectRow,
} from '../../../services/subjectService';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';

import {
  BNCC_STAGE_TEMPLATES,
  type BnccStageId,
  type BnccSubjectTemplate,
} from './bnccSubjectTemplates';

interface SubjectDraft {
  name: string;
  code: string;
  workload: string;
  active: boolean;
}

interface BnccSubjectDraft {
  templateId: string;
  name: string;
  code: string;
  selected: boolean;
  defaultSelected: boolean;
  sourceStageIds: BnccStageId[];
}

interface AggregatedBnccTemplate
  extends BnccSubjectTemplate {
  sourceStageIds: BnccStageId[];
}

type BnccDraftState =
  | 'new'
  | 'existing'
  | 'conflict';

interface BnccDraftStatus {
  state: BnccDraftState;
  message: string;
}

const emptyDraft: SubjectDraft = {
  name: '',
  code: '',
  workload: '',
  active: true,
};

function getErrorMessage(
  error: unknown,
): string {
  return getUserFacingErrorMessage(error, 'Não foi possível concluir a operação.');
}

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function normalizeCode(
  value: string,
): string {
  return value.trim().toUpperCase();
}

function collectTemplatesForStages(
  selectedStageIds: Set<BnccStageId>,
): AggregatedBnccTemplate[] {
  const templatesById =
    new Map<string, AggregatedBnccTemplate>();

  for (const stage of BNCC_STAGE_TEMPLATES) {
    if (!selectedStageIds.has(stage.id)) {
      continue;
    }

    for (const subject of stage.subjects) {
      const existing =
        templatesById.get(subject.id);

      if (existing) {
        existing.defaultSelected =
          existing.defaultSelected ||
          subject.defaultSelected;
        existing.sourceStageIds.push(stage.id);
        continue;
      }

      templatesById.set(subject.id, {
        ...subject,
        sourceStageIds: [stage.id],
      });
    }
  }

  return [...templatesById.values()];
}

function buildBnccDrafts(
  selectedStageIds: Set<BnccStageId>,
  currentDrafts: BnccSubjectDraft[],
): BnccSubjectDraft[] {
  const currentById = new Map(
    currentDrafts.map((draft) => [
      draft.templateId,
      draft,
    ]),
  );

  return collectTemplatesForStages(
    selectedStageIds,
  ).map((template) => {
    const current = currentById.get(
      template.id,
    );

    return {
      templateId: template.id,
      name: current?.name ?? template.name,
      code: current?.code ?? template.code,
      selected:
        current?.selected ??
        template.defaultSelected,
      defaultSelected: template.defaultSelected,
      sourceStageIds: template.sourceStageIds,
    };
  });
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
          : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'
      }
    >
      {active ? 'Ativa' : 'Inativa'}
    </span>
  );
}

function toSubjectPayload(
  institutionId: string,
  draft: SubjectDraft,
) {
  return {
    institution_id: institutionId,
    name: draft.name,
    code: draft.code,
    workload:
      draft.workload.trim() === ''
        ? undefined
        : Number(draft.workload),
    active: draft.active,
  };
}

export default function SubjectsTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const subjectsQuery =
    useSubjects(institutionId);

  const createMutation =
    useCreateSubject();

  const createManyMutation =
    useCreateManyMissingSubjects();

  const updateMutation =
    useUpdateSubject();

  const statusMutation =
    useSetSubjectActive();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [
    isBnccModalOpen,
    setIsBnccModalOpen,
  ] = useState(false);

  const [
    editingSubject,
    setEditingSubject,
  ] = useState<SubjectRow | null>(null);

  const [formData, setFormData] =
    useState<SubjectDraft>({
      ...emptyDraft,
    });

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all');

  const [
    modalError,
    setModalError,
  ] = useState<string | null>(null);

  const [
    bnccError,
    setBnccError,
  ] = useState<string | null>(null);

  const [
    pageError,
    setPageError,
  ] = useState<string | null>(null);

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState<string | null>(null);

  const [
    selectedBnccStageIds,
    setSelectedBnccStageIds,
  ] = useState<Set<BnccStageId>>(
    () => new Set<BnccStageId>(),
  );

  const [
    bnccDrafts,
    setBnccDrafts,
  ] = useState<BnccSubjectDraft[]>([]);

  const [
    bnccSearch,
    setBnccSearch,
  ] = useState('');

  const subjects =
    subjectsQuery.data ?? [];

  const existingSubjectLookup = useMemo(() => {
    const names = new Map<string, SubjectRow>();
    const codes = new Map<string, SubjectRow>();

    for (const subject of subjects) {
      names.set(
        normalizeText(subject.name),
        subject,
      );

      if (subject.code) {
        codes.set(
          normalizeCode(subject.code),
          subject,
        );
      }
    }

    return {
      names,
      codes,
    };
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      if (statusFilter === 'active') {
        return subject.active;
      }

      if (statusFilter === 'inactive') {
        return !subject.active;
      }

      return true;
    });
  }, [statusFilter, subjects]);

  const filteredBnccDrafts = useMemo(() => {
    const normalizedSearch =
      normalizeText(bnccSearch);

    if (!normalizedSearch) {
      return bnccDrafts;
    }

    return bnccDrafts.filter((draft) => {
      return (
        normalizeText(draft.name).includes(
          normalizedSearch,
        ) ||
        normalizeText(draft.code).includes(
          normalizedSearch,
        )
      );
    });
  }, [bnccDrafts, bnccSearch]);

  const bnccDraftStatuses = useMemo(() => {
    const statuses = new Map<
      string,
      BnccDraftStatus
    >();

    for (const draft of bnccDrafts) {
      const nameKey = normalizeText(draft.name);
      const codeKey = normalizeCode(draft.code);

      if (!nameKey) {
        statuses.set(draft.templateId, {
          state: 'conflict',
          message: 'Informe o nome.',
        });
        continue;
      }

      const existingByName =
        existingSubjectLookup.names.get(
          nameKey,
        );

      if (existingByName) {
        statuses.set(draft.templateId, {
          state: 'existing',
          message: 'Já existe por nome.',
        });
        continue;
      }

      if (codeKey) {
        const existingByCode =
          existingSubjectLookup.codes.get(
            codeKey,
          );

        if (existingByCode) {
          statuses.set(draft.templateId, {
            state: 'conflict',
            message: `Código já usado por ${existingByCode.name}.`,
          });
          continue;
        }
      }

      statuses.set(draft.templateId, {
        state: 'new',
        message: 'Será criada.',
      });
    }

    return statuses;
  }, [
    bnccDrafts,
    existingSubjectLookup,
  ]);

  const selectedBnccDrafts =
    bnccDrafts.filter((draft) => draft.selected);

  const bnccCreateCount =
    selectedBnccDrafts.filter(
      (draft) =>
        bnccDraftStatuses.get(draft.templateId)
          ?.state === 'new',
    ).length;

  const bnccExistingCount =
    selectedBnccDrafts.filter(
      (draft) =>
        bnccDraftStatuses.get(draft.templateId)
          ?.state === 'existing',
    ).length;

  const bnccConflictCount =
    selectedBnccDrafts.filter(
      (draft) =>
        bnccDraftStatuses.get(draft.templateId)
          ?.state === 'conflict',
    ).length;

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending;

  const isCreatingBncc =
    createManyMutation.isPending;

  const columns: Column<SubjectRow>[] = [
    {
      key: 'name',
      label: 'Disciplina',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.name}
          </p>
          <p className="mt-1 text-xs text-[#727785]">
            {row.code ?? 'Sem código'}
          </p>
        </div>
      ),
    },
    {
      key: 'workload',
      label: 'Carga horária',
      render: (_value, row) =>
        row.workload
          ? `${row.workload}h`
          : '—',
    },
    {
      key: 'active_offerings_count',
      label: 'Ofertas',
    },
    {
      key: 'active',
      label: 'Status',
      render: (_value, row) => (
        <StatusBadge active={row.active} />
      ),
    },
  ];

  function resetMessages(): void {
    setModalError(null);
    setBnccError(null);
    setPageError(null);
    setFeedbackMessage(null);
  }

  function openCreateModal(): void {
    resetMessages();
    setEditingSubject(null);
    setFormData({
      ...emptyDraft,
    });
    setIsModalOpen(true);
  }

  function openBnccModal(): void {
    resetMessages();
    setSelectedBnccStageIds(
      new Set<BnccStageId>(),
    );
    setBnccDrafts([]);
    setBnccSearch('');
    setIsBnccModalOpen(true);
  }

  function openEditModal(
    subject: SubjectRow,
  ): void {
    resetMessages();
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code ?? '',
      workload: subject.workload
        ? String(subject.workload)
        : '',
      active: subject.active,
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setEditingSubject(null);
    setFormData({
      ...emptyDraft,
    });
    setModalError(null);
  }

  function closeBnccModal(): void {
    setIsBnccModalOpen(false);
    setSelectedBnccStageIds(
      new Set<BnccStageId>(),
    );
    setBnccDrafts([]);
    setBnccSearch('');
    setBnccError(null);
  }

  function toggleBnccStage(
    stageId: BnccStageId,
  ): void {
    setSelectedBnccStageIds((current) => {
      const next = new Set<BnccStageId>(
        current,
      );

      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }

      setBnccDrafts((drafts) =>
        buildBnccDrafts(next, drafts),
      );

      return next;
    });
  }

  function updateBnccDraft(
    templateId: string,
    data: Partial<
      Pick<
        BnccSubjectDraft,
        'name' | 'code' | 'selected'
      >
    >,
  ): void {
    setBnccDrafts((current) =>
      current.map((draft) =>
        draft.templateId === templateId
          ? {
              ...draft,
              ...data,
            }
          : draft,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setModalError(null);

    if (!institutionId) {
      setModalError(
        'A instituição não foi carregada.',
      );
      return;
    }

    const payload = toSubjectPayload(
      institutionId,
      formData,
    );

    try {
      if (editingSubject) {
        const result =
          subjectUpdateSchema.safeParse({
            name: payload.name,
            code: payload.code,
            workload: payload.workload,
            active: payload.active,
          });

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await updateMutation.mutateAsync({
          id: editingSubject.id,
          institutionId,
          data: result.data,
        });

        setFeedbackMessage(
          'Disciplina atualizada com sucesso.',
        );
      } else {
        const result =
          subjectSchema.safeParse(payload);

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await createMutation.mutateAsync(
          result.data,
        );

        setFeedbackMessage(
          'Disciplina criada com sucesso.',
        );
      }

      closeModal();
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleCreateBnccSubjects(): Promise<void> {
    setBnccError(null);

    if (!institutionId) {
      setBnccError(
        'A instituição não foi carregada.',
      );
      return;
    }

    if (selectedBnccDrafts.length === 0) {
      setBnccError(
        'Selecione pelo menos uma disciplina.',
      );
      return;
    }

    if (bnccConflictCount > 0) {
      setBnccError(
        'Resolva os conflitos de código antes de salvar.',
      );
      return;
    }

    const payload: SubjectBatchInput[] =
      selectedBnccDrafts.map((draft) => ({
        name: draft.name,
        code: draft.code,
        workload: null,
        active: true,
      }));

    try {
      const result =
        await createManyMutation.mutateAsync({
          institutionId,
          subjects: payload,
        });

      setFeedbackMessage(
        `${result.created.length} disciplinas adicionadas. ${result.skipped.length} disciplinas já existiam e foram ignoradas.`,
      );
      closeBnccModal();
    } catch (error) {
      setBnccError(
        getErrorMessage(error),
      );
    }
  }

  async function handleToggleStatus(
    subject: SubjectRow,
  ): Promise<void> {
    const nextActive = !subject.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    const suffix =
      !nextActive &&
      subject.active_offerings_count > 0
        ? ' O histórico de ofertas será preservado.'
        : '';

    if (
      !window.confirm(
        `Deseja ${action} a disciplina ${subject.name}?${suffix}`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: subject.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Disciplina reativada.'
          : 'Disciplina desativada.',
      );
    } catch (error) {
      setPageError(
        getErrorMessage(error),
      );
    }
  }

  if (institutionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
        Carregando instituição...
      </div>
    );
  }

  if (institutionQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {getErrorMessage(
          institutionQuery.error,
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {feedbackMessage}
        </div>
      )}

      {(pageError || subjectsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              subjectsQuery.error,
            )}
        </div>
      )}

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-4">
        <label
          htmlFor="subject-status-filter"
          className="block text-sm font-medium text-gray-700"
        >
          Status
        </label>
        <select
          id="subject-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className="mt-1 rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">
            Inativas
          </option>
        </select>
      </section>

      <DataTable
        title="Disciplinas"
        addLabel="Nova disciplina"
        data={filteredSubjects}
        columns={columns}
        isLoading={subjectsQuery.isLoading}
        onAdd={openCreateModal}
        extraHeaderActions={
          <button
            type="button"
            onClick={openBnccModal}
            className="rounded-lg border border-[#005bbf] bg-white px-4 py-2 text-sm font-medium text-[#005bbf] transition-colors hover:bg-[#eaf2ff]"
          >
            Adicionar modelo BNCC
          </button>
        }
        emptyMessage="Nenhuma disciplina encontrada para os filtros selecionados."
        renderActions={(subject) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
              subject.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openEditModal(subject)
                }
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>

              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() =>
                  void handleToggleStatus(
                    subject,
                  )
                }
                className={
                  subject.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus
                  ? 'Salvando...'
                  : subject.active
                    ? 'Desativar'
                    : 'Reativar'}
              </button>
            </div>
          );
        }}
      />

      {isBnccModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bncc-modal-title"
          aria-describedby="bncc-modal-description"
        >
          <div className="max-h-[calc(100dvh-48px)] w-full max-w-5xl overflow-y-auto rounded-xl border border-transparent bg-white shadow-xl dark:border-[#334155] dark:bg-[#182235]">
            <div className="flex items-start justify-between gap-3 border-b border-[#dfe3e8] px-5 py-4 dark:border-[#334155]">
              <div>
                <h3
                  id="bncc-modal-title"
                  className="text-lg font-bold text-[#181c20] dark:text-[#f8fafc]"
                >
                  Adicionar modelo curricular
                </h3>

                <p
                  id="bncc-modal-description"
                  className="mt-1 max-w-3xl text-sm text-[#727785] dark:text-[#cbd5e1]"
                >
                  Selecione as etapas atendidas pela escola. Você poderá revisar as disciplinas antes de adicioná-las.
                </p>
              </div>

              <button
                type="button"
                onClick={closeBnccModal}
                disabled={isCreatingBncc}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#667085] outline-none transition hover:bg-[#f3f6fb] focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:opacity-50 dark:text-[#94a3b8] dark:hover:bg-[#243247] dark:hover:text-[#f8fafc]"
                aria-label="Fechar"
              >
                <X
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              {bnccError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                >
                  {bnccError}
                </div>
              )}

              <section>
                <h4 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">
                  Etapas disponíveis
                </h4>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {BNCC_STAGE_TEMPLATES.map(
                    (stage) => (
                      <label
                        key={stage.id}
                        className="flex items-start gap-3 rounded-lg border border-[#dfe3e8] bg-white p-3 text-sm font-medium text-[#414754] transition hover:border-[#005bbf] hover:bg-[#f3f7ff] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#e2e8f0] dark:hover:border-[#60a5fa] dark:hover:bg-[#1e293b]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBnccStageIds.has(
                            stage.id,
                          )}
                          onChange={() =>
                            toggleBnccStage(
                              stage.id,
                            )
                          }
                          disabled={isCreatingBncc}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <span>{stage.label}</span>
                      </label>
                    ),
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#dfe3e8] bg-white p-4 dark:border-[#334155] dark:bg-[#0f172a]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">
                      Disciplinas que serão adicionadas
                    </h4>

                    <p className="mt-1 text-xs text-[#727785] dark:text-[#94a3b8]">
                      {bnccCreateCount} serão criadas · {bnccExistingCount} já existem · {bnccConflictCount} conflitos
                    </p>
                  </div>

                  <div className="w-full lg:max-w-xs">
                    <label
                      htmlFor="bncc-subject-search"
                      className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
                    >
                      Pesquisar disciplinas
                    </label>

                    <div className="relative mt-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#727785] dark:text-[#94a3b8]"
                        aria-hidden="true"
                      />

                      <input
                        id="bncc-subject-search"
                        type="search"
                        value={bnccSearch}
                        onChange={(event) =>
                          setBnccSearch(
                            event.target.value,
                          )
                        }
                        placeholder="Pesquisar por nome ou código"
                        className="w-full rounded-lg border border-[#c5cbd6] bg-white py-2 pl-9 pr-3 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc] dark:placeholder:text-[#64748b]"
                      />
                    </div>
                  </div>
                </div>

                {bnccDrafts.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-[#dfe3e8] px-4 py-8 text-center text-sm text-[#727785] dark:border-[#334155] dark:text-[#94a3b8]">
                    Selecione uma etapa para revisar as disciplinas.
                  </div>
                ) : filteredBnccDrafts.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-[#dfe3e8] px-4 py-8 text-center text-sm text-[#727785] dark:border-[#334155] dark:text-[#94a3b8]">
                    Nenhuma disciplina encontrada para “{bnccSearch.trim()}”.
                  </div>
                ) : (
                  <div className="mt-4 max-h-[360px] overflow-y-auto rounded-lg border border-[#dfe3e8] dark:border-[#334155]">
                    {filteredBnccDrafts.map(
                      (draft) => {
                        const status =
                          bnccDraftStatuses.get(
                            draft.templateId,
                          );

                        return (
                          <div
                            key={draft.templateId}
                            className="grid gap-3 border-b border-[#eef1f5] p-3 last:border-b-0 dark:border-[#334155] md:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.5fr)_minmax(120px,0.4fr)]"
                          >
                            <label className="flex items-center gap-3 text-sm font-medium text-[#181c20] dark:text-[#f8fafc]">
                              <input
                                type="checkbox"
                                checked={draft.selected}
                                disabled={isCreatingBncc}
                                onChange={(event) =>
                                  updateBnccDraft(
                                    draft.templateId,
                                    {
                                      selected:
                                        event.target
                                          .checked,
                                    },
                                  )
                                }
                                aria-label={`Selecionar ${draft.name}`}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <span className="sr-only">
                                Selecionar
                              </span>
                              <input
                                type="text"
                                value={draft.name}
                                disabled={isCreatingBncc}
                                onChange={(event) =>
                                  updateBnccDraft(
                                    draft.templateId,
                                    {
                                      name: event.target
                                        .value,
                                    },
                                  )
                                }
                                aria-label={`Nome da disciplina ${draft.templateId}`}
                                className="min-w-0 flex-1 rounded-lg border border-[#c5cbd6] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc]"
                              />
                            </label>

                            <div>
                              <label className="sr-only">
                                Código da disciplina {draft.name}
                              </label>
                              <input
                                type="text"
                                value={draft.code}
                                disabled={isCreatingBncc}
                                onChange={(event) =>
                                  updateBnccDraft(
                                    draft.templateId,
                                    {
                                      code: normalizeCode(
                                        event.target
                                          .value,
                                      ),
                                    },
                                  )
                                }
                                aria-label={`Código da disciplina ${draft.name}`}
                                className="w-full rounded-lg border border-[#c5cbd6] bg-white px-3 py-2 text-sm font-semibold uppercase text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc]"
                              />
                            </div>

                            <div
                              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                status?.state ===
                                'new'
                                  ? 'bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-200'
                                  : status?.state ===
                                      'existing'
                                    ? 'bg-gray-100 text-gray-600 dark:bg-[#1e293b] dark:text-[#cbd5e1]'
                                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
                              }`}
                            >
                              {status?.message}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </section>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeBnccModal}
                  disabled={isCreatingBncc}
                  className="w-full rounded-lg border border-[#c5cbd6] px-4 py-2 text-sm font-medium text-[#414754] transition hover:bg-[#f3f6fb] disabled:opacity-50 dark:border-[#475569] dark:text-[#e2e8f0] dark:hover:bg-[#243247] sm:w-auto"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleCreateBnccSubjects()
                  }
                  disabled={
                    isCreatingBncc ||
                    selectedBnccDrafts.length === 0 ||
                    bnccConflictCount > 0
                  }
                  className="w-full rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isCreatingBncc
                    ? 'Adicionando...'
                    : 'Adicionar disciplinas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subject-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:border dark:border-[#334155] dark:bg-[#182235]">
            <h3
              id="subject-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20] dark:text-[#f8fafc]"
            >
              {editingSubject
                ? 'Editar disciplina'
                : 'Nova disciplina'}
            </h3>

            <form
              onSubmit={(event) =>
                void handleSubmit(event)
              }
              className="space-y-4"
            >
              {modalError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                >
                  {modalError}
                </div>
              )}

              <div>
                <label
                  htmlFor="subject-name"
                  className="block text-sm font-medium text-gray-700 dark:text-[#cbd5e1]"
                >
                  Nome
                </label>
                <input
                  id="subject-name"
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        name: event.target.value,
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="subject-code"
                  className="block text-sm font-medium text-gray-700 dark:text-[#cbd5e1]"
                >
                  Código
                </label>
                <input
                  id="subject-code"
                  type="text"
                  value={formData.code}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        code: event.target.value,
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 uppercase dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc]"
                />
              </div>

              <div>
                <label
                  htmlFor="subject-workload"
                  className="block text-sm font-medium text-gray-700 dark:text-[#cbd5e1]"
                >
                  Carga horária
                </label>
                <input
                  id="subject-workload"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.workload}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        workload:
                          event.target.value,
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-[#475569] dark:bg-[#111827] dark:text-[#f8fafc]"
                />
                <p className="mt-1 text-xs text-[#727785] dark:text-[#94a3b8]">
                  A carga horária poderá ser definida posteriormente na matriz curricular da turma.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#cbd5e1]">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      active:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Ativa
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-[#475569] dark:text-[#cbd5e1] dark:hover:bg-[#243247]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
