import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  CheckCircle2,
  Clock3,
  Plus,
  Save,
  Settings2,
  Trash2,
  Utensils,
} from 'lucide-react';

import {
  useAcademicPolicy,
  useAcademicShiftSettings,
  useAcademicYears,
  useSaveSchoolScheduleBreaks,
  useSaveAcademicPolicy,
  useSaveAcademicShiftSettings,
  useSchoolScheduleBreaks,
} from '../../hooks/useAcademicTermClosing';
import {
  ACADEMIC_SHIFT_OPTIONS,
  type AcademicShift,
} from '../../lib/academic/academicShifts';
import {
  DEFAULT_TIMETABLE_POLICY,
  type TimetablePolicySettings,
} from '../../lib/academic/timetablePolicy';
import type { SchoolScheduleBreakDraft } from '../../services/academicAutomationService';
import {
  formatDate,
  getErrorMessage,
} from './academicDisplay';

interface AcademicPolicyPanelProps {
  institutionId: string | undefined;
  readOnly?: boolean;
}

const BREAK_DAY_OPTIONS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
] as const;

type WeeklyBreakDraft = Omit<SchoolScheduleBreakDraft, 'day_of_week'> & {
  days_of_week: number[];
};

const WEEKDAYS = BREAK_DAY_OPTIONS.slice(0, 5).map((day) => day.value);

const SUGGESTED_BREAKS: Record<AcademicShift, WeeklyBreakDraft[]> = {
  MATUTINO: [
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '10:30', end_time: '10:50' },
  ],
  VESPERTINO: [
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '16:30', end_time: '16:50' },
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '18:30', end_time: '18:50' },
  ],
  INTEGRAL: [
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '10:30', end_time: '10:50' },
    { days_of_week: WEEKDAYS, name: 'Almoço', start_time: '11:40', end_time: '13:00' },
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '14:40', end_time: '14:50' },
  ],
  NOTURNO: [
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '20:10', end_time: '20:20' },
    { days_of_week: WEEKDAYS, name: 'Intervalo', start_time: '22:00', end_time: '22:10' },
  ],
};

function emptyBreaksByShift(): Record<AcademicShift, WeeklyBreakDraft[]> {
  return {
    MATUTINO: [],
    VESPERTINO: [],
    INTEGRAL: [],
    NOTURNO: [],
  };
}

function groupBreaksBySchedule(
  breaks: SchoolScheduleBreakDraft[],
): WeeklyBreakDraft[] {
  const grouped = new Map<string, WeeklyBreakDraft>();

  for (const item of breaks) {
    const startTime = item.start_time.slice(0, 5);
    const endTime = item.end_time.slice(0, 5);
    const name = item.name.trim();
    const key = `${name.toLocaleLowerCase()}:${startTime}:${endTime}`;
    const current = grouped.get(key);

    if (current) {
      if (!current.days_of_week.includes(item.day_of_week)) {
        current.days_of_week = [...current.days_of_week, item.day_of_week].sort(
          (left, right) => left - right,
        );
      }
      continue;
    }

    grouped.set(key, {
      days_of_week: [item.day_of_week],
      name,
      start_time: startTime,
      end_time: endTime,
    });
  }

  return [...grouped.values()].sort(
    (left, right) =>
      (left.days_of_week[0] ?? 0) - (right.days_of_week[0] ?? 0) ||
      left.start_time.localeCompare(right.start_time),
  );
}

function expandWeeklyBreaks(
  breaks: WeeklyBreakDraft[],
): SchoolScheduleBreakDraft[] {
  return breaks
    .flatMap((item) =>
      item.days_of_week.map((day_of_week) => ({
        day_of_week,
        name: item.name,
        start_time: item.start_time,
        end_time: item.end_time,
      })),
    )
    .sort(
      (left, right) =>
        left.day_of_week - right.day_of_week ||
        left.start_time.localeCompare(right.start_time),
    );
}

