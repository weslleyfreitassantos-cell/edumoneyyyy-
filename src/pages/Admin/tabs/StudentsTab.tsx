import {
  useState,
  type FormEvent,
} from 'react';

import { useAuth } from '../../../contexts/AuthContext';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import { useManageSchoolUser } from '../../../hooks/useSchoolUserManagement';

import {
  useCreateStudent,
  useSetStudentActive,
  useStudents,
  useUpdateStudent,
} from '../../../hooks/useStudents';

import {
  guardianLinkSchema,
  studentSchema,
  studentUpdateSchema,
} from '../../../schemas/adminSchemas';

import type { StudentRow } from '../../../services/studentService';

interface StudentDraft {
  full_name: string;
  email: string;
  birth_date: string;
  cpf: string;
}

interface GuardianLinkDraft {
  guardian_profile_id: string;
  relationship: string;
  is_primary: boolean;
}

const emptyGuardianLinkDraft: GuardianLinkDraft = {
  guardian_profile_id: '',
  relationship: '',
  is_primary: false,
};

const emptyDraft: StudentDraft = {
  full_name: '',
  email: '',
  birth_date: '',
  cpf: '',
};

function getErrorMessage(error: unknown): string {
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

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getStudentName(student: StudentRow): string {
  return (
    student.profiles?.full_name ??
    student.registration_number
  );
}

export default function StudentsTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const studentsQuery =
    useStudents(institutionId);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [
    editingStudent,
    setEditingStudent,
  ] = useState<StudentRow | null>(null);

  const [formData, setFormData] =
    useState<StudentDraft>({
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

  const createMutation =
    useCreateStudent();

  const updateMutation =
    useUpdateStudent();

  const statusMutation =
    useSetStudentActive();

  const manageSchoolUserMutation =
    useManageSchoolUser();

  const [guardianStudent, setGuardianStudent] =
    useState<StudentRow | null>(null);

  const [guardianLinkDraft, setGuardianLinkDraft] =
    useState<GuardianLinkDraft>({
      ...emptyGuardianLinkDraft,
    });

  const [guardianLinkError, setGuardianLinkError] =
    useState<string | null>(null);

  const schoolUsersQuery = useSchoolUsers(
    institutionId,
    Boolean(guardianStudent),
  );

  const activeGuardians =
    (schoolUsersQuery.data ?? []).filter(
      (user) =>
        user.role === 'GUARDIAN' &&
        user.active &&
        user.profile?.active !== false,
    );

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending;

  function openGuardianLinkModal(
    student: StudentRow,
  ): void {
    resetMessages();
    setGuardianStudent(student);
    setGuardianLinkDraft({
      ...emptyGuardianLinkDraft,
    });
    setGuardianLinkError(null);
  }

  function closeGuardianLinkModal(): void {
    setGuardianStudent(null);
    setGuardianLinkDraft({
      ...emptyGuardianLinkDraft,
    });
    setGuardianLinkError(null);
  }

  async function handleLinkGuardian(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!guardianStudent || !institutionId) {
      return;
    }

    const result = guardianLinkSchema.safeParse({
      student_id: guardianStudent.id,
      relationship: guardianLinkDraft.relationship,
      is_primary: guardianLinkDraft.is_primary,
    });

    if (!result.success) {
      setGuardianLinkError(
        result.error.issues[0]?.message ??
          'Informe os dados do responsável.',
      );
      return;
    }

    if (!guardianLinkDraft.guardian_profile_id) {
      setGuardianLinkError(
        'Selecione um responsável ativo.',
      );
      return;
    }

    setGuardianLinkError(null);

    try {
      await manageSchoolUserMutation.mutateAsync({
        action: 'link_guardian',
        institutionId,
        guardianProfileId:
          guardianLinkDraft.guardian_profile_id,
        studentId: guardianStudent.id,
        relationship: result.data.relationship,
        isPrimary: result.data.is_primary,
      });

      closeGuardianLinkModal();
      setFeedbackMessage(
        'Responsável vinculado ao aluno com sucesso.',
      );
    } catch (error) {
      setGuardianLinkError(
        getErrorMessage(error),
      );
    }
  }

  const columns: Column<StudentRow>[] = [
    {
      key: 'registration_number',
      label: 'RA',
    },
    {
      id: 'student-name',
      key: 'profile_id',
      label: 'Nome',
      render: (_value, row) =>
        row.profiles?.full_name ??
        'Perfil indisponível',
    },
    {
      id: 'student-email',
      key: 'profile_id',
      label: 'E-mail',
      render: (_value, row) =>
        row.profiles?.email ?? '—',
    },
    {
      key: 'birth_date',
      label: 'Data de nascimento',
      render: (value) =>
        formatDate(String(value)),
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
    setEditingStudent(null);
    setFormData({
      ...emptyDraft,
    });
    setIsModalOpen(true);
  }

  function openEditModal(
    student: StudentRow,
  ): void {
    resetMessages();
    setEditingStudent(student);

    setFormData({
      full_name:
        student.profiles?.full_name ?? '',
      email: student.profiles?.email ?? '',
      birth_date: student.birth_date,
      cpf: student.cpf ?? '',
    });

    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setEditingStudent(null);
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

    try {
      if (editingStudent) {
        const result =
          studentUpdateSchema.safeParse({
            birth_date: formData.birth_date,
            cpf: formData.cpf,
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
          id: editingStudent.id,
          institutionId,
          data: result.data,
        });

        closeModal();

        setFeedbackMessage(
          'Aluno atualizado com sucesso.',
        );

        return;
      }

      const result =
        studentSchema.safeParse({
          institution_id: institutionId,
          full_name: formData.full_name,
          email: formData.email,
          birth_date: formData.birth_date,
          cpf: formData.cpf,
        });

      if (!result.success) {
        setModalError(
          result.error.issues[0]
            ?.message ??
          'Dados inválidos.',
        );
        return;
      }

      const createdStudent =
        await createMutation.mutateAsync(
          result.data,
        );

      closeModal();

      setFeedbackMessage(
        `Aluno cadastrado com sucesso. RA gerado: ${createdStudent.registration_number}. O convite foi enviado para ${createdStudent.email}.`,
      );
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleToggleStatus(
    student: StudentRow,
  ): Promise<void> {
    const nextActive = !student.active;

    const action = nextActive
      ? 'reativar'
      : 'desativar';

    const confirmed = window.confirm(
      `Deseja ${action} o aluno ${getStudentName(student)}?`,
    );

    if (!confirmed) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: student.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Aluno reativado com sucesso.'
          : 'Aluno desativado com sucesso.',
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
        studentsQuery.isError) && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {pageError ??
              getErrorMessage(
                studentsQuery.error,
              )}
          </div>
        )}

      <DataTable
        title="Alunos"
        addLabel="Novo aluno"
        data={studentsQuery.data ?? []}
        columns={columns}
        isLoading={studentsQuery.isLoading}
        onAdd={openCreateModal}
        emptyMessage="Nenhum aluno cadastrado nesta instituição."
        renderActions={(student) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
            student.id;

          return (
            <div className="flex items-center gap-3">
              {student.active && (
                <button
                  type="button"
                  onClick={() =>
                    openGuardianLinkModal(student)
                  }
                  disabled={manageSchoolUserMutation.isPending}
                  className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Vincular responsável
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  openEditModal(student)
                }
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleToggleStatus(
                    student,
                  )
                }
                disabled={isChangingStatus}
                className={
                  student.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus
                  ? 'Salvando...'
                  : student.active
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
          aria-labelledby="student-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="student-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              {editingStudent
                ? 'Editar aluno'
                : 'Novo aluno'}
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

              {editingStudent ? (
                <>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      Nome
                    </span>

                    <p className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {formData.full_name ||
                        'Perfil indisponível'}
                    </p>
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      E-mail
                    </span>

                    <p className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {formData.email || '—'}
                    </p>
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      RA
                    </span>

                    <p className="mt-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {
                        editingStudent.registration_number
                      }
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="student-full-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Nome completo
                    </label>

                    <input
                      id="student-full-name"
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
                      htmlFor="student-email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      E-mail
                    </label>

                    <input
                      id="student-email"
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
                    O usuário, o vínculo acadêmico e o RA serão criados automaticamente. O aluno receberá um convite por e-mail para acessar o sistema.
                  </p>
                </>
              )}

              <div>
                <label
                  htmlFor="student-birth-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Data de nascimento
                </label>

                <input
                  id="student-birth-date"
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={formData.birth_date}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        birth_date:
                          event.target.value,
                      }),
                    )
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="student-cpf"
                  className="block text-sm font-medium text-gray-700"
                >
                  CPF (opcional)
                </label>

                <input
                  id="student-cpf"
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={formData.cpf}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        cpf:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>

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
                    : editingStudent
                      ? 'Salvar alterações'
                      : 'Cadastrar e enviar convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {guardianStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-guardian-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="student-guardian-modal-title"
              className="mb-1 text-lg font-bold text-[#181c20]"
            >
              Vincular responsável
            </h3>
            <p className="mb-4 text-sm text-[#727785]">
              Aluno:{' '}
              <strong>
                {getStudentName(guardianStudent)}
              </strong>
            </p>

            <form
              onSubmit={(event) =>
                void handleLinkGuardian(event)
              }
              className="space-y-4"
            >
              {guardianLinkError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {guardianLinkError}
                </div>
              )}

              <div>
                <label
                  htmlFor="student-guardian"
                  className="block text-sm font-medium text-gray-700"
                >
                  Responsável existente
                </label>
                <select
                  id="student-guardian"
                  value={guardianLinkDraft.guardian_profile_id}
                  onChange={(event) =>
                    setGuardianLinkDraft((current) => ({
                      ...current,
                      guardian_profile_id:
                        event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                  disabled={
                    schoolUsersQuery.isLoading ||
                    manageSchoolUserMutation.isPending
                  }
                >
                  <option value="">
                    {schoolUsersQuery.isLoading
                      ? 'Carregando responsáveis...'
                      : 'Selecione'}
                  </option>
                  {activeGuardians.map((guardian) => (
                    <option
                      key={guardian.profile_id}
                      value={guardian.profile_id}
                    >
                      {guardian.profile?.full_name ??
                        guardian.profile?.email ??
                        'Responsável'}
                      {guardian.profile?.email
                        ? ` (${guardian.profile.email})`
                        : ''}
                    </option>
                  ))}
                </select>
                {!schoolUsersQuery.isLoading &&
                  activeGuardians.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Nenhum responsável ativo encontrado. Cadastre-o em Usuários da Escola primeiro.
                    </p>
                  )}
              </div>

              <div>
                <label
                  htmlFor="student-guardian-relationship"
                  className="block text-sm font-medium text-gray-700"
                >
                  Parentesco
                </label>
                <input
                  id="student-guardian-relationship"
                  value={guardianLinkDraft.relationship}
                  onChange={(event) =>
                    setGuardianLinkDraft((current) => ({
                      ...current,
                      relationship: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  placeholder="Mãe, pai, avó, tutor..."
                  required
                  disabled={manageSchoolUserMutation.isPending}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={guardianLinkDraft.is_primary}
                  onChange={(event) =>
                    setGuardianLinkDraft((current) => ({
                      ...current,
                      is_primary: event.target.checked,
                    }))
                  }
                  disabled={manageSchoolUserMutation.isPending}
                />
                Responsável principal
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeGuardianLinkModal}
                  disabled={manageSchoolUserMutation.isPending}
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    manageSchoolUserMutation.isPending ||
                    schoolUsersQuery.isLoading ||
                    activeGuardians.length === 0
                  }
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {manageSchoolUserMutation.isPending
                    ? 'Vinculando...'
                    : 'Vincular responsável'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
