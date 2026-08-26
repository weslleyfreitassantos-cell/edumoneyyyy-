import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
  UserPlus,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { useInviteSchoolUser } from '../../../../hooks/useSchoolUserInvites';
import {
  useSaveTeacherAcademicSettings,
  useSchoolTimeSlots,
} from '../../../../hooks/useAcademicAutomation';
import { useStudents } from '../../../../hooks/useStudents';
import { useSubjects } from '../../../../hooks/useSubjects';
import { hasEffectivePermission } from '../../../../lib/permissions';
import {
  SchoolUserInviteServiceError,
} from '../../../../services/schoolUserInviteService';
import { suggestTeacherAvailabilityFromSchoolSlots } from '../../../../services/academicAutomationService';
import {
  buildUnifiedUserInvitePayload,
  canInviteTarget,
  getAllowedInviteTargets,
  getUnifiedUserInviteOption,
  isUnifiedInviteTargetCurrentlySupported,
  UNIFIED_USER_INVITE_OPTIONS,
  type UnifiedUserInviteAvailabilityStatus,
  type UnifiedUserInviteFieldErrors,
  type UnifiedUserInviteTarget,
} from './unifiedUserInviteModel';

interface UnifiedUserInvitePreviewProps {
  institutionId: string | null;
  currentRole: string | null;
  profileRole: string | null | undefined;
  currentInstitutionName: string | null;
  hasActiveInstitution: boolean;
}

interface InviteFormState {
  fullName: string;
  email: string;
  birthDate: string;
  cpf: string;
  guardianStudentId: string;
  relationship: string;
}

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

interface TeacherAvailabilityDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const initialFormState: InviteFormState = {
  fullName: '',
  email: '',
  birthDate: '',
  cpf: '',
  guardianStudentId: '',
  relationship: '',
};

const availabilityDayLabels: Record<number, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

const availabilityLabels: Record<
  UnifiedUserInviteAvailabilityStatus,
  string
> = {
  available_now:
    'Fluxo real habilitado localmente',
};

function getTargetNote(
  target: UnifiedUserInviteTarget,
): string {
  switch (target) {
    case 'STUDENT':
      return 'Cria usuario, profile, membership STUDENT e registro em students. O RA continua gerado pelo banco e as credenciais sao enviadas por e-mail.';
    case 'TEACHER':
      return 'Cria usuario, profile e membership TEACHER e envia as credenciais por e-mail. Atribuicoes academicas seguem em fluxo separado.';
    case 'GUARDIAN':
      return 'Cria usuario, profile, membership GUARDIAN, vinculo guardianships e envia as credenciais por e-mail.';
    case 'DIRECTOR':
      return 'Cria usuario, profile e membership DIRECTOR. Apenas ADMIN da conta pode criar este acesso.';
    case 'SECRETARY':
      return 'Cria usuario, profile e membership SECRETARY para operacao institucional.';
  }
}

function getFieldError(
  fieldErrors: UnifiedUserInviteFieldErrors,
  field: keyof UnifiedUserInviteFieldErrors,
): string | undefined {
  return fieldErrors[field];
}

function FieldError({
  message,
}: {
  message: string | undefined;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-xs font-medium text-red-700">
      {message}
    </p>
  );
}