export default function AcademicPolicyPanel({
  institutionId,
  readOnly = false,
}: AcademicPolicyPanelProps) {
  const yearsQuery = useAcademicYears(institutionId);
  const years = yearsQuery.data ?? [];
  const [selectedYearId, setSelectedYearId] = useState('');
  const [minimumGrade, setMinimumGrade] = useState('');
  const [minimumAttendance, setMinimumAttendance] =
    useState('');
  const [decimalPlaces, setDecimalPlaces] =
    useState('1');
  const [enabledShifts, setEnabledShifts] =
    useState<AcademicShift[]>(['MATUTINO']);
  const [timetableSettings, setTimetableSettings] =
    useState<TimetablePolicySettings>(DEFAULT_TIMETABLE_POLICY);
  const [breaksByShift, setBreaksByShift] = useState<
    Record<AcademicShift, WeeklyBreakDraft[]>
  >(emptyBreaksByShift);
  const [successMessage, setSuccessMessage] =
    useState('');
  const [shiftSuccessMessage, setShiftSuccessMessage] =
    useState('');
  const [breakValidationMessage, setBreakValidationMessage] =
    useState('');

  useEffect(() => {
    if (!selectedYearId && years.length > 0) {
      setSelectedYearId(
        years.find((year) => year.active)?.id ?? years[0].id,
      );
    }
  }, [selectedYearId, years]);

  const selectedYear = useMemo(
    () =>
      years.find((year) => year.id === selectedYearId) ??
      null,
    [selectedYearId, years],
  );

  const policyQuery = useAcademicPolicy(
    institutionId,
    selectedYearId || undefined,
  );
  const shiftSettingsQuery = useAcademicShiftSettings(
    institutionId,
  );
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);
  const savePolicy = useSaveAcademicPolicy();
  const saveShiftSettings = useSaveAcademicShiftSettings();
  const saveScheduleBreaks = useSaveSchoolScheduleBreaks();
  const policy = policyQuery.data ?? null;

  useEffect(() => {
    if (shiftSettingsQuery.data) {
      setEnabledShifts(shiftSettingsQuery.data);
    }
  }, [shiftSettingsQuery.data]);

  useEffect(() => {
    if (!scheduleBreaksQuery.data) return;

    const next = emptyBreaksByShift();
    for (const option of ACADEMIC_SHIFT_OPTIONS) {
      next[option.value] = groupBreaksBySchedule(
        scheduleBreaksQuery.data
          .filter((item) => item.shift === option.value)
          .map((item) => ({
            day_of_week: item.day_of_week,
            name: item.name,
            start_time: item.start_time,
            end_time: item.end_time,
          })),
      );
    }
    setBreaksByShift(next);
  }, [scheduleBreaksQuery.data]);

  useEffect(() => {
    if (!policy) {
      setMinimumGrade('');
      setMinimumAttendance('');
      setDecimalPlaces('1');
      setTimetableSettings(DEFAULT_TIMETABLE_POLICY);
      return;
    }

    setMinimumGrade(String(policy.minimumGradePercentage));
    setMinimumAttendance(
      String(policy.minimumAttendancePercentage),
    );
    setDecimalPlaces(String(policy.decimalPlaces));
    setTimetableSettings(policy.timetable);
  }, [policy]);

  const isSaving = savePolicy.isPending;
  const isShiftSaving = saveShiftSettings.isPending;
  const formDisabled =
    readOnly ||
    isSaving ||
    !institutionId ||
    !selectedYearId;

  function toggleShift(shift: AcademicShift): void {
    setShiftSuccessMessage('');
    setEnabledShifts((current) =>
      current.includes(shift)
        ? current.filter((item) => item !== shift)
        : [...current, shift],
    );
  }

  async function handleShiftSubmit(): Promise<void> {
    setShiftSuccessMessage('');

    if (!institutionId || readOnly) return;

    try {
      await saveShiftSettings.mutateAsync({
        institutionId,
        enabledShifts,
      });
      setShiftSuccessMessage('Turnos da escola salvos.');
    } catch {
      // The mutation state renders the translated error without an unhandled rejection.
    }
  }

  function updateBreak(
    shift: AcademicShift,
    index: number,
    value: Partial<WeeklyBreakDraft>,
  ): void {
    setBreakValidationMessage('');
    setBreaksByShift((current) => ({
      ...current,
      [shift]: current[shift].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...value } : item,
      ),
    }));
  }

  function toggleBreakDay(
    shift: AcademicShift,
    index: number,
    dayOfWeek: number,
  ): void {
    setBreakValidationMessage('');
    setBreaksByShift((current) => ({
      ...current,
      [shift]: current[shift].map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const days_of_week = item.days_of_week.includes(dayOfWeek)
          ? item.days_of_week.filter((day) => day !== dayOfWeek)
          : [...item.days_of_week, dayOfWeek].sort(
              (left, right) => left - right,
            );

        return { ...item, days_of_week };
      }),
    }));
  }

  function addBreak(shift: AcademicShift): void {
    setBreakValidationMessage('');
    setBreaksByShift((current) => ({
      ...current,
      [shift]: [
        ...current[shift],
        {
          days_of_week: [...WEEKDAYS],
          name: 'Intervalo',
          start_time: '10:30',
          end_time: '10:50',
        },
      ],
    }));
  }

  function removeBreak(shift: AcademicShift, index: number): void {
    setBreakValidationMessage('');
    setBreaksByShift((current) => ({
      ...current,
      [shift]: current[shift].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function suggestBreaks(shift: AcademicShift): void {
    setBreakValidationMessage('');
    setBreaksByShift((current) => ({
      ...current,
      [shift]: SUGGESTED_BREAKS[shift].map((item) => ({
        ...item,
        days_of_week: [...item.days_of_week],
      })),
    }));
  }

  async function handleBreakSubmit(shift: AcademicShift): Promise<void> {
    if (!institutionId || readOnly) return;
    setBreakValidationMessage('');

    if (breaksByShift[shift].some((item) => item.days_of_week.length === 0)) {
      setBreakValidationMessage(
        'Selecione pelo menos um dia da semana para cada intervalo.',
      );
      return;
    }

    try {
      await saveScheduleBreaks.mutateAsync({
        institution_id: institutionId,
        shift,
        breaks: expandWeeklyBreaks(breaksByShift[shift]),
      });
      setShiftSuccessMessage('Intervalos e almoço salvos.');
    } catch {
      // The mutation state renders the translated error without an unhandled rejection.
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSuccessMessage('');

    if (!institutionId || !selectedYearId || readOnly) {
      return;
    }

    await savePolicy.mutateAsync({
      institutionId,
      academicYearId: selectedYearId,
      minimumGradePercentage: Number(minimumGrade),
      minimumAttendancePercentage: Number(
        minimumAttendance,
      ),
      decimalPlaces: Number(decimalPlaces),
      timetable: timetableSettings,
    });

    setSuccessMessage('Politica academica salva.');
  }

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2
              className="h-5 w-5 text-[#005bbf]"
              aria-hidden="true"
            />
            <h2 className="text-lg font-bold text-[#181c20]">
              Politica academica
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#727785]">
            Regras de fechamento, turnos e capacidade usadas na rotina academica.
          </p>
        </div>

        {policy && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            <span className="font-semibold">Ativa</span>
            <span className="ml-2">
              Atualizada em {formatDate(policy.updatedAt.slice(0, 10))}
            </span>
          </div>
        )}
      </div>

      <section className="mt-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Clock3
            className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-bold text-[#181c20]">
              Turnos utilizados pela escola
            </h3>
            <p className="mt-1 text-xs text-[#667085]">
              Escolha os turnos permitidos para turmas e horários da escola.
              Pelo menos um turno deve permanecer ativo.
            </p>
          </div>
        </div>

        {shiftSettingsQuery.isLoading ? (
          <p className="mt-4 rounded-lg border border-dashed border-blue-200 bg-white p-3 text-sm text-[#667085]">
            Carregando turnos configurados...
          </p>
        ) : shiftSettingsQuery.isError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            Não foi possível carregar os turnos da escola.
            A migração de configuração precisa estar aplicada antes do uso.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ACADEMIC_SHIFT_OPTIONS.map((option) => {
              const checked = enabledShifts.includes(option.value);

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors ${
                    checked
                      ? 'border-[#005bbf] ring-1 ring-[#005bbf]/20'
                      : 'border-[#dfe3e8]'
                  } ${readOnly ? 'cursor-default opacity-80' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleShift(option.value)}
                    disabled={readOnly || isShiftSaving}
                    className="mt-1 h-4 w-4 accent-[#005bbf]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#181c20]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-[#667085]">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {!readOnly && !shiftSettingsQuery.isError && (
          <button
            type="button"
            onClick={() => void handleShiftSubmit()}
            disabled={
              shiftSettingsQuery.isLoading ||
              isShiftSaving ||
              enabledShifts.length === 0
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isShiftSaving ? 'Salvando turnos...' : 'Salvar turnos'}
          </button>
        )}

        {readOnly && (
          <p className="mt-4 rounded-lg border border-[#dfe3e8] bg-white p-3 text-sm text-[#727785]">
            Seu perfil pode visualizar os turnos, mas não alterá-los.
          </p>
        )}

        {saveShiftSettings.isError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {getErrorMessage(saveShiftSettings.error)}
          </div>
        )}

        {shiftSuccessMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {shiftSuccessMessage}
          </div>
        )}

        <section className="mt-5 rounded-lg border border-[#dfe3e8] bg-white p-4">
          <div className="flex items-start gap-3">
            <Utensils
              className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-bold text-[#181c20]">
                Intervalos e almoço por turno
              </h3>
              <p className="mt-1 text-xs text-[#667085]">
                Cadastre os bloqueios da rotina escolar. O gerador não marcará aulas dentro desses horários.
              </p>
            </div>
          </div>

          {scheduleBreaksQuery.isLoading ? (
            <p className="mt-4 rounded-lg border border-dashed border-[#c1c6d6] p-3 text-sm text-[#667085]">
              Carregando intervalos configurados...
            </p>
          ) : scheduleBreaksQuery.isError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              Não foi possível carregar os intervalos. A migration de horários complementares precisa estar aplicada antes do uso.
            </div>
          ) : enabledShifts.length === 0 ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Habilite pelo menos um turno para configurar a rotina.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {enabledShifts.map((shift) => {
                const option = ACADEMIC_SHIFT_OPTIONS.find(
                  (item) => item.value === shift,
                );
                const shiftBreaks = breaksByShift[shift];
                const savingThisShift =
                  saveScheduleBreaks.isPending &&
                  saveScheduleBreaks.variables?.shift === shift;

                return (
                  <div
                    key={shift}
                    className="rounded-lg border border-[#dfe3e8] p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-[#181c20]">
                          {option?.label ?? shift}
                        </h4>
                        <p className="text-xs text-[#667085]">
                          {option?.description}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => suggestBreaks(shift)}
                            disabled={saveScheduleBreaks.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c1c6d6] px-3 py-2 text-xs font-semibold text-[#005bbf] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Usar sugestão
                          </button>
                          <button
                            type="button"
                            onClick={() => addBreak(shift)}
                            disabled={saveScheduleBreaks.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c1c6d6] px-3 py-2 text-xs font-semibold text-[#005bbf] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Adicionar horário
                          </button>
                        </div>
                      )}
                    </div>

                    {shiftBreaks.length === 0 ? (
                      <p className="mt-3 rounded-lg border border-dashed border-[#c1c6d6] p-3 text-xs text-[#667085]">
                        Nenhum intervalo cadastrado para este turno.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {shiftBreaks.map((item, index) => (
                          <div
                            key={`${shift}-${index}`}
                            className="grid gap-3 rounded-lg border border-[#edf0f4] bg-[#fbfcfe] p-3 lg:grid-cols-[minmax(300px,1.5fr)_minmax(170px,1fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_auto] lg:items-end"
                          >
                            <fieldset>
                              <legend className="text-xs font-semibold text-[#3d4652]">
                                Dias da semana
                              </legend>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {BREAK_DAY_OPTIONS.map((day) => {
                                  const checked = item.days_of_week.includes(day.value);
                                  return (
                                    <label
                                      key={day.value}
                                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                                        checked
                                          ? 'border-[#8db9ed] bg-blue-50 text-[#005bbf]'
                                          : 'border-[#dfe3e8] bg-white text-[#667085]'
                                      } ${readOnly ? 'cursor-default opacity-80' : ''}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          toggleBreakDay(shift, index, day.value)
                                        }
                                        aria-label={`${day.label} para o intervalo ${index + 1}`}
                                        disabled={readOnly || saveScheduleBreaks.isPending}
                                        className="h-3.5 w-3.5 accent-[#005bbf]"
                                      />
                                      {day.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </fieldset>
                            <label className="text-xs font-semibold text-[#3d4652]">
                              Tipo
                              <input
                                value={item.name}
                                onChange={(event) =>
                                  updateBreak(shift, index, {
                                    name: event.target.value,
                                  })
                                }
                                placeholder="Intervalo ou almoço"
                                disabled={readOnly || saveScheduleBreaks.isPending}
                                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm font-normal text-[#181c20] disabled:bg-gray-50"
                              />
                            </label>
                            <label className="text-xs font-semibold text-[#3d4652]">
                              Início
                              <input
                                type="time"
                                value={item.start_time}
                                onChange={(event) =>
                                  updateBreak(shift, index, {
                                    start_time: event.target.value,
                                  })
                                }
                                disabled={readOnly || saveScheduleBreaks.isPending}
                                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm font-normal text-[#181c20] disabled:bg-gray-50"
                              />
                            </label>
                            <label className="text-xs font-semibold text-[#3d4652]">
                              Fim
                              <input
                                type="time"
                                value={item.end_time}
                                onChange={(event) =>
                                  updateBreak(shift, index, {
                                    end_time: event.target.value,
                                  })
                                }
                                disabled={readOnly || saveScheduleBreaks.isPending}
                                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm font-normal text-[#181c20] disabled:bg-gray-50"
                              />
                            </label>
                            {!readOnly && (
                              <button
                                type="button"
                                title="Remover horário"
                                aria-label={`Remover intervalo ${index + 1} do turno ${option?.label ?? shift}`}
                                onClick={() => removeBreak(shift, index)}
                                disabled={saveScheduleBreaks.isPending}
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {shiftBreaks.length > 0 && (
                      <p className="mt-2 text-xs text-[#667085]">
                        Cada linha se repete nos dias selecionados. Para um dia diferente, crie outra linha.
                      </p>
                    )}

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => void handleBreakSubmit(shift)}
                        disabled={savingThisShift || saveScheduleBreaks.isPending}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        {savingThisShift ? 'Salvando...' : `Salvar ${option?.label ?? shift}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {saveScheduleBreaks.isError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {getErrorMessage(saveScheduleBreaks.error)}
            </div>
          )}
          {breakValidationMessage && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
            >
              {breakValidationMessage}
            </div>
          )}
        </section>
      </section>

      {yearsQuery.isLoading ? (
        <div className="mt-6 rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785]">
          Carregando anos letivos...
        </div>
      ) : years.length === 0 ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Cadastre um ano letivo antes de configurar regras.
        </div>
      ) : (
        <form
          className="mt-6 grid gap-4 lg:grid-cols-5"
          onSubmit={handleSubmit}
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="academic-policy-year"
              className="text-xs font-semibold text-[#3d4652]"
            >
              Ano letivo
            </label>
            <select
              id="academic-policy-year"
              value={selectedYearId}
              onChange={(event) =>
                setSelectedYearId(event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20]"
            >
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
              htmlFor="academic-policy-grade"
              className="text-xs font-semibold text-[#3d4652]"
            >
              Media minima (%)
            </label>
            <input
              id="academic-policy-grade"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={minimumGrade}
              onChange={(event) =>
                setMinimumGrade(event.target.value)
              }
              disabled={formDisabled}
              className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] disabled:bg-gray-50"
            />
          </div>

          <div>
            <label
              htmlFor="academic-policy-attendance"
              className="text-xs font-semibold text-[#3d4652]"
            >
              Frequencia minima (%)
            </label>
            <input
              id="academic-policy-attendance"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={minimumAttendance}
              onChange={(event) =>
                setMinimumAttendance(event.target.value)
              }
              disabled={formDisabled}
              className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] disabled:bg-gray-50"
            />
          </div>

          <div>
            <label
              htmlFor="academic-policy-decimals"
              className="text-xs font-semibold text-[#3d4652]"
            >
              Casas decimais
            </label>
            <input
              id="academic-policy-decimals"
              type="number"
              min="0"
              max="4"
              step="1"
              value={decimalPlaces}
              onChange={(event) =>
                setDecimalPlaces(event.target.value)
              }
              disabled={formDisabled}
              className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] disabled:bg-gray-50"
            />
          </div>

          <section className="lg:col-span-5 rounded-lg border border-[#dfe3e8] bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-bold text-[#181c20]">
                Regras da grade horaria
              </h3>
              <p className="mt-1 text-xs text-[#667085]">
                Estas regras orientam a preparacao, a geracao e a publicacao da grade.
              </p>
            </div>

            <fieldset className="mt-4">
              <legend className="text-xs font-semibold text-[#3d4652]">
                Dias letivos
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {BREAK_DAY_OPTIONS.map((day) => {
                  const checked = timetableSettings.schoolDays.includes(day.value);
                  return (
                    <label
                      key={day.value}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-xs font-semibold text-[#344054]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTimetableSettings((current) => ({
                          ...current,
                          schoolDays: checked
                            ? current.schoolDays.length > 1
                              ? current.schoolDays.filter((item) => item !== day.value)
                              : current.schoolDays
                            : [...current.schoolDays, day.value].sort((left, right) => left - right),
                        }))}
                        disabled={formDisabled || (checked && timetableSettings.schoolDays.length === 1)}
                        className="h-4 w-4 accent-[#005bbf]"
                      />
                      {day.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ['defaultLessonDurationMinutes', 'Duracao padrao da aula (min)', 15, 180],
                ['maxLessonsPerDay', 'Maximo de aulas por turma/dia', 1, 30],
                ['maxTeacherLessonsPerDay', 'Maximo de aulas por professor/dia', 1, 30],
                ['maxTeacherLessonsPerWeek', 'Maximo de aulas por professor/semana', 1, 180],
                ['maxConsecutiveSubjectLessons', 'Maximo consecutivo da mesma materia', 1, 6],
                ['maxSubjectLessonsPerDay', 'Maximo da mesma materia/dia', 1, 12],
              ] as const).map(([field, label, min, max]) => (
                <label key={field} className="text-xs font-semibold text-[#3d4652]">
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step="1"
                    value={timetableSettings[field]}
                    onChange={(event) => setTimetableSettings((current) => ({
                      ...current,
                      [field]: Number(event.target.value),
                    }))}
                    disabled={formDisabled}
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm font-normal text-[#181c20] disabled:bg-gray-50"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([
                ['requireTeacherAvailability', 'Exigir disponibilidade do professor'],
                ['requireRoomForGeneration', 'Exigir sala para gerar'],
                ['allowSharedRooms', 'Permitir salas compartilhadas'],
              ] as const).map(([field, label]) => (
                <label key={field} className="flex items-start gap-2 rounded-lg border border-[#dfe3e8] bg-white p-3 text-xs font-semibold text-[#344054]">
                  <input
                    type="checkbox"
                    checked={timetableSettings[field]}
                    onChange={(event) => setTimetableSettings((current) => ({
                      ...current,
                      [field]: event.target.checked,
                    }))}
                    disabled={formDisabled}
                    className="mt-0.5 h-4 w-4 accent-[#005bbf]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <div className="lg:col-span-5">
            {!policyQuery.isLoading && !policy && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Nao ha politica ativa para este ano letivo.
              </div>
            )}

            {readOnly ? (
              <div className="rounded-lg border border-[#dfe3e8] bg-gray-50 p-3 text-sm text-[#727785]">
                Seu perfil pode visualizar a politica, mas nao altera-la.
              </div>
            ) : (
              <button
                type="submit"
                disabled={formDisabled}
                className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Save
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                {isSaving ? 'Salvando...' : 'Salvar politica'}
              </button>
            )}
          </div>
        </form>
      )}

      {selectedYear && (
        <p className="mt-4 text-xs text-[#727785]">
          Periodo do ano: {formatDate(selectedYear.startDate)} ate{' '}
          {formatDate(selectedYear.endDate)}.
        </p>
      )}

      {savePolicy.isError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {getErrorMessage(savePolicy.error)}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2
            className="h-4 w-4"
            aria-hidden="true"
          />
          {successMessage}
        </div>
      )}
    </section>
  );
}
