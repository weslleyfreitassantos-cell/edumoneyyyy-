import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { DataTable, type Column } from '../../../components/DataTable';
import CurriculumTemplatePanel from '../../../components/academic/CurriculumTemplatePanel';

import { useAuth } from '../../../contexts/AuthContext';

import { useAcademicYears } from '../../../hooks/useAcademicStructure';
import { useClasses } from '../../../hooks/useClasses';
import { useSubjects } from '../../../hooks/useSubjects';
import {
  useCurriculum,
  useCreateCurriculumItem,
  useUpdateCurriculumItem,
  useSetCurriculumItemActive,
} from '../../../hooks/useCurriculum';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  curriculumCreateSchema,
  curriculumUpdateSchema,
  curriculumService,
  type CurriculumItemRow,
  type CurriculumTeacherInfo,
} from '../../../services/curriculumService';

interface ItemDraft {
  class_id: string;
  subject_id: string;
  weekly_lessons: string;
  lesson_duration_minutes: string;
}

interface TeachersByTerm {
  [termName: string]: string | null;
}

const emptyDraft: ItemDraft = {
  class_id: '',
  subject_id: '',
  weekly_lessons: '2',
  lesson_duration_minutes: '50',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string') return (error as Record<string, unknown>).message as string;
  return 'Não foi possível concluir a operação.';
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
          : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'
      }
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function toCreatePayload(institutionId: string, draft: ItemDraft) {
  return {
    institution_id: institutionId,
    class_id: draft.class_id,
    subject_id: draft.subject_id,
    weekly_lessons: Number(draft.weekly_lessons),
    lesson_duration_minutes: Number(draft.lesson_duration_minutes),
  };
}

