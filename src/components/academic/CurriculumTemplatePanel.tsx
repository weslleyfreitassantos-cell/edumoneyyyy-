import { useMemo, useState } from 'react';
import { Check, Info, Search, X } from 'lucide-react';

import {
  useApplyCurriculumTemplate,
  useCreateCurriculumTemplate,
  useCurriculumTemplates,
} from '../../hooks/useAcademicAutomation';
import type { ClassRow } from '../../services/classService';
import type { SubjectRow } from '../../services/subjectService';

interface CurriculumTemplatePanelProps {
  institutionId: string;
  subjects: SubjectRow[];
  classes: ClassRow[];
  onClose: () => void;
}

export default function CurriculumTemplatePanel({
  institutionId,
  subjects,
  classes,
  onClose,
}: CurriculumTemplatePanelProps) {
  const templatesQuery = useCurriculumTemplates(institutionId);
  const createMutation = useCreateCurriculumTemplate();
  const applyMutation = useApplyCurriculumTemplate();
  const [name, setName] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => subject.active),
    [subjects],
  );
  const activeClasses = useMemo(
    () => classes.filter((classRecord) => classRecord.active),
    [classes],
  );
  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return activeSubjects;
    return activeSubjects.filter((subject) =>
      subject.name.toLocaleLowerCase('pt-BR').includes(query),
    );
  }, [activeSubjects, subjectSearch]);
  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return activeClasses;
    return activeClasses.filter((classRecord) =>
      classRecord.name.toLocaleLowerCase('pt-BR').includes(query),
    );
  }, [activeClasses, classSearch]);
  const templates = templatesQuery.data ?? [];

  function toggleSelection(
    id: string,
    setSelectedIds: (next: (current: string[]) => string[]) => void,
  ) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleAll(
    ids: string[],
    selectedIds: string[],
    setSelectedIds: (next: (current: string[]) => string[]) => void,
  ) {
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  }

  async function createTemplate(): Promise<void> {
    setError(null);
    setMessage(null);
    try {
      await createMutation.mutateAsync({
        institution_id: institutionId,
        name,
        items: selectedSubjectIds.map((subject_id) => ({
          subject_id,
          weekly_lessons: 1,
          lesson_duration_minutes: 50,
        })),
      });
      setName('');
      setSelectedSubjectIds([]);
      setMessage('Modelo salvo.');
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Não foi possível salvar o modelo.',
      );
    }
  }

  async function applyTemplate(templateId: string): Promise<void> {
    setError(null);
    setMessage(null);
    try {
      const count = await applyMutation.mutateAsync({
        institution_id: institutionId,
        template_id: templateId,
        class_ids: selectedClassIds,
      });
      setMessage(`${count} item(ns) aplicados sem duplicatas.`);
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : 'Não foi possível aplicar o modelo.',
      );
    }
  }

  function selectAllSubjects() {
    toggleAll(
      filteredSubjects.map((subject) => subject.id),
      selectedSubjectIds,
      setSelectedSubjectIds,
    );
  }

  function selectAllClasses() {
    toggleAll(
      filteredClasses.map((classRecord) => classRecord.id),
      selectedClassIds,
      setSelectedClassIds,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="curriculum-template-title"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-[#eaecf0] pb-4">
          <div>
            <h3
              id="curriculum-template-title"
              className="text-lg font-bold text-[#181c20]"
            >
              Modelos de matriz
            </h3>
            <p className="mt-1 text-sm text-[#667085]">
              Crie uma matriz e aplique-a às turmas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#f2f4f7] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {message && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            {message}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-[#d8deea] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-[#181c20]">Criar modelo</h4>
                <p className="mt-1 text-xs text-[#667085]">
                  Selecione as disciplinas da matriz.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[#005bbf]">
                {selectedSubjectIds.length} selecionadas
              </span>
            </div>

            <label className="sr-only" htmlFor="curriculum-template-name">
              Nome do modelo
            </label>
            <input
              id="curriculum-template-name"
              aria-label="Nome do modelo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do modelo (ex.: 7º ano padrão)"
              className="mt-4 w-full rounded-lg border border-[#d0d5dd] px-3 py-2 text-sm outline-none placeholder:text-[#98a2b3] focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <h5 className="text-sm font-semibold text-[#344054]">
                Disciplinas ({selectedSubjectIds.length})
              </h5>
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={selectAllSubjects}
                  disabled={filteredSubjects.length === 0}
                  className="text-[#005bbf] hover:underline disabled:text-[#98a2b3] disabled:no-underline"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubjectIds([])}
                  disabled={selectedSubjectIds.length === 0}
                  className="text-[#667085] hover:underline disabled:text-[#98a2b3] disabled:no-underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]"
                aria-hidden="true"
              />
              <label className="sr-only" htmlFor="curriculum-subject-search">
                Buscar disciplina
              </label>
              <input
                id="curriculum-subject-search"
                value={subjectSearch}
                onChange={(event) => setSubjectSearch(event.target.value)}
                placeholder="Buscar disciplina"
                className="w-full rounded-lg border border-[#d0d5dd] py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[#98a2b3] focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
              />
            </div>

            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[#eaecf0] p-2">
              {filteredSubjects.map((subject) => (
                <label
                  key={subject.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#344054] hover:bg-[#f8faff]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.includes(subject.id)}
                    onChange={() =>
                      toggleSelection(
                        subject.id,
                        setSelectedSubjectIds,
                      )
                    }
                    className="h-4 w-4 rounded border-[#98a2b3] text-[#005bbf] focus:ring-[#005bbf]"
                  />
                  {subject.name}
                </label>
              ))}
              {filteredSubjects.length === 0 && (
                <p className="px-2 py-3 text-sm text-[#667085]">
                  Nenhuma disciplina encontrada.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void createTemplate()}
              disabled={
                createMutation.isPending ||
                !name.trim() ||
                selectedSubjectIds.length === 0
              }
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {createMutation.isPending ? 'Salvando...' : 'Salvar modelo'}
            </button>
          </section>

          <section className="rounded-lg border border-[#d8deea] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-[#181c20]">Aplicar modelo</h4>
                <p className="mt-1 text-xs text-[#667085]">
                  Escolha as turmas e um modelo salvo.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[#005bbf]">
                {selectedClassIds.length} selecionadas
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f8faff] px-3 py-2 text-xs text-[#475467]">
              <Info className="h-4 w-4 shrink-0 text-[#005bbf]" aria-hidden="true" />
              <span>Não altera alunos nem matrículas.</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <h5 className="text-sm font-semibold text-[#344054]">
                Turmas ({selectedClassIds.length})
              </h5>
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={selectAllClasses}
                  disabled={filteredClasses.length === 0}
                  className="text-[#005bbf] hover:underline disabled:text-[#98a2b3] disabled:no-underline"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClassIds([])}
                  disabled={selectedClassIds.length === 0}
                  className="text-[#667085] hover:underline disabled:text-[#98a2b3] disabled:no-underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]"
                aria-hidden="true"
              />
              <label className="sr-only" htmlFor="curriculum-class-search">
                Buscar turma
              </label>
              <input
                id="curriculum-class-search"
                value={classSearch}
                onChange={(event) => setClassSearch(event.target.value)}
                placeholder="Buscar turma"
                className="w-full rounded-lg border border-[#d0d5dd] py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[#98a2b3] focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
              />
            </div>

            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[#eaecf0] p-2">
              {filteredClasses.map((classRecord) => (
                <label
                  key={classRecord.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#344054] hover:bg-[#f8faff]"
                >
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(classRecord.id)}
                    onChange={() =>
                      toggleSelection(
                        classRecord.id,
                        setSelectedClassIds,
                      )
                    }
                    className="h-4 w-4 rounded border-[#98a2b3] text-[#005bbf] focus:ring-[#005bbf]"
                  />
                  {classRecord.name}
                </label>
              ))}
              {filteredClasses.length === 0 && (
                <p className="px-2 py-3 text-sm text-[#667085]">
                  Nenhuma turma encontrada.
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-[#eaecf0] pt-4">
              <div className="flex items-center justify-between gap-3">
                <h5 className="text-sm font-semibold text-[#344054]">
                  Modelos salvos ({templates.length})
                </h5>
                {templatesQuery.isFetching && (
                  <span className="text-xs text-[#667085]">Atualizando...</span>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#f8faff] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-[#344054]">
                      {template.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => void applyTemplate(template.id)}
                      disabled={
                        applyMutation.isPending || selectedClassIds.length === 0
                      }
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#005bbf] hover:underline disabled:text-[#98a2b3] disabled:no-underline"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Aplicar
                    </button>
                  </div>
                ))}
                {templatesQuery.isLoading && (
                  <p className="text-sm text-[#667085]">Carregando modelos...</p>
                )}
                {!templatesQuery.isLoading && templates.length === 0 && (
                  <p className="text-sm text-[#667085]">
                    Nenhum modelo salvo.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
