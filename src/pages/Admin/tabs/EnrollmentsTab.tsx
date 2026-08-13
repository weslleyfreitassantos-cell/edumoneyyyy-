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
import FullStudentEnrollmentWizard from './FullStudentEnrollmentWizard';

import {
  useCreateEnrollment,
  useEnrollments,
  useTransferEnrollment,
  useUpdateEnrollment,
  useUpdateEnrollmentStatus,
} from '../../../hooks/useEnrollments';

import { useStudents } from '../../../hooks/useStudents';
import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import { useManageSchoolUser } from '../../../hooks/useSchoolUserManagement';

import {
  guardianLinkSchema,
  enrollmentSchema,
  enrollmentUpdateSchema,
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
  guardian_profile_id: string;
  guardian_relationship: string;
  guardian_is_primary: boolean;
}

interface GuardianLinkDraft {
  guardian_profile_id: string;
  relationship: string;
  is_primary: boolean;
}

interface PendingGuardianLink {
  student_id: string;
  student_name: string;
}

const emptyDraft: EnrollmentDraft = {
  student_id: '',
  academic_year_id: '',
  class_id: '',
  guardian_profile_id: '',
  guardian_relationship: '',
  guardian_is_primary: false,
};

const emptyGuardianLinkDraft: GuardianLinkDraft = {
  guardian_profile_id: '',
  relationship: '',
  is_primary: false,
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

  const updateMutation =
    useUpdateEnrollment();

  const manageSchoolUserMutation =
    useManageSchoolUser();

  const [isGuardianLinkModalOpen, setIsGuardianLinkModalOpen] =
    useState(false);

  const [pendingGuardianLink, setPendingGuardianLink] =
    useState<PendingGuardianLink | null>(null);

  const [guardianLinkDraft, setGuardianLinkDraft] =
    useState<GuardianLinkDraft>({
      ...emptyGuardianLinkDraft,
    });

  const [guardianLinkError, setGuardianLinkError] =
    useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [isEnrollmentStartOpen, setIsEnrollmentStartOpen] =
    useState(false);

  const [isFullWizardOpen, setIsFullWizardOpen] =
    useState(false);

  const [editingEnrollment, setEditingEnrollment] =
    useState<EnrollmentRow | null>(null);

  const schoolUsersQuery = useSchoolUsers(
    institutionId,
    isModalOpen || isGuardianLinkModalOpen,
  );

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

  const activeGuardians = useMemo(
    () =>
      (schoolUsersQuery.data ?? []).filter(
        (user) =>
          user.role === 'GUARDIAN' &&
          user.active &&
          user.profile?.active !== false,
      ),
    [schoolUsersQuery.data],
  );

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
    updateMutation.isPending ||
    transferMutation.isPending ||
    statusMutation.isPending ||
    manageSchoolUserMutation.isPending;

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
    setEditingEnrollment(null);
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
      guardian_profile_id: '',
      guardian_relationship: '',
      guardian_is_primary: false,
    });

    setIsModalOpen(true);
  }

  function openEnrollmentStart(): void {
    resetMessages();
    setIsEnrollmentStartOpen(true);
  }

  function openFullWizard(): void {
    resetMessages();
    setIsEnrollmentStartOpen(false);
    setIsFullWizardOpen(true);
  }

  function openEditModal(
    enrollment: EnrollmentRow,
  ): void {
    resetMessages();
    setTransferEnrollment(null);
    setEditingEnrollment(enrollment);
    setFormData({
      student_id: enrollment.student_id,
      academic_year_id: enrollment.academic_year_id,
      class_id: enrollment.class_id,
      guardian_profile_id: '',
      guardian_relationship: '',
      guardian_is_primary: false,
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
    setEditingEnrollment(null);
    setTransferEnrollment(null);
    setTransferClassId('');
    setFormData({ ...emptyDraft });
    setModalError(null);
  }

  function openGuardianLinkModal(): void {
    if (!pendingGuardianLink) {
      return;
    }

    setGuardianLinkDraft({
      ...emptyGuardianLinkDraft,
    });
    setGuardianLinkError(null);
    setIsGuardianLinkModalOpen(true);
  }

  function openGuardianLinkForEnrollment(
    enrollment: EnrollmentRow,
  ): void {
    resetMessages();
    setPendingGuardianLink({
      student_id: enrollment.student_id,
      student_name: enrollment.student_name,
    });
    setGuardianLinkDraft({
      ...emptyGuardianLinkDraft,
    });
    setGuardianLinkError(null);
    setIsGuardianLinkModalOpen(true);
  }

  function closeGuardianLinkModal(): void {
    setIsGuardianLinkModalOpen(false);
    setGuardianLinkDraft({
      ...emptyGuardianLinkDraft,
    });
    setGuardianLinkError(null);
  }

  function finishPendingGuardianLink(): void {
    setPendingGuardianLink(null);
    setGuardianLinkError(null);
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

    if (editingEnrollment) {
      const editResult =
        enrollmentUpdateSchema.safeParse({
          academic_year_id:
            formData.academic_year_id,
          class_id: formData.class_id,
        });

      if (!editResult.success) {
        setModalError(
          editResult.error.issues[0]?.message ??
            'Dados inválidos.',
        );
        return;
      }

      try {
        await updateMutation.mutateAsync({
          id: editingEnrollment.id,
          institutionId,
          data: editResult.data,
        });
        closeModal();
        setFeedbackMessage(
          'Matrícula atualizada com sucesso.',
        );
      } catch (error) {
        setModalError(getErrorMessage(error));
      }

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

    const guardianProfileId =
      formData.guardian_profile_id.trim();

    if (guardianProfileId) {
      const guardianResult =
        guardianLinkSchema.safeParse({
          student_id: result.data.student_id,
          relationship:
            formData.guardian_relationship,
          is_primary:
            formData.guardian_is_primary,
        });

      if (!guardianResult.success) {
        setModalError(
          guardianResult.error.issues[0]?.message ??
            'Informe os dados do responsável.',
        );
        return;
      }
    }

    const studentName =
      activeStudents.find(
        (student) =>
          student.id === result.data.student_id,
      )?.profiles?.full_name ??
      'Aluno matriculado';

    let enrollmentCreated = false;

    try {
      await createMutation.mutateAsync(
        result.data,
      );
      enrollmentCreated = true;

      if (guardianProfileId) {
        await manageSchoolUserMutation.mutateAsync({
          action: 'link_guardian',
          institutionId,
          guardianProfileId,
          studentId: result.data.student_id,
          relationship:
            formData.guardian_relationship.trim(),
          isPrimary:
            formData.guardian_is_primary,
        });
      }

      closeModal();
      setPendingGuardianLink(
        guardianProfileId
          ? null
          : {
              student_id: result.data.student_id,
              student_name: studentName,
            },
      );
      setFeedbackMessage(
        guardianProfileId
          ? 'Matrícula e responsável vinculados com sucesso.'
          : null,
      );
    } catch (error) {
      if (enrollmentCreated && guardianProfileId) {
        closeModal();
        setPendingGuardianLink({
          student_id: result.data.student_id,
          student_name: studentName,
        });
        setGuardianLinkDraft({
          guardian_profile_id: guardianProfileId,
          relationship:
            formData.guardian_relationship,
          is_primary:
            formData.guardian_is_primary,
        });
        setGuardianLinkError(
          `Matrícula criada, mas não foi possível vincular o responsável: ${getErrorMessage(error)}`,
        );
        setIsGuardianLinkModalOpen(true);
        return;
      }

      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleLinkGuardian(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setGuardianLinkError(null);

    if (!institutionId || !pendingGuardianLink) {
      setGuardianLinkError(
        'A matrícula de origem não foi encontrada.',
      );
      return;
    }

    const result = guardianLinkSchema.safeParse({
      student_id: pendingGuardianLink.student_id,
      relationship: guardianLinkDraft.relationship,
      is_primary: guardianLinkDraft.is_primary,
    });

    if (!result.success) {
      setGuardianLinkError(
        result.error.issues[0]?.message ??
          'Informe os dados do vínculo.',
      );
      return;
    }

    if (!guardianLinkDraft.guardian_profile_id) {
      setGuardianLinkError(
        'Selecione um responsável ativo.',
      );
      return;
    }

    try {
      await manageSchoolUserMutation.mutateAsync({
        action: 'link_guardian',
        institutionId,
        guardianProfileId:
          guardianLinkDraft.guardian_profile_id,
        studentId: result.data.student_id,
        relationship: result.data.relationship,
        isPrimary: result.data.is_primary,
      });

      closeGuardianLinkModal();
      setPendingGuardianLink(null);
      setFeedbackMessage(
        'Responsável vinculado ao aluno com sucesso.',
      );
    } catch (error) {
      setGuardianLinkError(
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
      {pendingGuardianLink ? (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          <p className="font-semibold">
            Matrícula criada com sucesso.
          </p>
          <p className="mt-1">
            Deseja vincular um responsável a{' '}
            <strong>{pendingGuardianLink.student_name}</strong> agora?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openGuardianLinkModal}
              className="rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a73e8]"
            >
              Vincular responsável
            </button>
            <button
              type="button"
              onClick={finishPendingGuardianLink}
              className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            >
              Concluir
            </button>
          </div>
        </div>
      ) : feedbackMessage ? (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {feedbackMessage}
        </div>
      ) : null}

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
        onAdd={openEnrollmentStart}
        emptyMessage="Nenhuma matrícula encontrada para os filtros selecionados."
        renderActions={(enrollment) => {
          const isLinking =
            manageSchoolUserMutation.isPending &&
            pendingGuardianLink?.student_id ===
              enrollment.student_id;
          const isChanging =
            (statusMutation.isPending &&
              statusMutation.variables?.id ===
                enrollment.id) ||
            (transferMutation.isPending &&
              transferMutation.variables?.data
                .enrollment_id ===
                enrollment.id) ||
            isLinking;

          return (
            <div className="flex flex-wrap items-center gap-3">
              {enrollment.active && (
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    openEditModal(enrollment)
                  }
                  className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Editar
                </button>
              )}

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

              {enrollment.active && (
                <button
                  type="button"
                  disabled={isChanging}
                  onClick={() =>
                    openGuardianLinkForEnrollment(
                      enrollment,
                    )
                  }
                  className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Vincular responsável
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

      {isEnrollmentStartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrollment-start-title"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="enrollment-start-title"
                  className="text-lg font-bold text-[#181c20]"
                >
                  Como deseja iniciar a matricula?
                </h3>
                <p className="mt-1 text-sm text-[#727785]">
                  Escolha o caminho que corresponde ao cadastro do aluno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollmentStartOpen(false)}
                className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#727785]"
                aria-label="Fechar"
              >
                X
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setIsEnrollmentStartOpen(false);
                  openCreateModal();
                }}
                className="rounded-xl border border-[#dfe3e8] p-5 text-left transition hover:border-[#005bbf] hover:bg-blue-50"
              >
                <strong className="block text-base text-[#181c20]">
                  Aluno ja cadastrado
                </strong>
                <span className="mt-2 block text-sm text-[#727785]">
                  Use a matricula rapida e associe um responsavel existente, se necessario.
                </span>
              </button>
              <button
                type="button"
                onClick={openFullWizard}
                className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-[#005bbf]"
              >
                <strong className="block text-base text-[#181c20]">
                  Aluno novo
                </strong>
                <span className="mt-2 block text-sm text-[#727785]">
                  Preencha o cadastro completo, responsaveis, documentos e dados escolares.
                </span>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEnrollmentStartOpen(false)}
                className="rounded-lg border border-[#dfe3e8] px-4 py-2 text-sm font-medium text-[#727785]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
              {editingEnrollment
                ? 'Editar matrícula'
                : 'Nova matrícula'}
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
                  disabled={
                    Boolean(editingEnrollment) ||
                    isSubmitting
                  }
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

              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-sm font-medium text-gray-700">
                  Responsável (opcional)
                </legend>
                <p className="mb-3 text-xs text-gray-500">
                  Selecione um responsável já cadastrado para vincular ao aluno.
                  Você também poderá fazer isso depois.
                </p>
                <label
                  htmlFor="enrollment-guardian"
                  className="block text-sm font-medium text-gray-700"
                >
                  Responsável
                </label>
                <select
                  id="enrollment-guardian"
                  value={formData.guardian_profile_id}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      guardian_profile_id:
                        event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  disabled={
                    schoolUsersQuery.isLoading ||
                    isSubmitting
                  }
                >
                  <option value="">
                    {schoolUsersQuery.isLoading
                      ? 'Carregando responsáveis...'
                      : 'Nenhum agora'}
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

                {formData.guardian_profile_id && (
                  <>
                    <label
                      htmlFor="enrollment-guardian-relationship"
                      className="mt-3 block text-sm font-medium text-gray-700"
                    >
                      Parentesco
                    </label>
                    <input
                      id="enrollment-guardian-relationship"
                      value={
                        formData.guardian_relationship
                      }
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          guardian_relationship:
                            event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="Mãe, pai, avó, tutor..."
                      required
                      disabled={isSubmitting}
                    />
                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={
                          formData.guardian_is_primary
                        }
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            guardian_is_primary:
                              event.target.checked,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                      Responsável principal
                    </label>
                  </>
                )}

                {!schoolUsersQuery.isLoading &&
                  activeGuardians.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Nenhum responsável ativo encontrado. Cadastre o responsável em Usuários da Escola primeiro.
                    </p>
                  )}
              </fieldset>

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
                    : editingEnrollment
                      ? 'Salvar alterações'
                      : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGuardianLinkModalOpen && pendingGuardianLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guardian-link-modal-title"
        >
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="guardian-link-modal-title"
              className="mb-1 text-lg font-bold text-[#181c20]"
            >
              Vincular responsável
            </h3>
            <p className="mb-4 text-sm text-[#727785]">
              Aluno: <strong>{pendingGuardianLink.student_name}</strong>
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

              {schoolUsersQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  Não foi possível carregar os responsáveis desta instituição.
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="enrollment-guardian"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Responsável existente
                  </label>
                  <select
                    id="enrollment-guardian"
                    value={guardianLinkDraft.guardian_profile_id}
                    onChange={(event) =>
                      setGuardianLinkDraft((current) => ({
                        ...current,
                        guardian_profile_id: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                    disabled={schoolUsersQuery.isLoading}
                  >
                    <option value="">
                      {schoolUsersQuery.isLoading
                        ? 'Carregando...'
                        : 'Selecione'}
                    </option>
                    {activeGuardians.map((guardian) => (
                      <option
                        key={guardian.profile_id}
                        value={guardian.profile_id}
                      >
                        {guardian.profile?.full_name ?? guardian.profile?.email ?? 'Responsável'}
                        {guardian.profile?.email
                          ? ` (${guardian.profile.email})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {!schoolUsersQuery.isLoading &&
                    activeGuardians.length === 0 && (
                      <p className="mt-1 text-xs text-[#727785]">
                        Nenhum responsável ativo foi encontrado nesta instituição.
                      </p>
                    )}
                </div>
              )}

              <div>
                <label
                  htmlFor="enrollment-guardian-relationship"
                  className="block text-sm font-medium text-gray-700"
                >
                  Parentesco
                </label>
                <input
                  id="enrollment-guardian-relationship"
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

      {isFullWizardOpen && institutionId && (
        <FullStudentEnrollmentWizard
          institutionId={institutionId}
          years={years}
          classes={classes}
          onClose={() => setIsFullWizardOpen(false)}
          onCompleted={() => {
            setIsFullWizardOpen(false);
            setFeedbackMessage(
              'Cadastro completo e matricula realizados com sucesso.',
            );
          }}
        />
      )}
    </div>
  );
}
