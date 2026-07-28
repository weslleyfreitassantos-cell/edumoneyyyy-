import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import { useAuth } from '../../../contexts/AuthContext';

import { useAcademicYears } from '../../../hooks/useAcademicStructure';

import {
  useAssignments,
  useCreateAssignment,
  useSetAssignmentActive,
  useUpdateAssignment,
} from '../../../hooks/useAssignments';

import { useClasses } from '../../../hooks/useClasses';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useSubjects } from '../../../hooks/useSubjects';
import { useTeachers } from '../../../hooks/useTeachers';

import {
  subjectOfferingSchema,
  subjectOfferingUpdateSchema,
} from '../../../schemas/adminSchemas';

import type { TermRow } from '../../../services/academicStructureService';
import type { AssignmentRow } from '../../../services/assignmentService';

interface AssignmentDraft {
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  term_id: string;
  active: boolean;
}

interface TermOption extends TermRow {
  academic_year_name: string;
  academic_year_active: boolean;
}

const emptyDraft: AssignmentDraft = {
  class_id: '',
  subject_id: '',
  teacher_profile_id: '',
  term_id: '',
  active: true,
};

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    if (error.message.includes('CURRICULUM_COMPONENT_REQUIRED')) {
      return 'Adicione esta disciplina à matriz curricular da turma antes de atribuir um professor.';
    }
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const msg = (error as Record<string, unknown>).message as string;
    if (msg.includes('CURRICULUM_COMPONENT_REQUIRED')) {
      return 'Adicione esta disciplina à matriz curricular da turma antes de atribuir um professor.';
    }
    return msg;
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

