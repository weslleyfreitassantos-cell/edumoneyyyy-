import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';
import ClassAutomationPanel from '../../../components/academic/ClassAutomationPanel';

import { useAuth } from '../../../contexts/AuthContext';

import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useAcademicShiftSettings } from '../../../hooks/useAcademicTermClosing';

import {
  useClasses,
  useClassDeletionImpact,
  useCreateClass,
  useDeleteClass,
  useSetClassActive,
  useUpdateClass,
} from '../../../hooks/useClasses';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  classSchema,
  classUpdateSchema,
} from '../../../schemas/adminSchemas';

import {
  buildClassDeletionBlockedMessage,
  type ClassRow,
} from '../../../services/classService';
import {
  getAcademicShiftLabel,
  toAcademicShift,
  type AcademicShift,
} from '../../../lib/academic/academicShifts';

interface ClassDraft {
  name: string;
  academic_year_id: string;
  grade_level: string;
  shift: string;
  capacity: string;
  active: boolean;
}

const emptyDraft: ClassDraft = {
  name: '',
  academic_year_id: '',
  grade_level: '',
  shift: '',
  capacity: '30',
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

function toClassPayload(
  institutionId: string,
  draft: ClassDraft,
) {
  return {
    institution_id: institutionId,
    name: draft.name,
    academic_year_id:
      draft.academic_year_id,
    grade_level: draft.grade_level,
    shift: draft.shift,
    capacity: Number(draft.capacity),
    active: draft.active,
  };
}

export default function ClassesTab() {
  const { profile } = useAuth();

  const navigate = useNavigate();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const classesQuery =
    useClasses(institutionId);

  const yearsQuery =
    useAcademicYears(institutionId);

  const shiftSettingsQuery =
    useAcademicShiftSettings(institutionId);

  const enabledShifts: AcademicShift[] =
    shiftSettingsQuery.data ?? ['MATUTINO'];

  const createMutation =
    useCreateClass();

  const updateMutation =
    useUpdateClass();

  const statusMutation =
    useSetClassActive();

  const deleteMutation =
    useDeleteClass();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [isAutomationOpen, setIsAutomationOpen] =
    useState(false);

  const [
    editingClass,
    setEditingClass,
  ] = useState<ClassRow | null>(null);

  const [deletionCheckClassId, setDeletionCheckClassId] =
    useState<string | null>(null);

  const deletionImpactQuery = useClassDeletionImpact(
    institutionId,
    deletionCheckClassId,
  );

  const [formData, setFormData] =
    useState<ClassDraft>({
      ...emptyDraft,
    });

  const [
    yearFilter,
    setYearFilter,
  ] = useState('all');

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

  const years = yearsQuery.data ?? [];

  const filteredClasses = useMemo(() => {
    const classes = classesQuery.data ?? [];

    return classes.filter((classRecord) => {
      const matchesYear =
        yearFilter === 'all' ||
        classRecord.academic_year_id ===
          yearFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' &&
          classRecord.active) ||
        (statusFilter === 'inactive' &&
          !classRecord.active);

      return matchesYear && matchesStatus;
    });
  }, [
    classesQuery.data,
    statusFilter,
    yearFilter,
  ]);

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const columns: Column<ClassRow>[] = [
    {
      key: 'name',
      label: 'Turma',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.name}
          </p>

          <p className="mt-1 text-xs text-[#727785]">
            {[row.grade_level, row.shift]
              .filter(Boolean)
              .join(' • ') || 'Série e turno não informados'}
          </p>
        </div>
      ),
    },
    {
      key: 'academic_year_name',
      label: 'Ano letivo',
      render: (_value, row) =>
        row.academic_year_name ?? '—',
    },
    {
      key: 'capacity',
      label: 'Capacidade',
    },
    {
      key: 'active_enrollments_count',
      label: 'Matrículas',
    },
    {
      key: 'active_offerings_count',
      label: 'Ofertas',
    },
    {
      key: 'active_curriculum_items_count',
      label: 'Matriz',
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
    setEditingClass(null);
    setDeletionCheckClassId(null);
    setFormData({
      ...emptyDraft,
      academic_year_id:
        years[0]?.id ?? '',
      shift: enabledShifts[0] ?? 'MATUTINO',
    });
    setIsModalOpen(true);
  }

  function openEditModal(
    classRecord: ClassRow,
  ): void {
    resetMessages();
    setEditingClass(classRecord);
    setDeletionCheckClassId(classRecord.id);
    setFormData({
      name: classRecord.name,
      academic_year_id:
        classRecord.academic_year_id,
      grade_level:
        classRecord.grade_level ?? '',
      shift: toAcademicShift(classRecord.shift) ?? '',
      capacity: String(
        classRecord.capacity,
      ),
      active: classRecord.active,
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setEditingClass(null);
    setDeletionCheckClassId(null);
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

    const payload = toClassPayload(
      institutionId,
      formData,
    );

    try {
      if (editingClass) {
        const result =
          classUpdateSchema.safeParse({
            name: payload.name,
            academic_year_id:
              payload.academic_year_id,
            grade_level:
              payload.grade_level,
            shift: payload.shift,
            capacity: payload.capacity,
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
          id: editingClass.id,
          institutionId,
          data: result.data,
        });

        setFeedbackMessage(
          'Turma atualizada com sucesso.',
        );
      } else {
        const result =
          classSchema.safeParse(payload);

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
          'Turma criada com sucesso.',
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
    classRecord: ClassRow,
  ): Promise<void> {
    const nextActive = !classRecord.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    const suffix =
      !nextActive &&
      (classRecord.active_enrollments_count > 0 ||
        classRecord.active_offerings_count > 0)
        ? ' O histórico será preservado.'
        : '';

    if (
      !window.confirm(
        `Deseja ${action} a turma ${classRecord.name}?${suffix}`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: classRecord.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Turma reativada.'
          : 'Turma desativada.',
      );
    } catch (error) {
      setPageError(
        getErrorMessage(error),
      );
    }
  }

  async function handleDeleteClass(): Promise<void> {
    if (!editingClass) {
      return;
    }

    if (deletionImpactQuery.isLoading) {
      return;
    }

    if (deletionImpactQuery.isError) {
      setModalError(getErrorMessage(deletionImpactQuery.error));
      return;
    }

    const impact = deletionImpactQuery.data;
    if (!impact) {
      setModalError('Não foi possível verificar os vínculos desta turma.');
      return;
    }

    const blockedMessage = buildClassDeletionBlockedMessage(impact);
    if (blockedMessage) {
      setModalError(blockedMessage);
      return;
    }

    if (!window.confirm(`Excluir a turma ${editingClass.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        id: editingClass.id,
        institutionId,
      });
      setFeedbackMessage('Turma excluída com sucesso.');
      closeModal();
    } catch (error) {
      setModalError(getErrorMessage(error));
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
        classesQuery.isError ||
        yearsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              classesQuery.error ??
                yearsQuery.error,
            )}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:flex-row sm:items-end">
        <div>
          <label
            htmlFor="class-year-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Ano letivo
          </label>
          <select
            id="class-year-filter"
            value={yearFilter}
            onChange={(event) =>
              setYearFilter(event.target.value)
            }
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {years.map((year) => (
              <option
                key={year.id}
                value={year.id}
              >
                {year.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="class-status-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <select
            id="class-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Ativas</option>
            <option value="inactive">
              Inativas
            </option>
          </select>
        </div>
      </section>

      <DataTable
        title="Turmas"
        addLabel="Nova turma"
        extraHeaderActions={(
          <button
            type="button"
            onClick={() => setIsAutomationOpen(true)}
            className="rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-medium text-[#005bbf] transition-colors hover:bg-blue-50"
          >
            Automatizar turmas
          </button>
        )}
        data={filteredClasses}
        columns={columns}
        isLoading={
          classesQuery.isLoading ||
          yearsQuery.isLoading
        }
        onAdd={openCreateModal}
        emptyMessage="Nenhuma turma encontrada para os filtros selecionados."
        renderActions={(classRecord) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
              classRecord.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openEditModal(classRecord)
                }
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/admin?module=curriculum&classId=${classRecord.id}`,
                  )
                }
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Configurar matriz
              </button>

              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() =>
                  void handleToggleStatus(
                    classRecord,
                  )
                }
                className={
                  classRecord.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus
                  ? 'Salvando...'
                  : classRecord.active
                    ? 'Desativar'
                    : 'Reativar'}
              </button>
            </div>
          );
        }}
      />

      {isAutomationOpen && (
        <ClassAutomationPanel
          institutionId={institutionId}
          onClose={() => setIsAutomationOpen(false)}
          onCompleted={(message) => {
            setFeedbackMessage(message);
            setPageError(null);
          }}
        />
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="class-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              {editingClass
                ? 'Editar turma'
                : 'Nova turma'}
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
                  htmlFor="class-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nome
                </label>
                <input
                  id="class-name"
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
                  htmlFor="class-year"
                  className="block text-sm font-medium text-gray-700"
                >
                  Ano letivo
                </label>
                <select
                  id="class-year"
                  value={formData.academic_year_id}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        academic_year_id:
                          event.target.value,
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">
                    Selecione
                  </option>
                  {years.map((year) => (
                    <option
                      key={year.id}
                      value={year.id}
                    >
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="class-grade"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Série ou nível
                  </label>
                  <input
                    id="class-grade"
                    type="text"
                    value={formData.grade_level}
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,
                          grade_level:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="class-shift"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Turno
                  </label>
                  <select
                    id="class-shift"
                    value={formData.shift}
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,
                          shift:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">Selecione</option>
                    {enabledShifts.map((shift) => (
                      <option key={shift} value={shift}>
                        {getAcademicShiftLabel(shift)}
                      </option>
                    ))}
                    {formData.shift && !enabledShifts.includes(formData.shift as typeof enabledShifts[number]) && (
                      <option value={formData.shift}>
                        {getAcademicShiftLabel(formData.shift)} (atual)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="class-capacity"
                  className="block text-sm font-medium text-gray-700"
                >
                  Capacidade
                </label>
                <input
                  id="class-capacity"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.capacity}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        capacity:
                          event.target.value,
                      }),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
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

              {editingClass && (
                <div
                  className={
                    deletionImpactQuery.isError ||
                    (deletionImpactQuery.data?.totalLinkedRecords ?? 0) > 0
                      ? 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900'
                      : 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700'
                  }
                  role={
                    deletionImpactQuery.isError ||
                    (deletionImpactQuery.data?.totalLinkedRecords ?? 0) > 0
                      ? 'alert'
                      : undefined
                  }
                >
                  {deletionImpactQuery.isLoading && 'Verificando vínculos da turma...'}
                  {deletionImpactQuery.isError && 'Não foi possível verificar os vínculos antes da exclusão.'}
                  {!deletionImpactQuery.isLoading && !deletionImpactQuery.isError && deletionImpactQuery.data && (
                    deletionImpactQuery.data.totalLinkedRecords > 0
                      ? buildClassDeletionBlockedMessage(deletionImpactQuery.data)
                      : 'Nenhum vínculo acadêmico encontrado. A exclusão física está disponível.'
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {editingClass && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteClass()}
                    disabled={isSubmitting || deletionImpactQuery.isLoading || deletionImpactQuery.isError}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Excluindo...' : 'Excluir turma'}
                  </button>
                )}

                <div className="ml-auto flex gap-2">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
