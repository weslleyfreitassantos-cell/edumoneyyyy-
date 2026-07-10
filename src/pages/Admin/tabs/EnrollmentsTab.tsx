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

import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  useCreateEnrollment,
  useEnrollments,
  useTransferEnrollment,
  useUpdateEnrollmentStatus,
} from '../../../hooks/useEnrollments';

import { useStudents } from '../../../hooks/useStudents';

import {
  enrollmentSchema,
  enrollmentStatusUpdateSchema,
  enrollmentTransferSchema,
} from '../../../schemas/adminSchemas';

import type { ClassRow } from '../../../services/classService';
import type {
  EnrollmentRow,
  EnrollmentStatus,
} from '../../../services/enrollmentService';

interface EnrollmentDraft {
  student_id: string;
  academic_year_id: string;
  class_id: string;
}

const emptyDraft: EnrollmentDraft = {
  student_id: '',
  academic_year_id: '',
  class_id: '',
};

const statusOptions: {
  value: EnrollmentStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativas' },
  {
    value: 'TRANSFERRED',
    label: 'Transferidas',
  },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'COMPLETED', label: 'Concluídas' },
];

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
  enrollment,
}: {
  enrollment: EnrollmentRow;
}) {
  const styles: Record<
    EnrollmentStatus,
    string
  > = {
    ACTIVE:
      'bg-green-100 text-green-700',
    TRANSFERRED:
      'bg-blue-100 text-blue-700',
    CANCELLED:
      'bg-gray-100 text-gray-600',
    COMPLETED:
      'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[enrollment.status]}`}
    >
      {enrollment.status_label}
    </span>
  );
}

function isClassFull(
  classRecord: ClassRow,
): boolean {
  return (
    classRecord.capacity > 0 &&
    classRecord.active_enrollments_count >=
      classRecord.capacity
  );
}

function getClassLabel(
  classRecord: ClassRow,
): string {
  const capacity =
    classRecord.capacity > 0
      ? `${classRecord.active_enrollments_count}/${classRecord.capacity}`
      : `${classRecord.active_enrollments_count}/sem limite`;

  return `${classRecord.name} (${capacity})`;
}

function getEnrollmentCapacityLabel(
  enrollment: EnrollmentRow,
): string {
  if (
    enrollment.class_capacity === null ||
    enrollment.class_capacity <= 0
  ) {
    return `${enrollment.active_enrollments_in_class}/sem limite`;
  }

  return `${enrollment.active_enrollments_in_class}/${enrollment.class_capacity}`;
}

