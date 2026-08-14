import {
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
  useCreateTeacher,
  useSetTeacherActive,
  useTeachers,
} from '../../../hooks/useTeachers';

import { teacherSchema } from '../../../schemas/adminSchemas';

import type { TeacherRow } from '../../../services/teacherService';

interface TeacherDraft {
  full_name: string;
  email: string;
}

const emptyDraft: TeacherDraft = {
  full_name: '',
  email: '',
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

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
    },
  ).format(date);
}

function getTeacherName(
  teacher: TeacherRow,
): string {
  return (
    teacher.profiles?.full_name ??
    teacher.profiles?.email ??
    'Professor'
  );
}

export default function TeachersTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const teachersQuery =
    useTeachers(institutionId);

  const createMutation =
    useCreateTeacher();

  const statusMutation =
    useSetTeacherActive();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [formData, setFormData] =
    useState<TeacherDraft>({
      ...emptyDraft,
    });

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

  const columns: Column<TeacherRow>[] = [
    {
      id: 'teacher-name',
      key: 'profile_id',
      label: 'Nome',
      render: (_value, row) =>
        row.profiles?.full_name ??
        'Perfil indisponível',
    },
    {
      id: 'teacher-email',
      key: 'profile_id',
      label: 'E-mail',
      render: (_value, row) =>
        row.profiles?.email ?? '—',
    },
    {
      key: 'joined_at',
      label: 'Vinculado em',
      render: (value) =>
        formatDate(
          typeof value === 'string'
            ? value
            : undefined,
        ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (_value, row) => (
        <span
          className={
            row.active
              ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
              : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'
          }
        >
          {row.active
            ? 'Ativo'
            : 'Inativo'}
        </span>
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
    setFormData({
      ...emptyDraft,
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
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

    const result =
      teacherSchema.safeParse({
        institution_id: institutionId,
        full_name: formData.full_name,
        email: formData.email,
      });

    if (!result.success) {
      setModalError(
        result.error.issues[0]
          ?.message ??
        'Dados inválidos.',
      );
      return;
    }

    try {
      const createdTeacher =
        await createMutation.mutateAsync(
          result.data,
        );

      closeModal();

      setFeedbackMessage(
        `Professor ${createdTeacher.full_name} cadastrado com sucesso. As credenciais foram enviadas para ${createdTeacher.email}.`,
      );
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleToggleStatus(
    teacher: TeacherRow,
  ): Promise<void> {
    const nextActive = !teacher.active;

    const action = nextActive
      ? 'reativar'
      : 'desativar';

    const confirmed = window.confirm(
      `Deseja ${action} o professor ${getTeacherName(teacher)} nesta instituição?`,
    );

    if (!confirmed) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: teacher.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Professor reativado com sucesso.'
          : 'Professor desativado nesta instituição.',
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

      {(pageError ||
        teachersQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              teachersQuery.error,
            )}
        </div>
      )}

      <DataTable
        title="Professores"
        addLabel="Novo professor"
        data={teachersQuery.data ?? []}
        columns={columns}
        isLoading={teachersQuery.isLoading}
        onAdd={openCreateModal}
        emptyMessage="Nenhum professor cadastrado nesta instituição."
        renderActions={(teacher) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
              teacher.id;

          return (
            <button
              type="button"
              onClick={() =>
                void handleToggleStatus(
                  teacher,
                )
              }
              disabled={isChangingStatus}
              className={
                teacher.active
                  ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                  : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
              }
            >
              {isChangingStatus
                ? 'Salvando...'
                : teacher.active
                  ? 'Desativar'
                  : 'Reativar'}
            </button>
          );
        }}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="teacher-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              Novo professor
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
                  htmlFor="teacher-full-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nome completo
                </label>

                <input
                  id="teacher-full-name"
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={formData.full_name}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        full_name:
                          event.target.value,
                      }),
                    )
                  }
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="teacher-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  E-mail
                </label>

                <input
                  id="teacher-email"
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        email:
                          event.target.value,
                      }),
                    )
                  }
                  autoComplete="email"
                  required
                />
              </div>

              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                O usuário e o vínculo como professor serão criados automaticamente. O professor receberá um convite por e-mail para definir a senha.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={
                    createMutation.isPending
                  }
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    createMutation.isPending
                  }
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? 'Cadastrando...'
                    : 'Cadastrar e enviar convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
