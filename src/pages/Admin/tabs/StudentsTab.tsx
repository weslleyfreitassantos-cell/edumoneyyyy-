import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  Upload,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import {
  ListPagination,
  ListSearch,
  normalizeListSearch,
} from '../../../components/ListControls';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import { useManageSchoolUser } from '../../../hooks/useSchoolUserManagement';

import {
  useEnrollments,
} from '../../../hooks/useEnrollments';

import {
  useSetStudentActive,
  useStudents,
} from '../../../hooks/useStudents';

import { guardianLinkSchema } from '../../../schemas/adminSchemas';

import type { EnrollmentRow } from '../../../services/enrollmentService';
import type { StudentRow } from '../../../services/studentService';
import FullStudentEnrollmentWizard from './FullStudentEnrollmentWizard';
import StudentSpreadsheetImportModal from '../../../components/StudentSpreadsheetImportModal';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';

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

const STUDENTS_PAGE_SIZE = 6;

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(error, 'Não foi possível concluir a operação.');
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

function getCurrentEnrollmentByStudent(
  enrollments: EnrollmentRow[],
): Map<string, EnrollmentRow> {
  const currentByStudent = new Map<string, EnrollmentRow>();

  for (const enrollment of enrollments.filter(
    (item) => item.active && item.status.trim().toLowerCase() === 'active',
  )) {
    const current = currentByStudent.get(enrollment.student_id);
    if (!current) {
      currentByStudent.set(enrollment.student_id, enrollment);
      continue;
    }

    const shouldReplace = enrollment.active && !current.active;
    const enrollmentDate = enrollment.enrolled_at ?? enrollment.created_at ?? '';
    const currentDate = current.enrolled_at ?? current.created_at ?? '';

    if (
      shouldReplace ||
      (enrollment.active === current.active &&
        enrollmentDate > currentDate)
    ) {
      currentByStudent.set(enrollment.student_id, enrollment);
    }
  }

  return currentByStudent;
}

