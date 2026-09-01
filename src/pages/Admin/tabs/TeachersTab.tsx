import {
  useEffect,
  useMemo,
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
import { Upload } from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  useCreateTeacher,
  useSetTeacherActive,
  useTeachers,
} from '../../../hooks/useTeachers';
import { useSubjects } from '../../../hooks/useSubjects';
import {
  useSaveTeacherAcademicSettings,
  useSaveTeacherAvailability,
  useSchoolTimeSlots,
} from '../../../hooks/useAcademicAutomation';
import TeacherAcademicSettings from '../../../components/academic/TeacherAcademicSettings';
import { suggestTeacherAvailabilityFromSchoolSlots } from '../../../services/academicAutomationService';
import TeacherSpreadsheetImportModal from '../../../components/TeacherSpreadsheetImportModal';

import { teacherSchema } from '../../../schemas/adminSchemas';

import type { TeacherRow } from '../../../services/teacherService';

interface TeacherDraft {
  full_name: string;
  email: string;
  subject_ids: string[];
  primary_subject_id: string;
}

const emptyDraft: TeacherDraft = {
  full_name: '',
  email: '',
  subject_ids: [],
  primary_subject_id: '',
};

const TEACHERS_PAGE_SIZE = 6;

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
  const subjectsQuery = useSubjects(institutionId);

  const createMutation =
    useCreateTeacher();

  const statusMutation =
    useSetTeacherActive();
  const academicSettingsMutation =
    useSaveTeacherAcademicSettings();
  const availabilityMutation =
    useSaveTeacherAvailability();
  const schoolTimeSlotsQuery =
    useSchoolTimeSlots(institutionId);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isSpreadsheetImportOpen, setIsSpreadsheetImportOpen] =
    useState(false);

  const [formData, setFormData] =
    useState<TeacherDraft>({
      ...emptyDraft,
    });

  const [settingsTeacher, setSettingsTeacher] =
    useState<{
      profileId: string;
      name: string;
      subjectIds?: string[];
      primarySubjectId?: string;
    } | null>(null);

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

  const subjectCoverage = useMemo(() => {
    const activeTeachers = (teachersQuery.data ?? []).filter(
      (teacher) => teacher.active && teacher.profiles?.active !== false,
    );
    const teacherCountBySubject = new Map<string, number>();

    for (const teacher of activeTeachers) {
      for (const subject of teacher.subjects) {
        teacherCountBySubject.set(
          subject.id,
          (teacherCountBySubject.get(subject.id) ?? 0) + 1,
        );
      }
    }

    return (subjectsQuery.data ?? [])
      .filter((subject) => subject.active)
      .map((subject) => ({
        ...subject,
        teacherCount: teacherCountBySubject.get(subject.id) ?? 0,
      }));
  }, [subjectsQuery.data, teachersQuery.data]);

  const teachers = teachersQuery.data ?? [];
  const filteredTeachers = useMemo(() => {
    const query = normalizeListSearch(searchTerm);

    if (!query) {
      return teachers;
    }

    return teachers.filter((teacher) =>
      normalizeListSearch([
        teacher.profiles?.full_name,
        teacher.profiles?.email,
        ...teacher.subjects.map((subject) => subject.name),
      ].filter(Boolean).join(' ')).includes(query),
    );
  }, [searchTerm, teachers]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTeachers.length / TEACHERS_PAGE_SIZE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * TEACHERS_PAGE_SIZE,
    currentPage * TEACHERS_PAGE_SIZE,
  );

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
      key: 'subjects',
      label: 'Disciplinas vinculadas',
      render: (_value, row) => (
        row.subjects.length > 0 ? (
          <div className="flex max-w-xs flex-wrap gap-1">
            {row.subjects.map((subject) => (
              <span
                key={subject.id}
                className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800"
              >
                {subject.name}{subject.primary ? ' · principal' : ''}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-amber-700">Nenhuma vinculada</span>
        )
      ),
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

    if (formData.subject_ids.length === 0) {
      setModalError(
        'Selecione pelo menos uma disciplina para vincular ao professor.',
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

      await academicSettingsMutation.mutateAsync({
        institution_id: institutionId,
        teacher_profile_id: createdTeacher.profile_id,
        subject_ids: formData.subject_ids,
        primary_subject_id:
          formData.primary_subject_id || undefined,
        availability: [],
      });

      closeModal();

      setSettingsTeacher({
        profileId: createdTeacher.profile_id,
        name: createdTeacher.full_name,
        subjectIds: formData.subject_ids,
        primarySubjectId: formData.primary_subject_id,
      });

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

  async function handleApplySchoolAvailability(): Promise<void> {
    resetMessages();
    const activeTeachers = (teachersQuery.data ?? []).filter(
      (teacher) => teacher.active && teacher.profiles?.active !== false,
    );
    const suggestions = suggestTeacherAvailabilityFromSchoolSlots(
      schoolTimeSlotsQuery.data ?? [],
    );

    if (activeTeachers.length === 0) {
      setPageError('Nenhum professor ativo encontrado nesta instituição.');
      return;
    }
    if (suggestions.length === 0) {
      setPageError('Cadastre os horários da escola antes de aplicar a disponibilidade.');
      return;
    }

    const confirmed = window.confirm(
      `Aplicar os horários ativos da escola a ${activeTeachers.length} professor(es)? A disponibilidade atual será substituída; depois você poderá ajustar exceções individualmente.`,
    );
    if (!confirmed) return;

    let updatedCount = 0;
    try {
      for (const teacher of activeTeachers) {
        await availabilityMutation.mutateAsync({
          institution_id: institutionId,
          teacher_profile_id: teacher.profile_id,
          availability: suggestions,
        });
        updatedCount += 1;
      }
      setFeedbackMessage(`Disponibilidade aplicada a ${updatedCount} professor(es). Revise as exceções antes de publicar a grade.`);
    } catch (error) {
      setPageError(
        `A aplicação foi interrompida após ${updatedCount} professor(es). ${getErrorMessage(error)}`,
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
        teachersQuery.isError ||
        subjectsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              teachersQuery.error ??
                subjectsQuery.error,
            )}
        </div>
      )}

      {subjectCoverage.length > 0 && (
        <section className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-[#181c20]">Cobertura das disciplinas</h3>
              <p className="mt-1 text-sm text-gray-500">Cada disciplina precisa de pelo menos um professor ativo vinculado.</p>
            </div>
            <span className="text-sm text-gray-600">
              {subjectCoverage.filter((subject) => subject.teacherCount > 0).length}/{subjectCoverage.length} cobertas
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subjectCoverage.map((subject) => (
              <div key={subject.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-800">{subject.name}</span>
                <span className={subject.teacherCount > 0 ? 'shrink-0 text-xs font-semibold text-green-700' : 'shrink-0 text-xs font-semibold text-amber-700'}>
                  {subject.teacherCount > 0 ? `${subject.teacherCount} professor(es)` : 'Sem professor'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#181c20]">Disponibilidade dos professores</h3>
            <p className="mt-1 text-sm text-gray-500">Preencha em lote com os horários ativos da escola e ajuste apenas quem tiver uma jornada diferente.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleApplySchoolAvailability()}
            disabled={
              availabilityMutation.isPending ||
              schoolTimeSlotsQuery.isLoading ||
              schoolTimeSlotsQuery.isError ||
              schoolTimeSlotsQuery.data?.length === 0 ||
              teachersQuery.isLoading
            }
            className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {availabilityMutation.isPending ? 'Aplicando...' : 'Aplicar aos professores ativos'}
          </button>
        </div>
        {schoolTimeSlotsQuery.isError && <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar os horários da escola.</p>}
        {!schoolTimeSlotsQuery.isLoading && !schoolTimeSlotsQuery.isError && schoolTimeSlotsQuery.data?.length === 0 && <p className="mt-3 text-sm text-amber-700">Cadastre pelo menos um horário da escola para habilitar o preenchimento em lote.</p>}
      </section>

      <ListSearch
        id="teachers-search"
        label="Buscar professor"
        placeholder="Nome, e-mail ou disciplina"
        value={searchTerm}
        onChange={setSearchTerm}
      />

      <DataTable
        title="Professores"
        addLabel="Novo professor"
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
        data={paginatedTeachers}
        columns={columns}
        isLoading={teachersQuery.isLoading}
        onAdd={openCreateModal}
        emptyMessage={
          filteredTeachers.length === 0 && teachers.length > 0
            ? 'Nenhum professor encontrado.'
            : 'Nenhum professor cadastrado nesta instituição.'
        }
        renderActions={(teacher) => {
          const isChangingStatus =
            statusMutation.isPending &&
            statusMutation.variables?.id ===
              teacher.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSettingsTeacher({ profileId: teacher.profile_id, name: getTeacherName(teacher) })}
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Disciplinas e disponibilidade
              </button>
              <button
                type="button"
                onClick={() => void handleToggleStatus(teacher)}
                disabled={isChangingStatus}
                className={
                  teacher.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus ? 'Salvando...' : teacher.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          );
        }}
      />

      <ListPagination
        page={currentPage}
        pageSize={TEACHERS_PAGE_SIZE}
        totalItems={filteredTeachers.length}
        onPageChange={setCurrentPage}
      />

      {isSpreadsheetImportOpen && institutionId && (
        <TeacherSpreadsheetImportModal
          institutionId={institutionId}
          subjects={subjectsQuery.data ?? []}
          onClose={() => setIsSpreadsheetImportOpen(false)}
          onImported={(result) => {
            void teachersQuery.refetch();
            setFeedbackMessage(
              `${result.succeeded.length} professor(es) importado(s).${result.failed.length > 0 ? ` ${result.failed.length} linha(s) precisam de revisão.` : ''}`,
            );
          }}
        />
      )}

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
                <div className="flex items-center justify-between gap-3">
                  <p className="block text-sm font-medium text-gray-700">
                    Disciplinas vinculadas ao professor
                  </p>
                  <span className="text-xs text-gray-500">
                    {formData.subject_ids.length} selecionada(s)
                  </span>
                </div>
                <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                  {(subjectsQuery.data ?? [])
                    .filter((subject) => subject.active)
                    .map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.subject_ids.includes(subject.id)}
                          onChange={() =>
                            setFormData((current) => ({
                              ...current,
                              subject_ids: current.subject_ids.includes(subject.id)
                                ? current.subject_ids.filter((id) => id !== subject.id)
                                : [...current.subject_ids, subject.id],
                              primary_subject_id: current.primary_subject_id === subject.id
                                ? ''
                                : current.primary_subject_id,
                            }))
                          }
                        />
                        <span>{subject.name}</span>
                        {formData.subject_ids.includes(subject.id) && (
                          <button
                            type="button"
                            className="ml-auto text-xs text-blue-700"
                            onClick={() => setFormData((current) => ({ ...current, primary_subject_id: subject.id }))}
                          >
                            {formData.primary_subject_id === subject.id ? 'Principal' : 'Definir principal'}
                          </button>
                        )}
                      </label>
                    ))}
                  {subjectsQuery.data?.length === 0 && (
                    <p className="text-xs text-gray-500">Cadastre disciplinas antes de vincular habilidades.</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">A disponibilidade semanal e configurada no proximo passo.</p>
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

      {settingsTeacher && (
        <TeacherAcademicSettings
          institutionId={institutionId}
          teacherProfileId={settingsTeacher.profileId}
          teacherName={settingsTeacher.name}
          initialSubjectIds={settingsTeacher.subjectIds}
          initialPrimarySubjectId={settingsTeacher.primarySubjectId}
          onClose={() => setSettingsTeacher(null)}
        />
      )}
    </div>
  );
}