export default function UnifiedUserInvitePreview({
  institutionId,
  currentRole,
  profileRole,
  currentInstitutionName,
  hasActiveInstitution,
}: UnifiedUserInvitePreviewProps) {
  const [selectedTarget, setSelectedTarget] =
    useState<UnifiedUserInviteTarget>('STUDENT');
  const [form, setForm] =
    useState<InviteFormState>(
      initialFormState,
    );
  const [serverFieldErrors, setServerFieldErrors] =
    useState<UnifiedUserInviteFieldErrors>({});
  const [feedback, setFeedback] =
    useState<FeedbackState | null>(null);

  const inviteMutation = useInviteSchoolUser();
  const subjectsQuery = useSubjects(institutionId ?? '');
  const schoolTimeSlotsQuery = useSchoolTimeSlots(institutionId ?? '');
  const teacherAcademicMutation =
    useSaveTeacherAcademicSettings();
  const studentsQuery = useStudents(
    institutionId ?? '',
  );

  const [teacherSubjectIds, setTeacherSubjectIds] =
    useState<string[]>([]);
  const [teacherPrimarySubjectId, setTeacherPrimarySubjectId] =
    useState('');
  const [teacherAvailability, setTeacherAvailability] =
    useState<TeacherAvailabilityDraft[]>([]);
  const [teacherAcademicError, setTeacherAcademicError] =
    useState<string | null>(null);

  const selectedOption =
    getUnifiedUserInviteOption(
      selectedTarget,
    );

  const allowedTargets = useMemo(
    () => getAllowedInviteTargets(currentRole),
    [currentRole],
  );

  const visibleOptions = useMemo(() => {
    if (allowedTargets.length === 0) {
      return UNIFIED_USER_INVITE_OPTIONS;
    }

    return UNIFIED_USER_INVITE_OPTIONS.filter(
      (option) =>
        allowedTargets.includes(option.target),
    );
  }, [allowedTargets]);

  const canManageSchoolUsers =
    hasEffectivePermission({
      membershipRole: currentRole,
      profileRole,
      permission: 'manage_school_users',
    });

  const validation = useMemo(
    () =>
      buildUnifiedUserInvitePayload({
        institutionId,
        target: selectedTarget,
        fullName: form.fullName,
        email: form.email,
        birthDate: form.birthDate,
        cpf: form.cpf,
        guardianStudentId:
          form.guardianStudentId,
        relationship: form.relationship,
        currentRole,
      }),
    [
      currentRole,
      form.birthDate,
      form.cpf,
      form.email,
      form.fullName,
      form.guardianStudentId,
      form.relationship,
      institutionId,
      selectedTarget,
    ],
  );

  const clientFieldErrors =
    validation.success
      ? {}
      : validation.fieldErrors;

  const fieldErrors = {
    ...clientFieldErrors,
    ...serverFieldErrors,
  };

  const targetIsSupported =
    isUnifiedInviteTargetCurrentlySupported(
      selectedTarget,
    );

  const invalidAvailability = teacherAvailability.find(
    (window) => window.start_time >= window.end_time,
  );
  const teacherAcademicValidationError =
    selectedTarget !== 'TEACHER'
      ? null
      : teacherSubjectIds.length === 0
        ? 'Selecione pelo menos uma disciplina para o professor.'
        : teacherAvailability.length === 0
          ? 'Adicione pelo menos uma janela de disponibilidade semanal.'
          : invalidAvailability
            ? 'O horário final deve ser posterior ao horário inicial.'
            : null;

  const submitDisabled =
    !validation.success ||
    !canManageSchoolUsers ||
    !hasActiveInstitution ||
    !targetIsSupported ||
    !canInviteTarget(currentRole, selectedTarget) ||
    inviteMutation.isPending ||
    teacherAcademicMutation.isPending ||
    Boolean(teacherAcademicValidationError);

  useEffect(() => {
    setServerFieldErrors({});
    setFeedback(null);
    setTeacherAcademicError(null);
  }, [selectedTarget]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (
      allowedTargets.length > 0 &&
      !allowedTargets.includes(selectedTarget)
    ) {
      setSelectedTarget(allowedTargets[0]);
    }
  }, [allowedTargets, selectedTarget]);

  function updateForm(
    field: keyof InviteFormState,
    value: string,
  ): void {
    setServerFieldErrors((current) => {
      const next = { ...current };
      delete next[
        field as keyof UnifiedUserInviteFieldErrors
      ];
      return next;
    });
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectTarget(
    target: UnifiedUserInviteTarget,
  ): void {
    const option =
      getUnifiedUserInviteOption(target);

    if (
      option.isPlanned ||
      !canInviteTarget(currentRole, target)
    ) {
      return;
    }

    setSelectedTarget(target);
  }

  function resetForm(): void {
    setSelectedTarget('STUDENT');
    setForm(initialFormState);
    setServerFieldErrors({});
    setFeedback(null);
    setTeacherSubjectIds([]);
    setTeacherPrimarySubjectId('');
    setTeacherAvailability([]);
    setTeacherAcademicError(null);
  }

  function addTeacherAvailability(): void {
    setTeacherAcademicError(null);
    setTeacherAvailability((current) => [
      ...current,
      {
        day_of_week: 1,
        start_time: '07:00',
        end_time: '12:00',
      },
    ]);
  }

  function suggestTeacherAvailability(): void {
    const suggestions = suggestTeacherAvailabilityFromSchoolSlots(schoolTimeSlotsQuery.data ?? []);
    if (suggestions.length === 0) {
      setTeacherAcademicError('Cadastre os horários da escola antes de usar esta sugestão.');
      return;
    }
    if (teacherAvailability.length > 0 && !window.confirm('Substituir as janelas atuais pelos horários ativos da escola? Você poderá revisar antes de concluir o cadastro.')) {
      return;
    }
    setTeacherAvailability(suggestions);
    setTeacherAcademicError(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (inviteMutation.isPending) {
      return;
    }

    if (!validation.success) {
      setServerFieldErrors(
        validation.fieldErrors,
      );
      setFeedback({
        type: 'error',
        message:
          'Revise os campos destacados antes de enviar.',
      });
      return;
    }

    if (teacherAcademicValidationError) {
      setTeacherAcademicError(teacherAcademicValidationError);
      setFeedback({
        type: 'error',
        message: 'Complete a configuração acadêmica do professor antes de enviar o acesso.',
      });
      return;
    }

    setServerFieldErrors({});
    setFeedback(null);

    try {
      const result =
        await inviteMutation.mutateAsync(
          validation.payload,
        );

      if (selectedTarget === 'TEACHER') {
        try {
          await teacherAcademicMutation.mutateAsync({
            institution_id: validation.payload.institutionId,
            teacher_profile_id: result.profileId,
            subject_ids: teacherSubjectIds,
            primary_subject_id:
              teacherPrimarySubjectId || undefined,
            availability: teacherAvailability,
          });
        } catch (academicError) {
          setTeacherAcademicError(
            academicError instanceof Error
              ? academicError.message
              : 'O acesso foi criado, mas a configuração acadêmica não foi salva. Abra o professor e tente salvar novamente.',
          );
          setFeedback({
            type: 'error',
            message:
              'O acesso do professor foi criado e o e-mail foi enviado, mas as disciplinas e a disponibilidade não foram salvas.',
          });
          return;
        }
      }

      const successMessage =
        selectedTarget === 'TEACHER'
          ? `${result.message} Disciplinas e disponibilidade salvas.`
          : result.message;
      setSelectedTarget('STUDENT');
      setForm(initialFormState);
      setServerFieldErrors({});
      setTeacherSubjectIds([]);
      setTeacherPrimarySubjectId('');
      setTeacherAvailability([]);
      setTeacherAcademicError(null);
      setFeedback({
        type: 'success',
        message: successMessage,
      });
    } catch (error) {
      if (
        error instanceof
        SchoolUserInviteServiceError
      ) {
        setServerFieldErrors(
          error.fieldErrors ?? {},
        );
        setFeedback({
          type: 'error',
          message: error.message,
        });
        return;
      }

      setFeedback({
        type: 'error',
        message:
          'Nao foi possivel criar e enviar o acesso.',
      });
    }
  }

  return (
    <section
      id="unified-user-invite-preview"
      className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserPlus
              className="h-5 w-5 text-[#005bbf]"
              aria-hidden="true"
            />
            <h3 className="text-lg font-bold text-[#181c20]">
              Cadastro unificado de usuarios
            </h3>
          </div>
        </div>
      </div>

      {!hasActiveInstitution && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
        >
          Selecione uma escola ativa para criar acessos.
        </div>
      )}

      {!canManageSchoolUsers && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Seu papel na escola ativa nao permite gerenciar usuarios.
        </div>
      )}

      {feedback && (
        <div
          role="alert"
          className={`mt-4 flex gap-2 rounded-lg border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-6"
      >
        <div>
            <p className="text-sm font-semibold text-[#414754] dark:text-[#cbd5e1]">
              Tipo de usuario
            </p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleOptions.map(
                (option) => {
                  const optionDisabled =
                    inviteMutation.isPending ||
                    !canManageSchoolUsers ||
                    !hasActiveInstitution ||
                    option.isPlanned ||
                    !canInviteTarget(
                      currentRole,
                      option.target,
                    );

                  return (
                    <button
                      key={option.target}
                      type="button"
                      disabled={optionDisabled}
                      onClick={() =>
                        selectTarget(
                          option.target,
                        )
                      }
                      className={`min-h-[116px] rounded-lg border p-3 text-left transition-colors ${
                        selectedTarget ===
                        option.target
                          ? 'border-[#005bbf] bg-[#e8f0ff] dark:border-[#60a5fa] dark:bg-[#1e3a5f]/80'
                          : 'border-[#dfe3e8] bg-white hover:bg-gray-50 dark:border-[#334155] dark:bg-[#182235] dark:hover:bg-[#243247]'
                      } ${
                        optionDisabled
                          ? 'cursor-not-allowed opacity-70'
                          : ''
                      }`}
                    >
                      <span className="block text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[#727785] dark:text-[#cbd5e1]">
                        {option.description}
                      </span>
                      {option.isPlanned && (
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                          Em breve
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
            <FieldError
              message={getFieldError(
                fieldErrors,
                'target',
              )}
            />
          </div>

        <fieldset
          disabled={
            inviteMutation.isPending ||
            teacherAcademicMutation.isPending ||
            !canManageSchoolUsers ||
            !hasActiveInstitution
          }
          className="rounded-lg border border-[#dfe3e8] p-4"
        >
          <legend className="px-1 text-sm font-bold text-[#181c20]">
            Dados basicos
          </legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="unified-invite-full-name"
                className="block text-sm font-medium text-[#414754]"
              >
                Nome completo
              </label>
              <input
                id="unified-invite-full-name"
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  updateForm(
                    'fullName',
                    event.target.value,
                  )
                }
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
              <FieldError
                message={getFieldError(
                  fieldErrors,
                  'fullName',
                )}
              />
            </div>
            <div>
              <label
                htmlFor="unified-invite-email"
                className="block text-sm font-medium text-[#414754]"
              >
                E-mail
              </label>
              <input
                id="unified-invite-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateForm(
                    'email',
                    event.target.value,
                  )
                }
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
              <FieldError
                message={getFieldError(
                  fieldErrors,
                  'email',
                )}
              />
            </div>
          </div>
        </fieldset>

          <fieldset
            disabled={
              inviteMutation.isPending ||
              teacherAcademicMutation.isPending ||
              !canManageSchoolUsers ||
              !hasActiveInstitution
            }
            className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
          >
            <legend className="px-1 text-sm font-bold text-[#181c20]">
              Campos especificos
            </legend>

            {selectedTarget === 'STUDENT' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="unified-invite-birth-date"
                    className="block text-sm font-medium text-[#414754]"
                  >
                    Data de nascimento
                  </label>
                  <input
                    id="unified-invite-birth-date"
                    type="date"
                    value={form.birthDate}
                    onChange={(event) =>
                      updateForm(
                        'birthDate',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  />
                  <FieldError
                    message={getFieldError(
                      fieldErrors,
                      'birthDate',
                    )}
                  />
                </div>

                <div>
                  <label
                    htmlFor="unified-invite-cpf"
                    className="block text-sm font-medium text-[#414754]"
                  >
                    CPF opcional
                  </label>
                  <input
                    id="unified-invite-cpf"
                    type="text"
                    value={form.cpf}
                    onChange={(event) =>
                      updateForm(
                        'cpf',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  />
                  <FieldError
                    message={getFieldError(
                      fieldErrors,
                      'cpf',
                    )}
                  />
                </div>
              </div>
            )}

            {selectedTarget === 'TEACHER' && (
              <div className="space-y-5 rounded-lg bg-gray-50 p-4">
                <div>
                  <h4 className="font-semibold text-[#181c20]">
                    Configuração acadêmica do professor
                  </h4>
                  <p className="mt-1 text-xs text-[#727785]">
                    Selecione as disciplinas e informe quando o professor pode dar aulas. Esses dados serão salvos junto com o vínculo docente.
                  </p>
                </div>

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h5 className="text-sm font-semibold text-[#181c20]">
                      Disciplinas que pode lecionar
                    </h5>
                    <span className="text-xs text-[#727785]">
                      {teacherSubjectIds.length} selecionada(s)
                    </span>
                  </div>
                  {subjectsQuery.isLoading && (
                    <p className="mt-2 text-sm text-[#727785]">Carregando disciplinas...</p>
                  )}
                  {subjectsQuery.isError && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                      Não foi possível carregar as disciplinas da escola.
                    </p>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(subjectsQuery.data ?? [])
                      .filter((subject) => subject.active !== false)
                      .map((subject) => {
                        const selected = teacherSubjectIds.includes(subject.id);
                        return (
                          <div
                            key={subject.id}
                            className="flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm"
                          >
                            <label className="flex min-w-0 flex-1 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setTeacherAcademicError(null);
                                  setTeacherSubjectIds((current) =>
                                    selected
                                      ? current.filter((id) => id !== subject.id)
                                      : [...current, subject.id],
                                  );
                                  if (selected && teacherPrimarySubjectId === subject.id) {
                                    setTeacherPrimarySubjectId('');
                                  }
                                }}
                              />
                              <span className="truncate">{subject.name}</span>
                            </label>
                            {selected && (
                              <button
                                type="button"
                                className="text-xs font-semibold text-blue-700"
                                onClick={() => setTeacherPrimarySubjectId(subject.id)}
                                aria-label={`Definir ${subject.name} como principal`}
                              >
                                {teacherPrimarySubjectId === subject.id ? 'Principal' : 'Principal?'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </section>

                <section>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-semibold text-[#181c20]">
                        Disponibilidade semanal
                      </h5>
                      <p className="mt-1 text-xs text-[#727785]">
                        Cadastre janelas que cubram os horários da escola usados pela grade.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={suggestTeacherAvailability}
                        disabled={schoolTimeSlotsQuery.isLoading || schoolTimeSlotsQuery.isError || schoolTimeSlotsQuery.data?.length === 0}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Usar horários da escola
                      </button>
                      <button
                        type="button"
                        onClick={addTeacherAvailability}
                        className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        + Adicionar janela
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {teacherAvailability.map((window, index) => (
                      <div
                        key={`${window.day_of_week}-${index}`}
                        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                      >
                        <select
                          aria-label={`Dia da disponibilidade ${index + 1}`}
                          value={window.day_of_week}
                          onChange={(event) => {
                            setTeacherAcademicError(null);
                            setTeacherAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, day_of_week: Number(event.target.value) } : item));
                          }}
                          className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm"
                        >
                          {Object.entries(availabilityDayLabels).map(([day, label]) => (
                            <option key={day} value={day}>{label}</option>
                          ))}
                        </select>
                        <input
                          aria-label={`Início da disponibilidade ${index + 1}`}
                          type="time"
                          value={window.start_time}
                          onChange={(event) => {
                            setTeacherAcademicError(null);
                            setTeacherAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: event.target.value } : item));
                          }}
                          className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm"
                        />
                        <input
                          aria-label={`Fim da disponibilidade ${index + 1}`}
                          type="time"
                          value={window.end_time}
                          onChange={(event) => {
                            setTeacherAcademicError(null);
                            setTeacherAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: event.target.value } : item));
                          }}
                          className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTeacherAcademicError(null);
                            setTeacherAvailability((current) => current.filter((_item, itemIndex) => itemIndex !== index));
                          }}
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    {teacherAvailability.length === 0 && (
                      <p className="rounded-lg bg-white px-3 py-3 text-sm text-[#727785]">
                        Nenhuma janela cadastrada.
                      </p>
                    )}
                  </div>
                </section>

                {(teacherAcademicError ?? teacherAcademicValidationError) && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {teacherAcademicError ?? teacherAcademicValidationError}
                  </p>
                )}
              </div>
            )}

            {selectedTarget === 'DIRECTOR' && (
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#727785]">
                Diretor so pode ser convidado por ADMIN da conta.
              </p>
            )}

            {selectedTarget === 'SECRETARY' && (
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#727785]">
                Secretaria recebe acesso operacional para cadastros e matriculas da instituicao.
              </p>
            )}

            {selectedTarget === 'GUARDIAN' && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="unified-invite-student"
                    className="block text-sm font-medium text-[#414754]"
                  >
                    Aluno da instituicao
                  </label>
                  <select
                    id="unified-invite-student"
                    value={form.guardianStudentId}
                    onChange={(event) =>
                      updateForm(
                        'guardianStudentId',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">
                      {studentsQuery.isLoading
                        ? 'Carregando alunos...'
                        : 'Selecione um aluno'}
                    </option>
                    {(studentsQuery.data ?? [])
                      .filter(
                        (student) =>
                          student.active !== false,
                      )
                      .map((student) => (
                        <option
                          key={student.id}
                          value={student.id}
                        >
                          {student.profiles
                            ?.full_name ??
                            student.registration_number}
                        </option>
                      ))}
                  </select>
                  <FieldError
                    message={getFieldError(
                      fieldErrors,
                      'guardianStudentId',
                    )}
                  />
                  {studentsQuery.isError && (
                    <p className="mt-1 text-xs font-medium text-red-700">
                      Nao foi possivel carregar alunos desta escola.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="unified-invite-relationship"
                    className="block text-sm font-medium text-[#414754]"
                  >
                    Relacionamento
                  </label>
                  <input
                    id="unified-invite-relationship"
                    type="text"
                    placeholder="mae, pai, responsavel legal"
                    value={form.relationship}
                    onChange={(event) =>
                      updateForm(
                        'relationship',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none placeholder:text-gray-400 focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  />
                  <FieldError
                    message={getFieldError(
                      fieldErrors,
                      'relationship',
                    )}
                  />
                </div>
              </div>
            )}

          </fieldset>
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#dfe3e8] pt-5 sm:flex-row sm:items-center">
          {(inviteMutation.isPending || teacherAcademicMutation.isPending) && (
            <p className="mr-auto text-xs leading-relaxed text-[#727785]">
              Aguarde o retorno da funcao para evitar envio duplicado.
            </p>
          )}
          <button
            type="button"
            onClick={resetForm}
            disabled={inviteMutation.isPending || teacherAcademicMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-sm font-semibold text-[#414754] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#475569] dark:bg-[#182235] dark:text-[#e2e8f0] dark:hover:bg-[#243247]"
          >
            <RotateCcw
              className="h-4 w-4"
              aria-hidden="true"
            />
            Limpar formulario
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              submitDisabled
                ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-[#334155] dark:text-[#cbd5e1]'
                : 'bg-[#005bbf] text-white hover:bg-[#004a9f] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8]'
            }`}
          >
            {inviteMutation.isPending || teacherAcademicMutation.isPending ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Send
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
            {inviteMutation.isPending
              ? 'Enviando...'
              : teacherAcademicMutation.isPending
                ? 'Salvando configuração...'
              : 'Criar e enviar acesso'}
          </button>
        </div>
      </form>
    </section>
  );
}
