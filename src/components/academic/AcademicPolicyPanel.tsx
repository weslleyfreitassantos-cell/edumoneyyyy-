import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  CheckCircle2,
  Save,
  Settings2,
} from 'lucide-react';

import {
  useAcademicPolicy,
  useAcademicYears,
  useSaveAcademicPolicy,
} from '../../hooks/useAcademicTermClosing';
import {
  formatDate,
  getErrorMessage,
} from './academicDisplay';

interface AcademicPolicyPanelProps {
  institutionId: string | undefined;
  readOnly?: boolean;
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
  const [successMessage, setSuccessMessage] =
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
  const savePolicy = useSaveAcademicPolicy();
  const policy = policyQuery.data ?? null;

  useEffect(() => {
    if (!policy) {
      setMinimumGrade('');
      setMinimumAttendance('');
      setDecimalPlaces('1');
      return;
    }

    setMinimumGrade(String(policy.minimumGradePercentage));
    setMinimumAttendance(
      String(policy.minimumAttendancePercentage),
    );
    setDecimalPlaces(String(policy.decimalPlaces));
  }, [policy]);

  const isSaving = savePolicy.isPending;
  const formDisabled =
    readOnly ||
    isSaving ||
    !institutionId ||
    !selectedYearId;

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
            Regras percentuais usadas no fechamento de periodo.
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