export default function AssignmentsTab() {
  const { profile } = useAuth();

  const [searchParams] = useSearchParams();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const assignmentsQuery =
    useAssignments(institutionId);

  const classesQuery =
    useClasses(institutionId);

  const subjectsQuery =
    useSubjects(institutionId);

  const teachersQuery =
    useTeachers(institutionId);

  const yearsQuery =
    useAcademicYears(institutionId);

  const createMutation =
    useCreateAssignment();

  const updateMutation =
    useUpdateAssignment();

  const statusMutation =
    useSetAssignmentActive();

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [
    editingAssignment,
    setEditingAssignment,
  ] = useState<AssignmentRow | null>(null);

  const [formData, setFormData] =
    useState<AssignmentDraft>({
      ...emptyDraft,
    });

  const [
    teacherFilter,
    setTeacherFilter,
  ] = useState('all');

  const [
    classFilter,
    setClassFilter,
  ] = useState('all');

  const [
    subjectFilter,
    setSubjectFilter,
  ] = useState('all');

  const [
    termFilter,
    setTermFilter,
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

  useEffect(() => {
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    if (classId) setClassFilter(classId);
    if (subjectId) setSubjectFilter(subjectId);
  }, [searchParams]);

  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];
  const years = yearsQuery.data ?? [];

  const termOptions = useMemo<TermOption[]>(
    () =>
      years.flatMap((year) =>
        year.terms.map((term) => ({
          ...term,
          academic_year_name: year.name,
          academic_year_active:
            year.active,
        })),
      ),
    [years],
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

  const activeSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) => subject.active,
      ),
    [subjects],
  );

  const activeTeachers = useMemo(
    () =>
      teachers.filter(
        (teacher) =>
          teacher.active &&
          teacher.profiles?.active !== false,
      ),
    [teachers],
  );

  const classesForForm = useMemo(
    () =>
      editingAssignment
        ? classes.filter(
            (classRecord) =>
              classRecord.active ||
              classRecord.id ===
                editingAssignment.class_id,
          )
        : activeClasses,
    [
      activeClasses,
      classes,
      editingAssignment,
    ],
  );

  const subjectsForForm = useMemo(
    () =>
      editingAssignment
        ? subjects.filter(
            (subject) =>
              subject.active ||
              subject.id ===
                editingAssignment.subject_id,
          )
        : activeSubjects,
    [
      activeSubjects,
      editingAssignment,
      subjects,
    ],
  );

  const teachersForForm = useMemo(
    () =>
      editingAssignment
        ? teachers.filter(
            (teacher) =>
              teacher.active ||
              teacher.profile_id ===
                editingAssignment.teacher_profile_id,
          )
        : activeTeachers,
    [
      activeTeachers,
      editingAssignment,
      teachers,
    ],
  );

  const termsForForm = useMemo(() => {
    const selectedClass = classes.find(
      (classRecord) =>
        classRecord.id === formData.class_id,
    );

    if (!selectedClass) {
      return [];
    }

    return termOptions.filter(
      (term) =>
        term.academic_year_id ===
          selectedClass.academic_year_id &&
        ((term.active &&
          term.academic_year_active) ||
          term.id ===
            editingAssignment?.term_id),
    );
  }, [
    classes,
    editingAssignment?.term_id,
    formData.class_id,
    termOptions,
  ]);

  const filteredAssignments = useMemo(() => {
    const assignments =
      assignmentsQuery.data ?? [];

    return assignments.filter(
      (assignment) => {
        const matchesTeacher =
          teacherFilter === 'all' ||
          assignment.teacher_profile_id ===
            teacherFilter;

        const matchesClass =
          classFilter === 'all' ||
          assignment.class_id === classFilter;

        const matchesSubject =
          subjectFilter === 'all' ||
          assignment.subject_id ===
            subjectFilter;

        const matchesTerm =
          termFilter === 'all' ||
          assignment.term_id === termFilter;

        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' &&
            assignment.active) ||
          (statusFilter === 'inactive' &&
            !assignment.active);

        return (
          matchesTeacher &&
          matchesClass &&
          matchesSubject &&
          matchesTerm &&
          matchesStatus
        );
      },
    );
  }, [
    assignmentsQuery.data,
    classFilter,
    statusFilter,
    subjectFilter,
    teacherFilter,
    termFilter,
  ]);

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending;

  const columns: Column<AssignmentRow>[] = [
    {
      key: 'subject_name',
      label: 'Disciplina',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.subject_name}
          </p>
          <p className="mt-1 text-xs text-[#727785]">
            {row.subject_code ?? 'Sem código'}
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
      key: 'teacher_name',
      label: 'Professor',
      render: (_value, row) => (
        <div>
          <p className="font-medium text-[#181c20]">
            {row.teacher_name}
          </p>
          <p className="mt-1 break-all text-xs text-[#727785]">
            {row.teacher_email}
          </p>
        </div>
      ),
    },
    {
      key: 'term_name',
      label: 'Período',
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

  function getFirstActiveTermForClass(
    classId: string,
  ): string {
    const classRecord = classes.find(
      (item) => item.id === classId,
    );

    if (!classRecord) {
      return '';
    }

    return (
      termOptions.find(
        (term) =>
          term.academic_year_id ===
            classRecord.academic_year_id &&
          term.active &&
          term.academic_year_active,
      )?.id ?? ''
    );
  }

  function openCreateModal(): void {
    resetMessages();
    setEditingAssignment(null);

    const classId =
      activeClasses[0]?.id ?? '';

    setFormData({
      class_id: classId,
      subject_id:
        activeSubjects[0]?.id ?? '',
      teacher_profile_id:
        activeTeachers[0]?.profile_id ?? '',
      term_id:
        getFirstActiveTermForClass(classId),
      active: true,
    });

    setIsModalOpen(true);
  }

  function openEditModal(
    assignment: AssignmentRow,
  ): void {
    resetMessages();
    setEditingAssignment(assignment);
    setFormData({
      class_id: assignment.class_id,
      subject_id: assignment.subject_id,
      teacher_profile_id:
        assignment.teacher_profile_id,
      term_id: assignment.term_id,
      active: assignment.active,
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setEditingAssignment(null);
    setFormData({ ...emptyDraft });
    setModalError(null);
  }

  function handleClassChange(
    classId: string,
  ): void {
    setFormData((current) => ({
      ...current,
      class_id: classId,
      term_id:
        getFirstActiveTermForClass(classId),
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

    try {
      if (editingAssignment) {
        const result =
          subjectOfferingUpdateSchema.safeParse(
            formData,
          );

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await updateMutation.mutateAsync({
          id: editingAssignment.id,
          institutionId,
          data: result.data,
        });

        setFeedbackMessage(
          'Atribuição atualizada com sucesso.',
        );
      } else {
        const result =
          subjectOfferingSchema.safeParse({
            institution_id: institutionId,
            ...formData,
          });

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
          'Atribuição criada com sucesso.',
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
    assignment: AssignmentRow,
  ): Promise<void> {
    const nextActive = !assignment.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    if (
      !window.confirm(
        `Deseja ${action} a atribuição de ${assignment.subject_name} para ${assignment.class_name}?`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({
        id: assignment.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Atribuição reativada.'
          : 'Atribuição desativada.',
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
        assignmentsQuery.isError ||
        classesQuery.isError ||
        subjectsQuery.isError ||
        teachersQuery.isError ||
        yearsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              assignmentsQuery.error ??
                classesQuery.error ??
                subjectsQuery.error ??
                teachersQuery.error ??
                yearsQuery.error,
            )}
        </div>
      )}

      <section className="grid gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label
            htmlFor="assignment-teacher-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Professor
          </label>
          <select
            id="assignment-teacher-filter"
            value={teacherFilter}
            onChange={(event) =>
              setTeacherFilter(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {teachers.map((teacher) => (
              <option
                key={teacher.profile_id}
                value={teacher.profile_id}
              >
                {teacher.profiles?.full_name ??
                  teacher.profile_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="assignment-class-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Turma
          </label>
          <select
            id="assignment-class-filter"
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
            htmlFor="assignment-subject-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Disciplina
          </label>
          <select
            id="assignment-subject-filter"
            value={subjectFilter}
            onChange={(event) =>
              setSubjectFilter(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="assignment-term-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Período
          </label>
          <select
            id="assignment-term-filter"
            value={termFilter}
            onChange={(event) =>
              setTermFilter(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {termOptions.map((term) => (
              <option
                key={term.id}
                value={term.id}
              >
                {term.name} - {term.academic_year_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="assignment-status-filter"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <select
            id="assignment-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
        title="Atribuições"
        addLabel="Nova atribuição"
        data={filteredAssignments}
        columns={columns}
        isLoading={
          assignmentsQuery.isLoading ||
          classesQuery.isLoading ||
          subjectsQuery.isLoading ||
          teachersQuery.isLoading ||
          yearsQuery.isLoading
        }
        onAdd={openCreateModal}
        emptyMessage="Nenhuma atribuição encontrada para os filtros selecionados."
        renderActions={(assignment) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
              assignment.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  openEditModal(assignment)
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
                    assignment,
                  )
                }
                className={
                  assignment.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus
                  ? 'Salvando...'
                  : assignment.active
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
          aria-labelledby="assignment-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="assignment-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              {editingAssignment
                ? 'Editar atribuição'
                : 'Nova atribuição'}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="assignment-class"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Turma
                  </label>
                  <select
                    id="assignment-class"
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
                    {classesForForm.map(
                      (classRecord) => (
                        <option
                          key={classRecord.id}
                          value={classRecord.id}
                        >
                          {classRecord.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="assignment-term"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Período
                  </label>
                  <select
                    id="assignment-term"
                    value={formData.term_id}
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,
                          term_id:
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
                    {termsForForm.map((term) => (
                      <option
                        key={term.id}
                        value={term.id}
                      >
                        {term.name} - {term.academic_year_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="assignment-subject"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Disciplina
                  </label>
                  <select
                    id="assignment-subject"
                    value={formData.subject_id}
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,
                          subject_id:
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
                    {subjectsForForm.map(
                      (subject) => (
                        <option
                          key={subject.id}
                          value={subject.id}
                        >
                          {subject.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="assignment-teacher"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Professor
                  </label>
                  <select
                    id="assignment-teacher"
                    value={
                      formData.teacher_profile_id
                    }
                    onChange={(event) =>
                      setFormData(
                        (current) => ({
                          ...current,
                          teacher_profile_id:
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
                    {teachersForForm.map(
                      (teacher) => (
                        <option
                          key={teacher.profile_id}
                          value={
                            teacher.profile_id
                          }
                        >
                          {teacher.profiles
                            ?.full_name ??
                            teacher.profile_id}
                        </option>
                      ),
                    )}
                  </select>
                </div>
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