export default function StudentsTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const studentsQuery =
    useStudents(institutionId);

  const enrollmentsQuery =
    useEnrollments(institutionId);

  const yearsQuery =
    useAcademicYears(institutionId);

  const classesQuery =
    useClasses(institutionId);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isFullWizardOpen, setIsFullWizardOpen] =
    useState(false);

  const [isSpreadsheetImportOpen, setIsSpreadsheetImportOpen] =
    useState(false);

  const [fullEditStudentId, setFullEditStudentId] =
    useState<string | null>(null);

  const [enrollStudentId, setEnrollStudentId] =
    useState<string | null>(null);

  const [
    pageError,
    setPageError,
  ] = useState<string | null>(null);

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState<string | null>(null);

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

  const students = studentsQuery.data ?? [];
  const currentEnrollmentByStudent = useMemo(
    () => getCurrentEnrollmentByStudent(enrollmentsQuery.data ?? []),
    [enrollmentsQuery.data],
  );
  const filteredStudents = useMemo(() => {
    const query = normalizeListSearch(searchTerm);

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      normalizeListSearch([
        student.registration_number,
        student.profiles?.full_name,
        student.profiles?.email,
        student.cpf,
        currentEnrollmentByStudent.get(student.id)?.class_name,
        currentEnrollmentByStudent.get(student.id)?.academic_year_name,
        currentEnrollmentByStudent.get(student.id)?.status_label,
      ].filter(Boolean).join(' ')).includes(query),
    );
  }, [currentEnrollmentByStudent, searchTerm, students]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / STUDENTS_PAGE_SIZE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PAGE_SIZE,
    currentPage * STUDENTS_PAGE_SIZE,
  );

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
      id: 'student-enrollment',
      key: 'id',
      label: 'Matrícula atual',
      render: (_value, row) => {
        const enrollment = currentEnrollmentByStudent.get(row.id);

        if (!enrollment) {
          return (
            <div className="min-w-[150px]">
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Não matriculado
              </span>
              {row.active && (
                <button
                  type="button"
                  className="mt-2 block text-xs font-semibold text-blue-700 hover:underline"
                  onClick={() => setEnrollStudentId(row.id)}
                >
                  Matricular aluno
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="min-w-[150px]">
            <p className="font-medium text-[#181c20]">
              {enrollment.class_name}
            </p>
            <p className="mt-1 text-xs text-[#727785]">
              {enrollment.academic_year_name}
              {enrollment.class_shift
                ? ` • ${enrollment.class_shift}`
                : ''}
            </p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              enrollment.active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {enrollment.status_label}
            </span>
          </div>
        );
      },
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
    setPageError(null);
    setFeedbackMessage(null);
  }

  function openFullWizard(): void {
    resetMessages();
    setIsFullWizardOpen(true);
  }

  function openEditModal(
    student: StudentRow,
  ): void {
    resetMessages();
    setFullEditStudentId(student.id);
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
        studentsQuery.isError ||
        enrollmentsQuery.isError) && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {pageError ??
              getErrorMessage(
                studentsQuery.error ??
                  enrollmentsQuery.error,
              )}
          </div>
        )}

      <ListSearch
        id="students-search"
        label="Buscar aluno"
        placeholder="Nome, e-mail, RA ou CPF"
        value={searchTerm}
        onChange={setSearchTerm}
      />

      <DataTable
        title="Alunos"
        addLabel="Novo aluno"
        extraHeaderActions={(
          <button
            type="button"
            onClick={() => setIsSpreadsheetImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            <Upload size={16} aria-hidden="true" />
            Importar Excel
          </button>
        )}
        data={paginatedStudents}
        columns={columns}
        isLoading={
          studentsQuery.isLoading ||
          enrollmentsQuery.isLoading
        }
        onAdd={openFullWizard}
        emptyMessage={
          filteredStudents.length === 0 && students.length > 0
            ? 'Nenhum aluno encontrado.'
            : 'Nenhum aluno cadastrado nesta instituição.'
        }
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

      <ListPagination
        page={currentPage}
        pageSize={STUDENTS_PAGE_SIZE}
        totalItems={filteredStudents.length}
        onPageChange={setCurrentPage}
      />

      {isFullWizardOpen && institutionId && (
        <FullStudentEnrollmentWizard
          institutionId={institutionId}
          years={yearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          onClose={() => setIsFullWizardOpen(false)}
          onCompleted={() => {
            setIsFullWizardOpen(false);
            setFeedbackMessage('Cadastro completo e matrícula realizados com sucesso.');
          }}
        />
      )}

      {isSpreadsheetImportOpen && institutionId && (
        <StudentSpreadsheetImportModal
          institutionId={institutionId}
          years={yearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          onClose={() => setIsSpreadsheetImportOpen(false)}
          onImported={(result) => {
            void studentsQuery.refetch();
            void enrollmentsQuery.refetch();
            setFeedbackMessage(
              `${result.succeeded.length} aluno(s) importado(s).${result.failed.length > 0 ? ` ${result.failed.length} linha(s) precisam de revisão.` : ''}${result.emailPending.length > 0 ? ` ${result.emailPending.length} acesso(s) ficaram sem e-mail.` : ''}`,
            );
          }}
        />
      )}

      {fullEditStudentId && institutionId && (
        <FullStudentEnrollmentWizard
          institutionId={institutionId}
          years={yearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          mode="edit"
          studentId={fullEditStudentId}
          onClose={() => setFullEditStudentId(null)}
          onCompleted={() => {
            setFullEditStudentId(null);
            setFeedbackMessage('Cadastro completo do aluno atualizado com sucesso.');
          }}
        />
      )}

      {enrollStudentId && institutionId && (
        <FullStudentEnrollmentWizard
          institutionId={institutionId}
          years={yearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          mode="enroll"
          studentId={enrollStudentId}
          onClose={() => setEnrollStudentId(null)}
          onCompleted={() => {
            setEnrollStudentId(null);
            setFeedbackMessage('Matrícula realizada com sucesso.');
          }}
        />
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
