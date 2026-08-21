import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  LoaderCircle,
} from 'lucide-react';

import {
  DataTable,
  type Column,
} from '../../../components/DataTable';

import { useAuth } from '../../../contexts/AuthContext';

import {
  useAcademicYears,
  useCreateAcademicYear,
  useCreateTerm,
  useDeleteAcademicYear,
  useSetAcademicYearActive,
  useSetTermActive,
  useUpdateAcademicYear,
  useUpdateTerm,
} from '../../../hooks/useAcademicStructure';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import {
  academicYearSchema,
  academicYearUpdateSchema,
  termSchema,
  termUpdateSchema,
} from '../../../schemas/adminSchemas';
import {
  academicAutomationService,
  suggestPeriods,
  type PeriodDraft,
  type PeriodModel,
} from '../../../services/academicAutomationService';

import type {
  AcademicYearRow,
  TermRow,
} from '../../../services/academicStructureService';

interface AcademicYearDraft {
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface TermDraft {
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

type AssistedPeriodModel = Exclude<PeriodModel, 'CUSTOM'> | 'CUSTOM';

const emptyAcademicYearDraft: AcademicYearDraft = {
  name: '',
  start_date: '',
  end_date: '',
  active: true,
};

const emptyTermDraft: TermDraft = {
  name: '',
  start_date: '',
  end_date: '',
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

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatPeriodName(value: string): string {
  const match = value.match(
    /^(\d+)\s*o\s+(bimestre|trimestre|semestre|per[ií]odo)$/i,
  );

  if (!match) {
    return value;
  }

  const unit = match[2].toLowerCase();

  return `${match[1]}º ${unit.charAt(0).toUpperCase()}${unit.slice(1)}`;
}

function isCurrentRange(
  startDate: string,
  endDate: string,
): boolean {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  return startDate <= today && today <= endDate;
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
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

export default function AcademicYearsTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const yearsQuery =
    useAcademicYears(institutionId);

  const createYearMutation =
    useCreateAcademicYear();

  const updateYearMutation =
    useUpdateAcademicYear();

  const deleteYearMutation =
    useDeleteAcademicYear();

  const yearStatusMutation =
    useSetAcademicYearActive();

  const createTermMutation = useCreateTerm();
  const updateTermMutation = useUpdateTerm();
  const termStatusMutation =
    useSetTermActive();

  const [periodModel, setPeriodModel] =
    useState<AssistedPeriodModel>('BIMESTERS_4');
  const [periodDrafts, setPeriodDrafts] =
    useState<PeriodDraft[]>([]);
  const [sourceYearId, setSourceYearId] =
    useState('');
  const [copyTeachers, setCopyTeachers] =
    useState(false);
  const [copyRooms, setCopyRooms] =
    useState(true);

  const [
    selectedYearId,
    setSelectedYearId,
  ] = useState<string>('');

  const [
    editingYear,
    setEditingYear,
  ] = useState<AcademicYearRow | null>(null);

  const [
    editingTerm,
    setEditingTerm,
  ] = useState<TermRow | null>(null);

  const [
    isYearModalOpen,
    setIsYearModalOpen,
  ] = useState(false);

  const [
    isTermModalOpen,
    setIsTermModalOpen,
  ] = useState(false);

  const [
    yearDraft,
    setYearDraft,
  ] = useState<AcademicYearDraft>({
    ...emptyAcademicYearDraft,
  });

  const [termDraft, setTermDraft] =
    useState<TermDraft>({
      ...emptyTermDraft,
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

  const [isMobile, setIsMobile] = useState(false);
  const [isYearSubmitting, setIsYearSubmitting] =
    useState(false);
  const yearSubmitLockRef = useRef(false);

  const years = yearsQuery.data ?? [];

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener?.('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener?.('change', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (
      years.length > 0 &&
      !years.some(
        (year) => year.id === selectedYearId,
      )
    ) {
      setSelectedYearId(years[0]?.id ?? '');
    }
  }, [selectedYearId, years]);

  const selectedYear = useMemo(
    () =>
      years.find(
        (year) => year.id === selectedYearId,
      ) ?? null,
    [selectedYearId, years],
  );

  const isYearBusy =
    isYearSubmitting ||
    deleteYearMutation.isPending;

  const isSubmitting =
    isYearBusy ||
    createYearMutation.isPending ||
    updateYearMutation.isPending ||
    createTermMutation.isPending ||
    updateTermMutation.isPending;

  const yearColumns: Column<AcademicYearRow>[] = [
    {
      key: 'name',
      label: 'Ano letivo',
      render: (_value, row) => (
        <div>
          <p className="font-semibold text-[#181c20]">
            {row.name}
          </p>

          {row.active &&
            isCurrentRange(
              row.start_date,
              row.end_date,
            ) && (
              <p className="mt-1 text-xs font-medium text-[#005bbf]">
                Ano atual
              </p>
            )}
        </div>
      ),
    },
    {
      key: 'start_date',
      label: 'Início',
      render: (value) =>
        formatDate(String(value)),
    },
    {
      key: 'end_date',
      label: 'Fim',
      render: (value) =>
        formatDate(String(value)),
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

  function openCreateYearModal(): void {
    resetMessages();
    setEditingYear(null);
    setYearDraft({
      ...emptyAcademicYearDraft,
    });
    setPeriodModel('BIMESTERS_4');
    setPeriodDrafts([]);
    setSourceYearId('');
    setCopyTeachers(false);
    setCopyRooms(true);
    setIsYearModalOpen(true);
  }

  function openEditYearModal(
    year: AcademicYearRow,
  ): void {
    resetMessages();
    setEditingYear(year);
    setYearDraft({
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
      active: year.active,
    });
    setPeriodDrafts([]);
    setIsYearModalOpen(true);
  }

  function openCreateTermModal(): void {
    resetMessages();
    setEditingTerm(null);
    setTermDraft({
      ...emptyTermDraft,
    });
    setIsTermModalOpen(true);
  }

  function openEditTermModal(term: TermRow): void {
    resetMessages();
    setEditingTerm(term);
    setTermDraft({
      name: formatPeriodName(term.name),
      start_date: term.start_date,
      end_date: term.end_date,
      active: term.active,
    });
    setIsTermModalOpen(true);
  }

  function closeModals(): void {
    setIsYearModalOpen(false);
    setIsTermModalOpen(false);
    setEditingYear(null);
    setEditingTerm(null);
    setYearDraft({
      ...emptyAcademicYearDraft,
    });
    setTermDraft({
      ...emptyTermDraft,
    });
    setPeriodDrafts([]);
    setModalError(null);
  }

  function suggestAssistedPeriods(): void {
    if (!yearDraft.start_date || !yearDraft.end_date || periodModel === 'CUSTOM') {
      return;
    }
    try {
      setPeriodDrafts(suggestPeriods(yearDraft.start_date, yearDraft.end_date, periodModel));
      setModalError(null);
    } catch (error) {
      setModalError(getErrorMessage(error));
    }
  }

  async function handleYearSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (
      isYearSubmitting ||
      yearSubmitLockRef.current
    ) {
      return;
    }

    yearSubmitLockRef.current = true;

    if (!institutionId) {
      yearSubmitLockRef.current = false;
      setModalError(
        'A instituição não foi carregada.',
      );
      return;
    }

    setIsYearSubmitting(true);
    setModalError(null);

    try {
      if (editingYear) {
        const result =
          academicYearUpdateSchema.safeParse(
            yearDraft,
          );

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await updateYearMutation.mutateAsync({
          id: editingYear.id,
          institutionId,
          data: result.data,
        });

        setFeedbackMessage(
          'Ano letivo atualizado com sucesso.',
        );
      } else {
        const result =
          academicYearSchema.safeParse({
            institution_id: institutionId,
            ...yearDraft,
          });

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        const created = periodDrafts.length > 0
          ? await academicAutomationService.createAcademicYearWithTerms({ ...result.data, periods: periodDrafts })
          : await createYearMutation.mutateAsync(result.data).then((year) => ({ year_id: year.id, term_count: 0 }));

        if (sourceYearId) {
          await academicAutomationService.copyPreviousYear({
            institution_id: institutionId,
            source_year_id: sourceYearId,
            target_year_id: created.year_id,
            copy_teachers: copyTeachers,
            copy_rooms: copyRooms,
          });
        }

        setFeedbackMessage(
          periodDrafts.length > 0
            ? `Ano letivo criado com ${created.term_count} periodo(s).`
            : 'Ano letivo criado com sucesso.',
        );
      }

      closeModals();
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    } finally {
      yearSubmitLockRef.current = false;
      setIsYearSubmitting(false);
    }
  }

  async function handleDeleteYear(): Promise<void> {
    if (!editingYear || !institutionId || deleteYearMutation.isPending) {
      return;
    }

    if (
      !window.confirm(
        `Excluir o ano letivo ${editingYear.name}? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setModalError(null);
    setFeedbackMessage(null);

    try {
      await deleteYearMutation.mutateAsync({
        id: editingYear.id,
        institutionId,
      });

      setFeedbackMessage(
        'Ano letivo excluído com sucesso.',
      );
      closeModals();
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleTermSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setModalError(null);

    if (!institutionId || !selectedYear) {
      setModalError(
        'Selecione um ano letivo antes de cadastrar o período.',
      );
      return;
    }

    try {
      if (editingTerm) {
        const result =
          termUpdateSchema.safeParse(termDraft);

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await updateTermMutation.mutateAsync({
          id: editingTerm.id,
          institutionId,
          academicYearId:
            selectedYear.id,
          data: result.data,
        });

        setFeedbackMessage(
          'Período atualizado com sucesso.',
        );
      } else {
        const result = termSchema.safeParse({
          academic_year_id: selectedYear.id,
          ...termDraft,
        });

        if (!result.success) {
          setModalError(
            result.error.issues[0]
              ?.message ??
              'Dados inválidos.',
          );
          return;
        }

        await createTermMutation.mutateAsync({
          institutionId,
          data: result.data,
        });

        setFeedbackMessage(
          'Período criado com sucesso.',
        );
      }

      closeModals();
    } catch (error) {
      setModalError(
        getErrorMessage(error),
      );
    }
  }

  async function handleYearStatus(
    year: AcademicYearRow,
  ): Promise<void> {
    const nextActive = !year.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    if (
      !window.confirm(
        `Deseja ${action} o ano letivo ${year.name}?`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await yearStatusMutation.mutateAsync({
        id: year.id,
        institutionId,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Ano letivo reativado.'
          : 'Ano letivo desativado.',
      );
    } catch (error) {
      setPageError(
        getErrorMessage(error),
      );
    }
  }

  async function handleTermStatus(
    term: TermRow,
  ): Promise<void> {
    if (!selectedYear) {
      return;
    }

    const nextActive = !term.active;
    const action = nextActive
      ? 'reativar'
      : 'desativar';

    if (
      !window.confirm(
        `Deseja ${action} o período ${formatPeriodName(term.name)}?`,
      )
    ) {
      return;
    }

    setPageError(null);
    setFeedbackMessage(null);

    try {
      await termStatusMutation.mutateAsync({
        id: term.id,
        institutionId,
        academicYearId: selectedYear.id,
        active: nextActive,
      });

      setFeedbackMessage(
        nextActive
          ? 'Período reativado.'
          : 'Período desativado.',
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
    <div className="space-y-5">
      {feedbackMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {feedbackMessage}
        </div>
      )}

      {(pageError || yearsQuery.isError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError ??
            getErrorMessage(
              yearsQuery.error,
            )}
        </div>
      )}

      <DataTable
        title="Anos letivos"
        addLabel="Novo ano letivo"
        data={years}
        columns={yearColumns}
        isLoading={yearsQuery.isLoading}
        onAdd={openCreateYearModal}
        emptyMessage="Nenhum ano letivo cadastrado nesta instituição."
        renderActions={(year) => {
          const isChangingStatus =
            yearStatusMutation.isPending &&
            yearStatusMutation.variables?.id ===
              year.id;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSelectedYearId(year.id)
                }
                className="font-medium text-[#005bbf] hover:text-[#1a73e8]"
              >
                Períodos
              </button>

              <button
                type="button"
                onClick={() =>
                  openEditYearModal(year)
                }
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Editar
              </button>

              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() =>
                  void handleYearStatus(year)
                }
                className={
                  year.active
                    ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                    : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                }
              >
                {isChangingStatus
                  ? 'Salvando...'
                  : year.active
                    ? 'Desativar'
                    : 'Reativar'}
              </button>
            </div>
          );
        }}
      />

      <section className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white shadow">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-[#181c20]">
              Períodos
            </h3>

            <p className="text-sm text-[#727785]">
              {selectedYear
                ? selectedYear.name
                : 'Selecione um ano letivo'}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateTermModal}
            disabled={!selectedYear}
            className="w-full rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            + Novo período
          </button>
        </div>

        {selectedYear ? (
          <>
            {!isMobile && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Período
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Início
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Fim
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedYear.terms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhum período cadastrado para este ano letivo.
                    </td>
                  </tr>
                ) : (
                  selectedYear.terms.map((term) => {
                    const isChangingStatus =
                      termStatusMutation.isPending &&
                      termStatusMutation.variables
                        ?.id === term.id;

                    return (
                      <tr
                        key={term.id}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-[#181c20]">
                              {formatPeriodName(term.name)}
                            </p>

                            {term.active &&
                              isCurrentRange(
                                term.start_date,
                                term.end_date,
                              ) && (
                                <p className="mt-1 text-xs font-medium text-[#005bbf]">
                                  Período atual
                                </p>
                              )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(
                            term.start_date,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(term.end_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            active={term.active}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                openEditTermModal(term)
                              }
                              className="font-medium text-blue-600 hover:text-blue-800"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              disabled={
                                isChangingStatus
                              }
                              onClick={() =>
                                void handleTermStatus(
                                  term,
                                )
                              }
                              className={
                                term.active
                                  ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                                  : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                              }
                            >
                              {isChangingStatus
                                ? 'Salvando...'
                                : term.active
                                  ? 'Desativar'
                                  : 'Reativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>}

            {isMobile && <div className="divide-y divide-[#dfe3e8]">
            {selectedYear.terms.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhum período cadastrado para este ano letivo.
              </div>
            ) : (
              selectedYear.terms.map((term) => {
                const isChangingStatus =
                  termStatusMutation.isPending &&
                  termStatusMutation.variables?.id === term.id;

                return (
                  <article key={term.id} className="space-y-4 p-4">
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Período
                        </dt>
                        <dd className="mt-1 break-words font-semibold text-[#181c20]">
                          {formatPeriodName(term.name)}
                          {term.active &&
                            isCurrentRange(
                              term.start_date,
                              term.end_date,
                            ) && (
                              <span className="ml-2 text-xs font-medium text-[#005bbf]">
                                Período atual
                              </span>
                            )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Início
                        </dt>
                        <dd className="mt-1 text-[#181c20]">
                          {formatDate(term.start_date)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Fim
                        </dt>
                        <dd className="mt-1 text-[#181c20]">
                          {formatDate(term.end_date)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Status
                        </dt>
                        <dd className="mt-1">
                          <StatusBadge active={term.active} />
                        </dd>
                      </div>
                    </dl>

                    <div className="border-t border-[#dfe3e8] pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Ações
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEditTermModal(term)}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          disabled={isChangingStatus}
                          onClick={() => void handleTermStatus(term)}
                          className={
                            term.active
                              ? 'font-medium text-red-600 hover:text-red-800 disabled:opacity-50'
                              : 'font-medium text-green-600 hover:text-green-800 disabled:opacity-50'
                          }
                        >
                          {isChangingStatus
                            ? 'Salvando...'
                            : term.active
                              ? 'Desativar'
                              : 'Reativar'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
            </div>}
          </>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500">
            Cadastre um ano letivo para criar períodos.
          </div>
        )}
      </section>

      {isYearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="academic-year-modal-title"
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="academic-year-modal-title"
              className="mb-4 text-lg font-bold text-[#181c20]"
            >
              {editingYear
                ? 'Editar ano letivo'
                : 'Novo ano letivo'}
            </h3>

            <form
              onSubmit={(event) =>
                void handleYearSubmit(event)
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

              {isYearBusy && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    {deleteYearMutation.isPending
                      ? 'Excluindo ano letivo...'
                      : editingYear
                        ? 'Salvando alterações...'
                        : 'Criando ano letivo...'}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={
                      deleteYearMutation.isPending
                        ? 'Excluindo ano letivo'
                        : 'Salvando ano letivo'
                    }
                    className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"
                  >
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-[#005bbf]" />
                  </div>
                  <p className="mt-2 text-xs">
                    Aguarde a conclusão para evitar o envio duplicado.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="academic-year-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nome
                </label>
                <input
                  id="academic-year-name"
                  type="text"
                  value={yearDraft.name}
                  onChange={(event) =>
                    setYearDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="academic-year-start"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data inicial
                  </label>
                  <input
                    id="academic-year-start"
                    type="date"
                    value={yearDraft.start_date}
                    onChange={(event) =>
                      setYearDraft(
                        (current) => ({
                          ...current,
                          start_date:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="academic-year-end"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data final
                  </label>
                  <input
                    id="academic-year-end"
                    type="date"
                    value={yearDraft.end_date}
                    onChange={(event) =>
                      setYearDraft(
                        (current) => ({
                          ...current,
                          end_date:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={yearDraft.active}
                  onChange={(event) =>
                    setYearDraft((current) => ({
                      ...current,
                      active:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Ativo
              </label>

              {!editingYear && (
                <>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label htmlFor="academic-period-model" className="block text-sm font-medium text-gray-700">Modelo de períodos</label>
                        <select id="academic-period-model" value={periodModel} onChange={(event) => { setPeriodModel(event.target.value as AssistedPeriodModel); setPeriodDrafts([]); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                          <option value="BIMESTERS_4">4 bimestres</option>
                          <option value="TRIMESTERS_3">3 trimestres</option>
                          <option value="SEMESTERS_2">2 semestres</option>
                          <option value="CUSTOM">Personalizado</option>
                        </select>
                      </div>
                      <button type="button" onClick={suggestAssistedPeriods} disabled={periodModel === 'CUSTOM' || !yearDraft.start_date || !yearDraft.end_date} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50">Sugerir períodos</button>
                      {periodModel === 'CUSTOM' && <button type="button" onClick={() => setPeriodDrafts((current) => [...current, { name: `${current.length + 1}º Período`, start_date: yearDraft.start_date, end_date: yearDraft.end_date, active: true }])} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700">Adicionar período</button>}
                    </div>
                    <p className="mt-2 text-xs text-blue-800">As datas são apenas uma sugestão e podem ser revisadas antes de salvar.</p>
                  </div>

                  {periodDrafts.length > 0 && (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-700">Revise os períodos</p>
                        <span className="text-xs font-medium text-gray-500">{periodDrafts.length} períodos</span>
                      </div>
                      <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid">
                        <span>Período</span>
                        <span>Início</span>
                        <span>Fim</span>
                        {periodModel === 'CUSTOM' && <span className="sr-only">Ações</span>}
                      </div>
                      {periodDrafts.map((period, index) => (
                        <div key={`${period.name}-${index}`} className="grid min-w-0 gap-2 rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:border-0 sm:bg-transparent sm:p-0">
                          <label className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-gray-600 sm:sr-only">Período</span>
                            <input aria-label={`Nome do período ${index + 1}`} value={period.name} onChange={(event) => setPeriodDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className="min-w-0 w-full rounded-lg border px-3 py-2 text-sm" />
                          </label>
                          <label className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-gray-600 sm:sr-only">Início</span>
                            <input aria-label={`Início do período ${index + 1}`} type="date" value={period.start_date} min={yearDraft.start_date} max={yearDraft.end_date} onChange={(event) => setPeriodDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_date: event.target.value } : item))} className="min-w-0 w-full rounded-lg border px-3 py-2 text-sm" />
                          </label>
                          <label className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-gray-600 sm:sr-only">Fim</span>
                            <input aria-label={`Fim do período ${index + 1}`} type="date" value={period.end_date} min={yearDraft.start_date} max={yearDraft.end_date} onChange={(event) => setPeriodDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_date: event.target.value } : item))} className="min-w-0 w-full rounded-lg border px-3 py-2 text-sm" />
                          </label>
                          {periodModel === 'CUSTOM' && <button type="button" onClick={() => setPeriodDrafts((current) => current.filter((_item, itemIndex) => itemIndex !== index))} className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 sm:self-stretch">Remover</button>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border p-3">
                    <label htmlFor="academic-source-year" className="block text-sm font-medium text-gray-700">Usar ano anterior como modelo (opcional)</label>
                    <select id="academic-source-year" value={sourceYearId} onChange={(event) => setSourceYearId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                      <option value="">Criar do zero</option>
                      {years.filter((year) => year.id !== editingYear?.id).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                    </select>
                    {sourceYearId && <div className="mt-2 space-y-2 text-xs text-gray-600">
                      <label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> Estrutura das turmas e matriz curricular</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={copyRooms} onChange={(event) => setCopyRooms(event.target.checked)} /> Salas e horarios padrao</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={copyTeachers} onChange={(event) => setCopyTeachers(event.target.checked)} /> Atribuicoes de professores qualificadas (sugestao)</label>
                      <p>Alunos, matriculas, notas e frequencia nunca sao copiados.</p>
                    </div>}
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {editingYear && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteYear()}
                      disabled={isSubmitting}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Excluir ano letivo
                    </button>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModals}
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

      {isTermModalOpen && selectedYear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="term-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="term-modal-title"
              className="mb-1 text-lg font-bold text-[#181c20]"
            >
              {editingTerm
                ? 'Editar período'
                : 'Novo período'}
            </h3>

            <p className="mb-4 text-sm text-[#727785]">
              {selectedYear.name}
            </p>

            <form
              onSubmit={(event) =>
                void handleTermSubmit(event)
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
                  htmlFor="term-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nome
                </label>
                <input
                  id="term-name"
                  type="text"
                  value={termDraft.name}
                  onChange={(event) =>
                    setTermDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="term-start"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data inicial
                  </label>
                  <input
                    id="term-start"
                    type="date"
                    value={termDraft.start_date}
                    min={selectedYear.start_date}
                    max={selectedYear.end_date}
                    onChange={(event) =>
                      setTermDraft(
                        (current) => ({
                          ...current,
                          start_date:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="term-end"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Data final
                  </label>
                  <input
                    id="term-end"
                    type="date"
                    value={termDraft.end_date}
                    min={selectedYear.start_date}
                    max={selectedYear.end_date}
                    onChange={(event) =>
                      setTermDraft(
                        (current) => ({
                          ...current,
                          end_date:
                            event.target.value,
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={termDraft.active}
                  onChange={(event) =>
                    setTermDraft((current) => ({
                      ...current,
                      active:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Ativo
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModals}
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
