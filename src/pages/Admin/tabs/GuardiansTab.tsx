import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import {
  ListPagination,
  ListSearch,
  normalizeListSearch,
} from '../../../components/ListControls';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  useCreateGuardian,
  useGuardians,
  useSetGuardianshipActive,
} from '../../../hooks/useGuardians';

import { useStudents } from '../../../hooks/useStudents';

import { guardianSchema } from '../../../schemas/adminSchemas';

import type {
  GuardianRow,
  GuardianStudentLink,
} from '../../../services/guardianService';

interface LinkDraft {
  student_id: string;
  relationship: string;
  is_primary: boolean;
}

interface GuardianDraft {
  full_name: string;
  email: string;
  student_links: LinkDraft[];
}

const emptyLinkDraft: LinkDraft = {
  student_id: '',
  relationship: '',
  is_primary: false,
};

const emptyDraft: GuardianDraft = {
  full_name: '',
  email: '',
  student_links: [{ ...emptyLinkDraft }],
};

const GUARDIANS_PAGE_SIZE = 6;

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

function getStudentLabel(
  link: GuardianStudentLink,
): string {
  return `${link.student_name} (${link.registration_number})`;
}

export default function GuardiansTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const guardiansQuery =
    useGuardians(institutionId);

  const studentsQuery =
    useStudents(institutionId);

  const createMutation =
    useCreateGuardian();

  const statusMutation =
    useSetGuardianshipActive();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] =
    useState<GuardianDraft>({
      ...emptyDraft,
      student_links: [{ ...emptyLinkDraft }],
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

  const guardians = guardiansQuery.data ?? [];
  const filteredGuardians = guardians.filter((guardian) => {
    const query = normalizeListSearch(searchTerm);

    if (!query) {
      return true;
    }

    return normalizeListSearch([
      guardian.full_name,
      guardian.email,
      ...guardian.links.flatMap((link) => [
        link.student_name,
        link.registration_number,
        link.relationship,
      ]),
    ].filter(Boolean).join(' ')).includes(query);
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGuardians.length / GUARDIANS_PAGE_SIZE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedGuardians = filteredGuardians.slice(
    (currentPage - 1) * GUARDIANS_PAGE_SIZE,
    currentPage * GUARDIANS_PAGE_SIZE,
  );

  const columns: Column<GuardianRow>[] = [
    {
      key: 'full_name',
      label: 'Responsável',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.full_name}
          </p>
          <p className="mt-1 break-all text-xs text-[#727785]">
            {row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'links',
      label: 'Alunos vinculados',
      render: (_value, row) => (
        <div className="space-y-2">
          {row.links.map((link) => {
            const isChanging =
              statusMutation.isPending &&
              statusMutation.variables?.id ===
                link.id;

            return (
              <div
                key={link.id}
                className="rounded-lg border border-[#dfe3e8] px-3 py-2"
              >
                <p className="text-sm font-semibold text-[#181c20]">
                  {getStudentLabel(link)}
                </p>
                <p className="mt-1 text-xs text-[#727785]">
                  {link.relationship}
                  {link.is_primary
                    ? ' • Responsável principal'
                    : ''}
                </p>
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    void handleToggleLink(link)
                  }
                  className={
                    link.active
                      ? 'mt-2 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                      : 'mt-2 text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                  }
                >
                  {isChanging
                    ? 'Salvando...'
                    : link.active
                      ? 'Desativar vínculo'
                      : 'Reativar vínculo'}
                </button>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'active_links_count',
      label: 'Vínculos ativos',
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
      student_links: [{ ...emptyLinkDraft }],
    });
    setIsModalOpen(true);
  }

  function openAddLinkModal(
    guardian: GuardianRow,
  ): void {
    resetMessages();
    setFormData({
      full_name: guardian.full_name,
      email: guardian.email,
      student_links: [{ ...emptyLinkDraft }],
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setFormData({
      ...emptyDraft,
      student_links: [{ ...emptyLinkDraft }],
    });
    setModalError(null);
  }

  function updateLinkDraft(
    index: number,
    patch: Partial<LinkDraft>,
  ): void {
    setFormData((current) => ({
      ...current,
      student_links:
        current.student_links.map(
          (link, currentIndex) =>
            currentIndex === index
              ? { ...link, ...patch }
              : link,
        ),
    }));
  }

  function addLinkDraft(): void {
    setFormData((current) => ({
      ...current,
      student_links: [
        ...current.student_links,
        { ...emptyLinkDraft },
      ],
    }));
  }

  function removeLinkDraft(index: number): void {
    setFormData((current) => ({
      ...current,
      student_links:
        current.student_links.length === 1
          ? current.student_links
          : current.student_links.filter(
              (_link, currentIndex) =>
                currentIndex !== index,
            ),
    }));
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

    const result = guardianSchema.safeParse({
      institution_id: institutionId,
      full_name: formData.full_name,
      email: formData.email,
      student_links: formData.student_links,
    });

    if (!result.success) {
      setModalError(
        result.error.issues[0]?.message ??
          'Dados inválidos.',
      );
      return;
    }

    try {
      const createdGuardian =
        await createMutation.mutateAsync(
          result.data,
        );

      closeModal();

      setFeedbackMessage(
        `Responsável ${createdGuardian.full_name} salvo com sucesso.`,
      );
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleToggleLink(
    link: GuardianStudentLink,
  ): Promise<void> {
    const nextActive = !link.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    if (
      !window.confirm(
        `Deseja ${action} o vínculo com ${getStudentLabel(link)}?`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: link.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Vínculo reativado.'
          : 'Vínculo desativado.',
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
        guardiansQuery.isError ||
        studentsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              guardiansQuery.error ??
                studentsQuery.error,
            )}
        </div>
      )}

      <ListSearch
        id="guardians-search"
        label="Buscar responsável"
        placeholder="Nome, e-mail ou aluno vinculado"
        value={searchTerm}
        onChange={setSearchTerm}
      />

      <DataTable
        title="Responsáveis"
        addLabel="Novo responsável"
        data={paginatedGuardians}
        columns={columns}
        isLoading={
          guardiansQuery.isLoading ||
          studentsQuery.isLoading
        }
        onAdd={openCreateModal}
        emptyMessage={
          filteredGuardians.length === 0 && guardians.length > 0
            ? 'Nenhum responsável encontrado.'
            : 'Nenhum responsável vinculado aos alunos desta instituição.'
        }
        renderActions={(guardian) => (
          <button
            type="button"
            onClick={() =>
              openAddLinkModal(guardian)
            }
            className="font-medium text-[#005bbf] hover:text-[#1a73e8]"
          >
            Adicionar vínculo
          </button>
        )}
      />

      <ListPagination
        page={currentPage}
        pageSize={GUARDIANS_PAGE_SIZE}
        totalItems={filteredGuardians.length}
        onPageChange={setCurrentPage}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guardian-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="guardian-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              Responsável
            </h3>

            <form
              onSubmit={(event) =>
                void handleSubmit(event)
              }
              className="space-y-5"
            >
              {modalError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {modalError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="guardian-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Nome completo
                  </label>
                  <input
                    id="guardian-name"
                    type="text"
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
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    autoComplete="name"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="guardian-email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    E-mail
                  </label>
                  <input
                    id="guardian-email"
                    type="email"
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
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-[#181c20]">
                    Alunos vinculados
                  </h4>

                  <button
                    type="button"
                    onClick={addLinkDraft}
                    className="rounded-lg border px-3 py-2 text-xs font-medium text-[#005bbf] hover:bg-blue-50"
                  >
                    Adicionar aluno
                  </button>
                </div>

                {formData.student_links.map(
                  (link, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-[#dfe3e8] p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`guardian-student-${index}`}
                            className="block text-sm font-medium text-gray-700"
                          >
                            Aluno
                          </label>
                          <select
                            id={`guardian-student-${index}`}
                            value={link.student_id}
                            onChange={(event) =>
                              updateLinkDraft(
                                index,
                                {
                                  student_id:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            required
                          >
                            <option value="">
                              Selecione
                            </option>
                            {(studentsQuery.data ?? [])
                              .filter(
                                (student) =>
                                  student.active,
                              )
                              .map((student) => (
                                <option
                                  key={student.id}
                                  value={student.id}
                                >
                                  {student.profiles
                                    ?.full_name ??
                                    student.registration_number}{' '}
                                  ({student.registration_number})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`guardian-relationship-${index}`}
                            className="block text-sm font-medium text-gray-700"
                          >
                            Parentesco
                          </label>
                          <input
                            id={`guardian-relationship-${index}`}
                            type="text"
                            value={link.relationship}
                            onChange={(event) =>
                              updateLinkDraft(
                                index,
                                {
                                  relationship:
                                    event.target
                                      .value,
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={link.is_primary}
                            onChange={(event) =>
                              updateLinkDraft(
                                index,
                                {
                                  is_primary:
                                    event.target
                                      .checked,
                                },
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          Responsável principal
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            removeLinkDraft(index)
                          }
                          disabled={
                            formData.student_links
                              .length === 1
                          }
                          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remover linha
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={createMutation.isPending}
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar e enviar acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