export default function CurriculumTab() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';

  const yearsQuery = useAcademicYears(institutionId);
  const classesQuery = useClasses(institutionId);
  const subjectsQuery = useSubjects(institutionId);
  const curriculumQuery = useCurriculum(institutionId);

  const createMutation = useCreateCurriculumItem();
  const updateMutation = useUpdateCurriculumItem();
  const statusMutation = useSetCurriculumItemActive();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumItemRow | null>(null);
  const [formData, setFormData] = useState<ItemDraft>({ ...emptyDraft });

  const [yearFilter, setYearFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const classId = searchParams.get('classId');
    if (classId) setClassFilter(classId);
  }, [searchParams]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);

  const [teachersCache, setTeachersCache] = useState<Record<string, TeachersByTerm>>({});

  const years = yearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];

  const filteredItems = useMemo(() => {
    const items = curriculumQuery.data ?? [];
    return items.filter((item) => {
      const matchesYear = yearFilter === 'all' || item.academic_year_id === yearFilter;
      const matchesClass = classFilter === 'all' || item.class_id === classFilter;
      return matchesYear && matchesClass;
    });
  }, [curriculumQuery.data, yearFilter, classFilter]);

  const totalWeeklyMinutes = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.weekly_minutes, 0);
  }, [filteredItems]);

  const yearsForClassFilter = useMemo(() => {
    const classYears = new Set(classes.map((c) => c.academic_year_id));
    return years.filter((y) => classYears.has(y.id));
  }, [years, classes]);

  const filteredClasses = useMemo(() => {
    if (yearFilter === 'all') return classes;
    return classes.filter((c) => c.academic_year_id === yearFilter);
  }, [classes, yearFilter]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => s.active);
  }, [subjects]);

  const addedSubjectIds = useMemo(() => {
    const selectedClassId = editingItem ? editingItem.class_id : formData.class_id;
    if (!selectedClassId) return new Set<string>();
    return new Set(
      (curriculumQuery.data ?? [])
        .filter((item) => item.class_id === selectedClassId && item.id !== editingItem?.id)
        .map((item) => item.subject_id),
    );
  }, [curriculumQuery.data, formData.class_id, editingItem]);

  const availableSubjects = useMemo(() => {
    return filteredSubjects.filter((s) => !addedSubjectIds.has(s.id));
  }, [filteredSubjects, addedSubjectIds]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function loadTeachers(item: CurriculumItemRow): Promise<void> {
    if (teachersCache[item.id]) return;
    try {
      const teachers = await curriculumService.getTeachersByItem(institutionId, item.class_id, item.subject_id);
      const byTerm: TeachersByTerm = {};
      for (const t of teachers) {
        byTerm[t.term_name] = t.teacher_profile_id ?? null;
      }
      setTeachersCache((prev) => ({ ...prev, [item.id]: byTerm }));
    } catch {
      // Silently fail — teachers column will show error indicator
    }
  }

  const allTermNames = useMemo(() => {
    const names = new Set<string>();
    for (const cache of Object.values(teachersCache)) {
      for (const name of Object.keys(cache)) {
        names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [teachersCache]);

  const columns: Column<CurriculumItemRow>[] = [
    {
      key: 'class_name',
      label: 'Turma',
    },
    {
      key: 'subject_name',
      label: 'Disciplina',
    },
    {
      key: 'weekly_lessons',
      label: 'Aulas/sem',
    },
    {
      key: 'lesson_duration_minutes',
      label: 'Duração (min)',
    },
    {
      key: 'weekly_minutes',
      label: 'Carga horária semanal',
      render: (_value, row) => `${row.weekly_minutes} min`,
    },
    ...allTermNames.map((termName) => ({
      key: `teacher_${termName}` as string,
      label: termName,
      render: (_value: unknown, row: CurriculumItemRow) => {
        const teachers = teachersCache[row.id];
        if (!teachers) {
          return (
            <button
              type="button"
              onClick={() => void loadTeachers(row)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Carregar
            </button>
          );
        }
        return (
          <span className="text-xs text-[#727785]">
            {teachers[termName] ?? '—'}
          </span>
        );
      },
    })),
    {
      key: 'active',
      label: 'Status',
      render: (_value, row) => <StatusBadge active={row.active} />,
    },
  ];

  function resetMessages(): void {
    setModalError(null);
    setPageError(null);
    setFeedbackMessage(null);
  }

  function openCreateModal(): void {
    resetMessages();
    setEditingItem(null);
    setFormData({ ...emptyDraft, class_id: classFilter !== 'all' ? classFilter : '' });
    setIsModalOpen(true);
  }

  function openEditModal(item: CurriculumItemRow): void {
    resetMessages();
    setEditingItem(item);
    setFormData({
      class_id: item.class_id,
      subject_id: item.subject_id,
      weekly_lessons: String(item.weekly_lessons),
      lesson_duration_minutes: String(item.lesson_duration_minutes),
    });
    setIsModalOpen(true);
  }

  function closeModal(): void {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ ...emptyDraft });
    setModalError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setModalError(null);

    if (!institutionId) {
      setModalError('A instituição não foi carregada.');
      return;
    }

    try {
      if (editingItem) {
        const result = curriculumUpdateSchema.safeParse({
          weekly_lessons: Number(formData.weekly_lessons),
          lesson_duration_minutes: Number(formData.lesson_duration_minutes),
        });

        if (!result.success) {
          setModalError(result.error.issues[0]?.message ?? 'Dados inválidos.');
          return;
        }

        await updateMutation.mutateAsync({
          id: editingItem.id,
          institutionId,
          data: result.data,
        });

        setFeedbackMessage('Item da matriz atualizado com sucesso.');
      } else {
        const payload = toCreatePayload(institutionId, formData);
        const result = curriculumCreateSchema.safeParse(payload);

        if (!result.success) {
          setModalError(result.error.issues[0]?.message ?? 'Dados inválidos.');
          return;
        }

        await createMutation.mutateAsync(result.data);
        setFeedbackMessage('Item da matriz criado com sucesso.');
      }

      closeModal();
    } catch (error) {
      setModalError(getErrorMessage(error));
    }
  }

  async function handleToggleStatus(item: CurriculumItemRow): Promise<void> {
    const nextActive = !item.active;
    const action = nextActive ? 'reativar' : 'desativar';

    if (!window.confirm(`Deseja ${action} o item da matriz para a disciplina ${item.subject_name}?`)) return;

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await statusMutation.mutateAsync({ id: item.id, institutionId, active: nextActive });
      setFeedbackMessage(nextActive ? 'Item reativado.' : 'Item desativado.');
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  function handleNavigateToAssignments(item: CurriculumItemRow): void {
    navigate(`/admin?tab=assignments&classId=${item.class_id}&subjectId=${item.subject_id}`);
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
        {getErrorMessage(institutionQuery.error)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackMessage && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedbackMessage}
        </div>
      )}

      {(pageError || curriculumQuery.isError) && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError ?? getErrorMessage(curriculumQuery.error)}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="curriculum-year-filter" className="block text-sm font-medium text-gray-700">
            Ano letivo
          </label>
          <select
            id="curriculum-year-filter"
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setClassFilter('all');
            }}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {yearsForClassFilter.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="curriculum-class-filter" className="block text-sm font-medium text-gray-700">
            Turma
          </label>
          <select
            id="curriculum-class-filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {filteredItems.length > 0 && (
        <div className="rounded-xl border border-[#dfe3e8] bg-white p-4 text-sm">
          <span className="font-semibold text-[#181c20]">Carga horária semanal total: </span>
          <span className="text-[#005bbf] font-bold">{totalWeeklyMinutes} min</span>
          <span className="text-[#727785]"> ({Math.round(totalWeeklyMinutes / 60)}h{totalWeeklyMinutes % 60 > 0 ? `${totalWeeklyMinutes % 60}min` : ''})</span>
        </div>
      )}

      <DataTable
        title="Matriz curricular"
        addLabel="Adicionar disciplina"
        data={filteredItems}
        columns={columns}
        isLoading={curriculumQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading}
        onAdd={openCreateModal}
        extraHeaderActions={<button type="button" onClick={() => setIsTemplatePanelOpen(true)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Modelos de matriz</button>}
        emptyMessage="Nenhum item encontrado para os filtros selecionados."
        renderActions={(item) => {
          const isChangingStatus = statusMutation.isPending && statusMutation.variables?.id === item.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              {item.needs_review && (
                <span className="text-xs font-semibold text-amber-600">Revisão pendente</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTeachersCache({});
                  openEditModal(item);
                }}
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleNavigateToAssignments(item)}
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Atribuições
              </button>
              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() => void handleToggleStatus(item)}
                className={
                  item.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus ? 'Salvando...' : item.active ? 'Desativar' : 'Reativar'}
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
          aria-labelledby="curriculum-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 id="curriculum-modal-title" className="mb-4 text-lg font-bold text-[#181c20]">
              {editingItem ? 'Editar item da matriz' : 'Adicionar disciplina à matriz'}
            </h3>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {modalError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              {editingItem ? (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  <p><strong>Turma:</strong> {editingItem.class_name}</p>
                  <p><strong>Disciplina:</strong> {editingItem.subject_name}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="curriculum-class" className="block text-sm font-medium text-gray-700">Turma</label>
                    <select
                      id="curriculum-class"
                      value={formData.class_id}
                      onChange={(e) => setFormData((curr) => ({ ...curr, class_id: e.target.value, subject_id: '' }))}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="">Selecione</option>
                      {filteredClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="curriculum-subject" className="block text-sm font-medium text-gray-700">Disciplina</label>
                    <select
                      id="curriculum-subject"
                      value={formData.subject_id}
                      onChange={(e) => setFormData((curr) => ({ ...curr, subject_id: e.target.value }))}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="">Selecione</option>
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="curriculum-weekly-lessons" className="block text-sm font-medium text-gray-700">Aulas por semana</label>
                  <input
                    id="curriculum-weekly-lessons"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={formData.weekly_lessons}
                    onChange={(e) => setFormData((curr) => ({ ...curr, weekly_lessons: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="curriculum-duration" className="block text-sm font-medium text-gray-700">Duração por aula (min)</label>
                  <input
                    id="curriculum-duration"
                    type="number"
                    min="15"
                    max="180"
                    step="5"
                    value={formData.lesson_duration_minutes}
                    onChange={(e) => setFormData((curr) => ({ ...curr, lesson_duration_minutes: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
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
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTemplatePanelOpen && <CurriculumTemplatePanel institutionId={institutionId} subjects={subjects} classes={classes} onClose={() => setIsTemplatePanelOpen(false)} />}
    </div>
  );
}
