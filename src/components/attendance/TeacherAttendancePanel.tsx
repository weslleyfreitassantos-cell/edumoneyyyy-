import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Save,
} from 'lucide-react';

import {
  useAttendanceRollCall,
  useSaveAttendanceRollCall,
  useTeacherAttendanceOfferings,
} from '../../hooks/useAttendance';
import {
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceStatus,
} from '../../services/attendanceService';
import {
  ATTENDANCE_STATUS_LABELS,
  getTodayDateInputValue,
} from './attendanceDisplay';

interface EditableAttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  notes: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar a chamada.';
}

function getRecordKey(
  record: Pick<
    EditableAttendanceRecord,
    'status' | 'notes'
  >,
): string {
  return `${record.status}:${record.notes.trim()}`;
}

export default function TeacherAttendancePanel({
  profileId,
  institutionId,
}: {
  profileId: string | undefined;
  institutionId: string | undefined;
}) {
  const [selectedOfferingId, setSelectedOfferingId] =
    useState('');
  const [sessionDate, setSessionDate] = useState(
    getTodayDateInputValue,
  );
  const [records, setRecords] = useState<
    EditableAttendanceRecord[]
  >([]);
  const [successMessage, setSuccessMessage] =
    useState('');

  const offeringsQuery =
    useTeacherAttendanceOfferings(
      profileId,
      institutionId,
    );

  const offerings = offeringsQuery.data ?? [];

  useEffect(() => {
    if (
      offerings.length > 0 &&
      !offerings.some(
        (offering) =>
          offering.id === selectedOfferingId,
      )
    ) {
      setSelectedOfferingId(offerings[0].id);
    }
  }, [offerings, selectedOfferingId]);

  const rollCallQuery = useAttendanceRollCall(
    institutionId,
    selectedOfferingId || undefined,
    sessionDate,
  );

  const saveMutation = useSaveAttendanceRollCall();

  useEffect(() => {
    if (!rollCallQuery.data) {
      setRecords([]);
      return;
    }

    setRecords(
      rollCallQuery.data.records.map((record) => ({
        studentId: record.student.id,
        status: record.status,
        notes: record.notes ?? '',
      })),
    );
    setSuccessMessage('');
  }, [rollCallQuery.dataUpdatedAt, rollCallQuery.data]);

  const originalRecords = useMemo(() => {
    const values = new Map<string, string>();

    for (const record of rollCallQuery.data?.records ?? []) {
      values.set(
        record.student.id,
        getRecordKey({
          status: record.status,
          notes: record.notes ?? '',
        }),
      );
    }

    return values;
  }, [rollCallQuery.data]);

  const recordsByStudentId = useMemo(
    () =>
      new Map(
        records.map((record) => [
          record.studentId,
          record,
        ]),
      ),
    [records],
  );

  const hasUnsavedChanges =
    (!rollCallQuery.data?.session && records.length > 0) ||
    records.some(
      (record) =>
        originalRecords.get(record.studentId) !==
        getRecordKey(record),
    );

  const updateRecord = (
    studentId: string,
    changes: Partial<
      Pick<EditableAttendanceRecord, 'status' | 'notes'>
    >,
  ) => {
    setSuccessMessage('');
    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              ...changes,
            }
          : record,
      ),
    );
  };

  const markAllPresent = () => {
    setSuccessMessage('');
    setRecords((currentRecords) =>
      currentRecords.map((record) => ({
        ...record,
        status: 'PRESENT',
      })),
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !profileId ||
      !institutionId ||
      !selectedOfferingId ||
      saveMutation.isPending ||
      records.length === 0
    ) {
      return;
    }

    await saveMutation.mutateAsync({
      institutionId,
      subjectOfferingId: selectedOfferingId,
      sessionDate,
      profileId,
      records: records.map((record) => ({
        studentId: record.studentId,
        status: record.status,
        notes: record.notes,
      })),
    });

    setSuccessMessage('Chamada salva com sucesso.');
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-bold text-[#181c20]">
              Chamada
            </h2>
            <p className="mt-1 text-sm text-[#727785]">
              {rollCallQuery.data?.session
                ? 'Sessão carregada para correção.'
                : 'Sessão ainda não salva.'}
            </p>
          </div>
        </div>
      </div>

      {offeringsQuery.isLoading && (
        <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
          Carregando atribuições...
        </div>
      )}

      {offeringsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {getErrorMessage(offeringsQuery.error)}
        </div>
      )}

      {!offeringsQuery.isLoading &&
        !offeringsQuery.isError &&
        offerings.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
            Nenhuma turma ou disciplina ativa vinculada ao professor.
          </div>
        )}

      {offerings.length > 0 && (
        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-[1.5fr_0.8fr_auto] md:items-end">
            <div>
              <label
                htmlFor="attendance-offering"
                className="text-xs font-bold uppercase tracking-wide text-[#727785]"
              >
                Atribuição
              </label>
              <select
                id="attendance-offering"
                value={selectedOfferingId}
                onChange={(event) => {
                  setSelectedOfferingId(
                    event.target.value,
                  );
                  setSuccessMessage('');
                }}
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              >
                {offerings.map((offering) => (
                  <option
                    key={offering.id}
                    value={offering.id}
                  >
                    {offering.subjectName} ·{' '}
                    {offering.className}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="attendance-date"
                className="text-xs font-bold uppercase tracking-wide text-[#727785]"
              >
                Data
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 focus-within:border-[#005bbf] focus-within:ring-2 focus-within:ring-blue-100">
                <CalendarDays
                  className="h-4 w-4 text-[#727785]"
                  aria-hidden="true"
                />
                <input
                  id="attendance-date"
                  type="date"
                  value={sessionDate}
                  onChange={(event) => {
                    setSessionDate(event.target.value);
                    setSuccessMessage('');
                  }}
                  className="w-full bg-transparent text-sm text-[#181c20] outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={markAllPresent}
              disabled={
                records.length === 0 ||
                saveMutation.isPending
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c8d4e3] px-4 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2
                className="h-4 w-4"
                aria-hidden="true"
              />
              Marcar presentes
            </button>
          </div>

          {rollCallQuery.isLoading && (
            <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
              Carregando alunos...
            </div>
          )}

          {rollCallQuery.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {getErrorMessage(rollCallQuery.error)}
            </div>
          )}

          {rollCallQuery.data &&
            rollCallQuery.data.records.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
                Nenhum aluno com matrícula ativa para esta data.
              </div>
            )}

          {rollCallQuery.data &&
            rollCallQuery.data.records.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[#dfe3e8]">
                <div className="hidden grid-cols-[1.4fr_0.7fr_1fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] md:grid">
                  <span>Aluno</span>
                  <span>Status</span>
                  <span>Observação</span>
                </div>

                <div className="divide-y divide-[#eef1f5]">
                  {rollCallQuery.data.records.map(
                    (record) => {
                      const editableRecord =
                        recordsByStudentId.get(
                          record.student.id,
                        );
                      const isDirty =
                        Boolean(editableRecord) &&
                        originalRecords.get(
                          record.student.id,
                        ) !==
                          getRecordKey(
                            editableRecord,
                          );

                      return (
                        <div
                          key={record.student.id}
                          className={`grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.7fr_1fr] md:items-center ${
                            isDirty
                              ? 'bg-amber-50/70'
                              : 'bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#181c20]">
                              {record.student.fullName}
                            </p>
                            <p className="mt-1 text-xs text-[#727785]">
                              Registro{' '}
                              {
                                record.student
                                  .registrationNumber
                              }
                              {isDirty
                                ? ' · não salvo'
                                : ''}
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor={`attendance-status-${record.student.id}`}
                              className="sr-only"
                            >
                              Status de{' '}
                              {record.student.fullName}
                            </label>
                            <select
                              id={`attendance-status-${record.student.id}`}
                              value={
                                editableRecord?.status ??
                                record.status
                              }
                              onChange={(event) =>
                                updateRecord(
                                  record.student.id,
                                  {
                                    status:
                                      event.target
                                        .value as AttendanceStatus,
                                  },
                                )
                              }
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                            >
                              {ATTENDANCE_RECORD_STATUSES.map(
                                (status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {
                                      ATTENDANCE_STATUS_LABELS[
                                        status
                                      ]
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`attendance-notes-${record.student.id}`}
                              className="sr-only"
                            >
                              Observação de{' '}
                              {record.student.fullName}
                            </label>
                            <input
                              id={`attendance-notes-${record.student.id}`}
                              value={
                                editableRecord?.notes ?? ''
                              }
                              onChange={(event) =>
                                updateRecord(
                                  record.student.id,
                                  {
                                    notes:
                                      event.target.value,
                                  },
                                )
                              }
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

          {saveMutation.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {getErrorMessage(saveMutation.error)}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
              {successMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                saveMutation.isPending ||
                records.length === 0 ||
                !hasUnsavedChanges
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a99] disabled:cursor-not-allowed disabled:bg-[#9db9dc]"
            >
              <Save
                className="h-4 w-4"
                aria-hidden="true"
              />
              {saveMutation.isPending
                ? 'Salvando...'
                : 'Salvar chamada'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