export default function EnrollmentsTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const enrollmentsQuery =
    useEnrollments(institutionId);

  const studentsQuery =
    useStudents(institutionId);

  const classesQuery =
    useClasses(institutionId);

  const yearsQuery =
    useAcademicYears(institutionId);

  const createMutation =
    useCreateEnrollment();

  const transferMutation =
    useTransferEnrollment();

  const statusMutation =
    useUpdateEnrollmentStatus();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [
    transferEnrollment,
    setTransferEnrollment,
  ] = useState<EnrollmentRow | null>(null);

  const [
    transferClassId,
    setTransferClassId,
  ] = useState('');

  const [formData, setFormData] =
    useState<EnrollmentDraft>({
      ...emptyDraft,
    });

  const [
    yearFilter,
    setYearFilter,
  ] = useState('all');

  const [
    classFilter,
    setClassFilter,
  ] = useState('all');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<EnrollmentStatus | 'all'>(
    'all',
  );

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
  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const activeStudents = useMemo(
    () =>
      students.filter(
        (student) => student.active,
      ),
    [students],
  );

  const activeClasses = useMemo(
    () =>
      classes.filter(
        (classRecord) =>
          classRecord.active &&
          years.some(
            (year) =>
              year.id ===
                classRecord.academic_year_id &&
              year.active,
          ),
      ),
    [classes, years],
  );

  const classesForDraft = useMemo(
    () =>
      activeClasses.filter(
        (classRecord) =>
          !formData.academic_year_id ||
          classRecord.academic_year_id ===
            formData.academic_year_id,
      ),
    [activeClasses, formData.academic_year_id],
  );

  const transferClassOptions = useMemo(() => {
    if (!transferEnrollment) {
      return [];
    }

    return activeClasses.filter(
      (classRecord) =>
        classRecord.academic_year_id ===
          transferEnrollment.academic_year_id &&
        classRecord.id !==
          transferEnrollment.class_id,
    );
  }, [activeClasses, transferEnrollment]);

  const filteredEnrollments = useMemo(() => {
    const enrollments =
      enrollmentsQuery.data ?? [];

    return enrollments.filter(
      (enrollment) => {
        const matchesYear =
          yearFilter === 'all' ||
          enrollment.academic_year_id ===
            yearFilter;

        const matchesClass =
          classFilter === 'all' ||
          enrollment.class_id === classFilter;

        const matchesStatus =
          statusFilter === 'all' ||
          enrollment.status === statusFilter;

        return (
          matchesYear &&
          matchesClass &&
          matchesStatus
        );
      },
    );
  }, [
    classFilter,
    enrollmentsQuery.data,
    statusFilter,
    yearFilter,
  ]);

  const isSubmitting =
    createMutation.isPending ||
    transferMutation.isPending ||
    statusMutation.isPending;

  const columns: Column<EnrollmentRow>[] = [
    {
      key: 'student_name',
      label: 'Aluno',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.student_name}
          </p>
          <p className="mt-1 text-xs text-[#727785]">
            Matrícula {row.student_registration_number}
          </p>
        </div>
      ),
    },
    {
      key: 'class_name',
      label: 'Turma',
      render: (_value, row) => (
        <div>
          <p className="font-medium text-[#181c20]">
            {row.class_name}
          </p>
          <p className="mt-1 text-xs text-[#727785]">
            {[row.class_grade_level, row.class_shift]
              .filter(Boolean)
              .join(' • ') || 'Série e turno não informados'}
          </p>
        </div>
      ),
    },
    {
      key: 'academic_year_name',
      label: 'Ano letivo',
    },
    {
      key: 'active_enrollments_in_class',
      label: 'Capacidade',
      render: (_value, row) =>
        getEnrollmentCapacityLabel(row),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_value, row) => (
        <StatusBadge enrollment={row} />
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
    setTransferEnrollment(null);
    setTransferClassId('');

    const firstYear =
      years.find((year) => year.active)?.id ??
      years[0]?.id ??
      '';

    const firstClass =
      activeClasses.find(
        (classRecord) =>
          classRecord.academic_year_id ===
            firstYear &&
          !isClassFull(classRecord),
      ) ??
      activeClasses.find(
        (classRecord) =>
          !isClassFull(classRecord),
      );

    setFormData({
      student_id: '',
      academic_year_id:
        firstClass?.academic_year_id ??
        firstYear,
      class_id: firstClass?.id ?? '',
    });

    setIsModalOpen(true);
  }

  function openTransferModal(
    enrollment: EnrollmentRow,
  ): void {
    resetMessages();
    setIsModalOpen(false);
    setTransferEnrollment(enrollment);
    setTransferClassId('');
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setTransferEnrollment(null);
    setTransferClassId('');
    setFormData({ ...emptyDraft });
    setModalError(null);
  }

  function handleYearChange(
    academicYearId: string,
  ): void {
    const nextClass =
      activeClasses.find(
        (classRecord) =>
          classRecord.academic_year_id ===
            academicYearId &&
          !isClassFull(classRecord),
      )?.id ?? '';

    setFormData((current) => ({
      ...current,
      academic_year_id: academicYearId,
      class_id: nextClass,
    }));
  }

  function handleClassChange(
    classId: string,
  ): void {
    const selectedClass = activeClasses.find(
      (classRecord) =>
        classRecord.id === classId,
    );

    setFormData((current) => ({
      ...current,
      class_id: classId,
      academic_year_id:
        selectedClass?.academic_year_id ??
        current.academic_year_id,
    }));
  }

  async function handleCreate(
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

    const result = enrollmentSchema.safeParse({
      institution_id: institutionId,
      student_id: formData.student_id,
      academic_year_id:
        formData.academic_year_id,
      class_id: formData.class_id,
      status: 'ACTIVE',
      active: true,
    });

    if (!result.success) {
      setModalError(
        result.error.issues[0]?.message ??
          'Dados inválidos.',
      );
      return;
    }

    try {
      await createMutation.mutateAsync(
        result.data,
      );

      closeModal();
      setFeedbackMessage(
        'Matrícula criada com sucesso.',
      );
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleTransfer(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setModalError(null);

    if (!transferEnrollment) {
      setModalError(
        'Matrícula de origem não selecionada.',
      );
      return;
    }

    const result =
      enrollmentTransferSchema.safeParse({
        enrollment_id:
          transferEnrollment.id,
        target_class_id: transferClassId,
      });

    if (!result.success) {
      setModalError(
        result.error.issues[0]?.message ??
          'Dados inválidos.',
      );
      return;
    }

    try {
      await transferMutation.mutateAsync({
        institutionId,
        data: result.data,
      });

      closeModal();
      setFeedbackMessage(
        'Transferência registrada sem apagar o histórico.',
      );
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleStatusChange(
    enrollment: EnrollmentRow,
    active: boolean,
    status: EnrollmentStatus,
  ): Promise<void> {
    const action = active
      ? 'reativar'
      : 'cancelar';

    if (
      !window.confirm(
        `Deseja ${action} a matrícula de ${enrollment.student_name}?`,
      )
    ) {
      return;
    }

    const result =
      enrollmentStatusUpdateSchema.safeParse({
        active,
        status,
      });

    if (!result.success) {
      setPageError(
        result.error.issues[0]?.message ??
          'Dados inválidos.',
      );
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: enrollment.id,
        institutionId,
        data: result.data,
      });

      setFeedbackMessage(
        active
          ? 'Matrícula reativada.'
          : 'Matrícula cancelada.',
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
        enrollmentsQuery.isError ||
        studentsQuery.isError ||
        classesQuery.isError ||
        yearsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              enrollmentsQuery.error ??
                studentsQuery.error ??
                classesQuery.error ??
                yearsQuery.error,
            )}
        </div>
      )}

      <section className="grid gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="enrollment-year-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Ano letivo
          </label>
          <select
            id="enrollment-year-filter"
            value={yearFilter}
            onChange={(event) =>
              setYearFilter(event.target.value)
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
            htmlFor="enrollment-class-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Turma
          </label>
          <select
            id="enrollment-class-filter"
            value={classFilter}
            onChange={(event) =>
              setClassFilter(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {classes.map((classRecord) => (
              <option
                key={classRecord.id}
                value={classRecord.id}
              >
                {classRecord.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="enrollment-status-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <select
            id="enrollment-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | EnrollmentStatus
                  | 'all',
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            {statusOptions.map((status) => (
              <option
                key={status.value}
                value={status.value}
              >
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <DataTable
        title="Matrículas"
        addLabel="Nova matrícula"
        data={filteredEnrollments}
        columns={columns}
        isLoading={
          enrollmentsQuery.isLoading ||
          studentsQuery.isLoading ||
          classesQuery.isLoading ||
          yearsQuery.isLoading
        }
        onAdd={openCreateModal}
        emptyMessage="Nenhuma matrícula encontrada para os filtros selecionados."
        renderActions={(enrollment) => {
          const isChanging =
            isSubmitting &&
            (statusMutation.variables?.id ===
              enrollment.id ||
              transferMutation.variables?.data
                .enrollment_id ===
                enrollment.id);

          return (
            <div className="flex flex-wrap items-center gap-3">
              {enrollment.active && (
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    openTransferModal(
                      enrollment,
                    )
                  }
                  className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Transferir
                </button>
              )}

              {enrollment.active ? (
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    void handleStatusChange(
                      enrollment,
                      false,
                      'CANCELLED',
                    )
                  }
                  className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {isChanging
                    ? 'Salvando...'
                    : 'Cancelar'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    void handleStatusChange(
                      enrollment,
                      true,
                      'ACTIVE',
                    )
                  }
                  className="font-medium text-green-600 hover:text-green-800 disabled:opacity-50"
                >
                  {isChanging
                    ? 'Salvando...'
                    : 'Reativar'}
                </button>
              )}
            </div>
          );
        }}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrollment-modal-title"
        >
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="enrollment-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              Nova matrícula
            </h3>

            <form
              onSubmit={(event) =>
                void handleCreate(event)
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
                  htmlFor="enrollment-student"
                  className="block text-sm font-medium text-gray-700"
                >
                  Aluno
                </label>
                <select
                  id="enrollment-student"
                  value={formData.student_id}
                  onChange={(event) =>
                    setFormData(
                      (current) => ({
                        ...current,
                        student_id:
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
                  {activeStudents.map((student) => (
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="enrollment-year"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Ano letivo
                  </label>
                  <select
                    id="enrollment-year"
                    value={
                      formData.academic_year_id
                    }
                    onChange={(event) =>
                      handleYearChange(
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  >
                    <option value="">
                      Selecione
                    </option>
                    {years
                      .filter((year) => year.active)
                      .map((year) => (
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
                    htmlFor="enrollment-class"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Turma
                  </label>
                  <select
                    id="enrollment-class"
                    value={formData.class_id}
                    onChange={(event) =>
                      handleClassChange(
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  >
                    <option value="">
                      Selecione
                    </option>
                    {classesForDraft.map(
                      (classRecord) => {
                        const full =
                          isClassFull(
                            classRecord,
                          );

                        return (
                          <option
                            key={classRecord.id}
                            value={classRecord.id}
                            disabled={full}
                          >
                            {getClassLabel(
                              classRecord,
                            )}
                            {full ? ' - lotada' : ''}
                          </option>
                        );
                      },
                    )}
                  </select>
                </div>
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
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferEnrollment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="transfer-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              Transferir matrícula
            </h3>

            <form
              onSubmit={(event) =>
                void handleTransfer(event)
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

              <div className="rounded-lg border border-[#dfe3e8] bg-gray-50 px-3 py-2 text-sm">
                <p className="font-semibold text-[#181c20]">
                  {transferEnrollment.student_name}
                </p>
                <p className="mt-1 text-[#727785]">
                  Origem: {transferEnrollment.class_name}
                </p>
              </div>

              <div>
                <label
                  htmlFor="transfer-class"
                  className="block text-sm font-medium text-gray-700"
                >
                  Turma de destino
                </label>
                <select
                  id="transfer-class"
                  value={transferClassId}
                  onChange={(event) =>
                    setTransferClassId(
                      event.target.value,
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">
                    Selecione
                  </option>
                  {transferClassOptions.map(
                    (classRecord) => {
                      const full =
                        isClassFull(
                          classRecord,
                        );

                      return (
                        <option
                          key={classRecord.id}
                          value={classRecord.id}
                          disabled={full}
                        >
                          {getClassLabel(
                            classRecord,
                          )}
                          {full ? ' - lotada' : ''}
                        </option>
                      );
                    },
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={
                    transferMutation.isPending
                  }
                  className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    transferMutation.isPending
                  }
                  className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {transferMutation.isPending
                    ? 'Transferindo...'
                    : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
