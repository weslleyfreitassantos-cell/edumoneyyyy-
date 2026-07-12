import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  BookMarked,
  Plus,
  Save,
} from 'lucide-react';

import {
  useAssessments,
  useCreateAssessment,
  useGradeEntry,
  useSaveGrades,
  useTeacherGradeOfferings,
} from '../../hooks/useGrades';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  type AssessmentStatus,
  type AssessmentType,
} from '../../services/gradeService';
import {
  ASSESSMENT_STATUS_LABELS,
  ASSESSMENT_TYPE_LABELS,
  formatAssessmentDate,
  getAssessmentStatusClassName,
  getTodayDateInputValue,
} from './gradeDisplay';

interface EditableGradeRecord {
  studentId: string;
  score: string;
  feedback: string;
  excused: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a operação.';
}

function getGradeKey(record: EditableGradeRecord): string {
  return [
    record.score.trim(),
    record.feedback.trim(),
    record.excused ? 'EXCUSED' : 'GRADE',
  ].join(':');
}

function parseScore(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export default function TeacherAssessmentsPanel({
  profileId,
  institutionId,
}: {
  profileId: string | undefined;
  institutionId: string | undefined;
}) {
  const [selectedOfferingId, setSelectedOfferingId] =
    useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] =
    useState('');
  const [title, setTitle] = useState('');
  const [assessmentType, setAssessmentType] =
    useState<AssessmentType>('EXAM');
  const [assessmentDate, setAssessmentDate] = useState(
    getTodayDateInputValue,
  );
  const [maxScore, setMaxScore] = useState('10');
  const [weight, setWeight] = useState('1');
  const [status, setStatus] =
    useState<AssessmentStatus>('PUBLISHED');
  const [description, setDescription] = useState('');
  const [grades, setGrades] = useState<
    EditableGradeRecord[]
  >([]);
  const [successMessage, setSuccessMessage] =
    useState('');

  const offeringsQuery = useTeacherGradeOfferings(
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

  const selectedOffering = offerings.find(
    (offering) => offering.id === selectedOfferingId,
  );

  const assessmentsQuery = useAssessments(
    institutionId,
    selectedOfferingId || undefined,
  );
  const assessments = assessmentsQuery.data ?? [];

  useEffect(() => {
    if (
      assessments.length > 0 &&
      !assessments.some(
        (assessment) =>
          assessment.id === selectedAssessmentId,
      )
    ) {
      setSelectedAssessmentId(assessments[0].id);
    }
  }, [assessments, selectedAssessmentId]);

  const gradeEntryQuery = useGradeEntry(
    institutionId,
    selectedAssessmentId || undefined,
  );
  const saveGradesMutation = useSaveGrades();
  const createAssessmentMutation =
    useCreateAssessment();

  useEffect(() => {
    if (!gradeEntryQuery.data) {
      setGrades([]);
      return;
    }

    setGrades(
      gradeEntryQuery.data.records.map((record) => ({
        studentId: record.student.id,
        score:
          record.score === null
            ? ''
            : String(record.score),
        feedback: record.feedback ?? '',
        excused: record.status === 'EXCUSED',
      })),
    );
    setSuccessMessage('');
  }, [gradeEntryQuery.data, gradeEntryQuery.dataUpdatedAt]);

  const originalGrades = useMemo(() => {
    const values = new Map<string, string>();

    for (const record of gradeEntryQuery.data?.records ?? []) {
      values.set(
        record.student.id,
        getGradeKey({
          studentId: record.student.id,
          score:
            record.score === null
              ? ''
              : String(record.score),
          feedback: record.feedback ?? '',
          excused: record.status === 'EXCUSED',
        }),
      );
    }

    return values;
  }, [gradeEntryQuery.data]);

  const gradesByStudentId = useMemo(
    () =>
      new Map(
        grades.map((record) => [
          record.studentId,
          record,
        ]),
      ),
    [grades],
  );

  const hasUnsavedGrades = grades.some(
    (record) =>
      originalGrades.get(record.studentId) !==
      getGradeKey(record),
  );

  const selectedAssessment =
    gradeEntryQuery.data?.assessment;

  const hasInvalidGrades =
    Boolean(selectedAssessment) &&
    grades.some((record) => {
      if (record.excused || !record.score.trim()) {
        return false;
      }

      const parsed = parseScore(record.score);

      return (
        parsed === null ||
        parsed < 0 ||
        parsed > selectedAssessment!.maxScore
      );
    });

  const updateGrade = (
    studentId: string,
    changes: Partial<
      Pick<
        EditableGradeRecord,
        'score' | 'feedback' | 'excused'
      >
    >,
  ) => {
    setSuccessMessage('');
    setGrades((currentGrades) =>
      currentGrades.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              ...changes,
            }
          : record,
      ),
    );
  };

  const handleCreateAssessment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !profileId ||
      !institutionId ||
      !selectedOffering ||
      createAssessmentMutation.isPending
    ) {
      return;
    }

    const created =
      await createAssessmentMutation.mutateAsync({
        institutionId,
        subjectOfferingId: selectedOffering.id,
        termId: selectedOffering.termId,
        title,
        description,
        assessmentType,
        assessmentDate,
        maxScore: Number(maxScore),
        weight: Number(weight),
        status,
        profileId,
      });

    setSelectedAssessmentId(created.id);
    setTitle('');
    setDescription('');
    setSuccessMessage('Avaliação criada com sucesso.');
  };

  const handleSaveGrades = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !profileId ||
      !institutionId ||
      !selectedAssessment ||
      saveGradesMutation.isPending
    ) {
      return;
    }

    await saveGradesMutation.mutateAsync({
      institutionId,
      assessmentId: selectedAssessment.id,
      profileId,
      grades: grades.map((record) => ({
        studentId: record.studentId,
        score: record.excused
          ? null
          : parseScore(record.score),
        status: record.excused
          ? 'EXCUSED'
          : parseScore(record.score) === null
            ? 'PENDING'
            : 'GRADED',
        feedback: record.feedback,
      })),
    });

    setSuccessMessage('Notas salvas com sucesso.');
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <BookMarked
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-lg font-bold text-[#181c20]">
            Avaliações e notas
          </h2>
          <p className="mt-1 text-sm text-[#727785]">
            Criação de avaliações e lançamento em lote.
          </p>
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
        <div className="space-y-6">
          <div>
            <label
              htmlFor="grade-offering"
              className="text-xs font-bold uppercase tracking-wide text-[#727785]"
            >
              Atribuição
            </label>
            <select
              id="grade-offering"
              value={selectedOfferingId}
              onChange={(event) => {
                setSelectedOfferingId(event.target.value);
                setSelectedAssessmentId('');
                setSuccessMessage('');
              }}
              className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            >
              {offerings.map((offering) => (
                <option
                  key={offering.id}
                  value={offering.id}
                >
                  {offering.subjectName} ·{' '}
                  {offering.className} ·{' '}
                  {offering.termName ?? 'Período'}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={handleCreateAssessment}
            className="rounded-lg border border-[#dfe3e8] p-4"
          >
            <div className="mb-4 flex items-center gap-2">
              <Plus
                className="h-4 w-4 text-[#005bbf]"
                aria-hidden="true"
              />
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                Nova avaliação
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <label
                  htmlFor="assessment-title"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Título
                </label>
                <input
                  id="assessment-title"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="assessment-type"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Tipo
                </label>
                <select
                  id="assessment-type"
                  value={assessmentType}
                  onChange={(event) =>
                    setAssessmentType(
                      event.target.value as AssessmentType,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                >
                  {ASSESSMENT_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {ASSESSMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="assessment-date"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Data
                </label>
                <input
                  id="assessment-date"
                  type="date"
                  value={assessmentDate}
                  onChange={(event) =>
                    setAssessmentDate(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="assessment-max-score"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Nota máxima
                </label>
                <input
                  id="assessment-max-score"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={maxScore}
                  onChange={(event) =>
                    setMaxScore(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="assessment-weight"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Peso
                </label>
                <input
                  id="assessment-weight"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={weight}
                  onChange={(event) =>
                    setWeight(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="assessment-status"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Status
                </label>
                <select
                  id="assessment-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as AssessmentStatus,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                >
                  {ASSESSMENT_STATUSES.map(
                    (assessmentStatus) => (
                      <option
                        key={assessmentStatus}
                        value={assessmentStatus}
                      >
                        {
                          ASSESSMENT_STATUS_LABELS[
                            assessmentStatus
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <label
                  htmlFor="assessment-description"
                  className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                >
                  Descrição
                </label>
                <input
                  id="assessment-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {createAssessmentMutation.isError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {getErrorMessage(
                  createAssessmentMutation.error,
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={
                  createAssessmentMutation.isPending ||
                  !title.trim() ||
                  Number(maxScore) <= 0 ||
                  Number(weight) <= 0
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a99] disabled:cursor-not-allowed disabled:bg-[#9db9dc]"
              >
                <Plus
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                {createAssessmentMutation.isPending
                  ? 'Criando...'
                  : 'Criar avaliação'}
              </button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-[#dfe3e8] p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                Avaliações
              </h3>

              {assessmentsQuery.isLoading && (
                <p className="mt-4 text-sm text-[#727785]">
                  Carregando avaliações...
                </p>
              )}

              {assessmentsQuery.isError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {getErrorMessage(assessmentsQuery.error)}
                </div>
              )}

              {!assessmentsQuery.isLoading &&
                assessments.length === 0 && (
                  <div className="mt-4 rounded-lg border border-dashed border-[#c1c6d6] p-5 text-center text-sm text-[#727785]">
                    Nenhuma avaliação cadastrada para esta atribuição.
                  </div>
                )}

              <div className="mt-4 space-y-2">
                {assessments.map((assessment) => (
                  <button
                    key={assessment.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssessmentId(
                        assessment.id,
                      );
                      setSuccessMessage('');
                    }}
                    className={
                      selectedAssessmentId === assessment.id
                        ? 'w-full rounded-lg border-2 border-[#005bbf] p-3 text-left'
                        : 'w-full rounded-lg border border-[#dfe3e8] p-3 text-left transition-colors hover:border-[#005bbf]'
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#181c20]">
                          {assessment.title}
                        </p>
                        <p className="mt-1 text-xs text-[#727785]">
                          {formatAssessmentDate(
                            assessment.assessmentDate,
                          )}{' '}
                          ·{' '}
                          {
                            ASSESSMENT_TYPE_LABELS[
                              assessment.assessmentType
                            ]
                          }
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${getAssessmentStatusClassName(
                          assessment.status,
                        )}`}
                      >
                        {
                          ASSESSMENT_STATUS_LABELS[
                            assessment.status
                          ]
                        }
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSaveGrades}
              className="rounded-lg border border-[#dfe3e8] p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                    Lançamento de notas
                  </h3>
                  <p className="mt-1 text-sm text-[#727785]">
                    {selectedAssessment
                      ? `${selectedAssessment.title} · máxima ${selectedAssessment.maxScore}`
                      : 'Selecione uma avaliação.'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    saveGradesMutation.isPending ||
                    !hasUnsavedGrades ||
                    hasInvalidGrades ||
                    !selectedAssessment ||
                    grades.length === 0
                  }
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a99] disabled:cursor-not-allowed disabled:bg-[#9db9dc]"
                >
                  <Save
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  {saveGradesMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar notas'}
                </button>
              </div>

              {gradeEntryQuery.isLoading && (
                <p className="mt-4 text-sm text-[#727785]">
                  Carregando alunos...
                </p>
              )}

              {gradeEntryQuery.isError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {getErrorMessage(gradeEntryQuery.error)}
                </div>
              )}

              {gradeEntryQuery.data &&
                gradeEntryQuery.data.records.length === 0 && (
                  <div className="mt-4 rounded-lg border border-dashed border-[#c1c6d6] p-5 text-center text-sm text-[#727785]">
                    Nenhum aluno com matrícula válida para a data da avaliação.
                  </div>
                )}

              {gradeEntryQuery.data &&
                gradeEntryQuery.data.records.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-[#dfe3e8]">
                    <div className="hidden grid-cols-[1.2fr_0.45fr_0.5fr_0.9fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] md:grid">
                      <span>Aluno</span>
                      <span>Nota</span>
                      <span>Dispensa</span>
                      <span>Feedback</span>
                    </div>

                    <div className="divide-y divide-[#eef1f5]">
                      {gradeEntryQuery.data.records.map(
                        (record) => {
                          const editable =
                            gradesByStudentId.get(
                              record.student.id,
                            );
                          const isDirty =
                            Boolean(editable) &&
                            originalGrades.get(
                              record.student.id,
                            ) !== getGradeKey(editable);
                          const currentScore =
                            editable?.score ?? '';
                          const parsedScore =
                            parseScore(currentScore);
                          const isOutOfRange =
                            currentScore.trim().length > 0 &&
                            selectedAssessment !== undefined &&
                            (parsedScore === null ||
                              parsedScore < 0 ||
                              parsedScore >
                                selectedAssessment.maxScore);

                          return (
                            <div
                              key={record.student.id}
                              className={`grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_0.45fr_0.5fr_0.9fr] md:items-center ${
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
                                  htmlFor={`grade-score-${record.student.id}`}
                                  className="sr-only"
                                >
                                  Nota de{' '}
                                  {record.student.fullName}
                                </label>
                                <input
                                  id={`grade-score-${record.student.id}`}
                                  inputMode="decimal"
                                  value={currentScore}
                                  disabled={editable?.excused}
                                  onChange={(event) =>
                                    updateGrade(
                                      record.student.id,
                                      {
                                        score:
                                          event.target.value,
                                        excused: false,
                                      },
                                    )
                                  }
                                  className={
                                    isOutOfRange
                                      ? 'w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 outline-none focus:ring-2 focus:ring-red-100'
                                      : 'w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100'
                                  }
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`grade-excused-${record.student.id}`}
                                  className="flex items-center gap-2 text-sm text-[#181c20]"
                                >
                                  <input
                                    id={`grade-excused-${record.student.id}`}
                                    type="checkbox"
                                    checked={
                                      editable?.excused ??
                                      false
                                    }
                                    onChange={(event) =>
                                      updateGrade(
                                        record.student.id,
                                        {
                                          excused:
                                            event.target
                                              .checked,
                                          score:
                                            event.target
                                              .checked
                                              ? ''
                                              : currentScore,
                                        },
                                      )
                                    }
                                    className="h-4 w-4 rounded border-[#dfe3e8] text-[#005bbf]"
                                  />
                                  Sim
                                </label>
                              </div>

                              <div>
                                <label
                                  htmlFor={`grade-feedback-${record.student.id}`}
                                  className="sr-only"
                                >
                                  Feedback de{' '}
                                  {record.student.fullName}
                                </label>
                                <input
                                  id={`grade-feedback-${record.student.id}`}
                                  value={
                                    editable?.feedback ?? ''
                                  }
                                  onChange={(event) =>
                                    updateGrade(
                                      record.student.id,
                                      {
                                        feedback:
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

              {saveGradesMutation.isError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {getErrorMessage(saveGradesMutation.error)}
                </div>
              )}
            </form>
          </div>

          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
              {successMessage}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
