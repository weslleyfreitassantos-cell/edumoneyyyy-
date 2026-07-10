import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  useCreateSubject,
  useSetSubjectActive,
  useSubjects,
  useUpdateSubject,
} from '../../../hooks/useSubjects';

import {
  subjectSchema,
  subjectUpdateSchema,
} from '../../../schemas/adminSchemas';

import type { SubjectRow } from '../../../services/subjectService';

interface SubjectDraft {
  name: string;
  code: string;
  workload: string;
  active: boolean;
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
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Não foi possível concluir a operação.';
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

  const updateMutation =
    useUpdateSubject();

  const statusMutation =
    useSetSubjectActive();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

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
    pageError,
    setPageError,
  ] = useState<string | null>(null);

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState<string | null>(null);

  const filteredSubjects = useMemo(() => {
    const subjects = subjectsQuery.data ?? [];

    return subjects.filter((subject) => {
      if (statusFilter === 'active') {
        return subject.active;
      }

      if (statusFilter === 'inactive') {
        return !subject.active;
      }

      return true;
    });
  }, [statusFilter, subjectsQuery.data]);

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending;

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

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subject-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="subject-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
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
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {modalError}
                </div>
              )}

              <div>
                <label
                  htmlFor="subject-name"
                  className="block text-sm font-medium text-gray-700"
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
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="subject-code"
                  className="block text-sm font-medium text-gray-700"
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
                  className="mt-1 w-full rounded-lg border px-3 py-2 uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="subject-workload"
                  className="block text-sm font-medium text-gray-700"
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
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
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
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
