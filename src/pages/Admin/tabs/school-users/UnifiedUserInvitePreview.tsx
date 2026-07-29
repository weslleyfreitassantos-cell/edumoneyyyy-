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
import { useStudents } from '../../../../hooks/useStudents';
import { hasEffectivePermission } from '../../../../lib/permissions';
import {
  SchoolUserInviteServiceError,
} from '../../../../services/schoolUserInviteService';
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

const initialFormState: InviteFormState = {
  fullName: '',
  email: '',
  birthDate: '',
  cpf: '',
  guardianStudentId: '',
  relationship: '',
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
      return 'Cria usuario, profile, membership STUDENT e registro em students. O RA continua gerado pelo banco.';
    case 'TEACHER':
      return 'Cria usuario, profile e membership TEACHER. Atribuicoes academicas seguem em fluxo separado.';
    case 'GUARDIAN':
      return 'Cria usuario, profile, membership GUARDIAN e vinculo guardianships com aluno da escola ativa.';
    case 'DIRECTOR':
      return 'Cria usuario, profile e membership DIRECTOR. Apenas ADMIN da conta pode convidar diretor.';
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
  const studentsQuery = useStudents(
    institutionId ?? '',
  );

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

  const submitDisabled =
    !validation.success ||
    !canManageSchoolUsers ||
    !hasActiveInstitution ||
    !targetIsSupported ||
    !canInviteTarget(currentRole, selectedTarget) ||
    inviteMutation.isPending;

  useEffect(() => {
    setServerFieldErrors({});
    setFeedback(null);
  }, [selectedTarget]);

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

    setServerFieldErrors({});
    setFeedback(null);

    try {
      const result =
        await inviteMutation.mutateAsync(
          validation.payload,
        );

      setFeedback({
        type: 'success',
        message: result.message,
      });
      setSelectedTarget('STUDENT');
      setForm(initialFormState);
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
          'Nao foi possivel enviar o convite.',
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
          Selecione uma escola ativa para enviar convites.
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
        className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-[#414754]">
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
                          ? 'border-[#005bbf] bg-blue-50'
                          : 'border-[#dfe3e8] bg-white hover:bg-gray-50'
                      } ${
                        optionDisabled
                          ? 'cursor-not-allowed opacity-70'
                          : ''
                      }`}
                    >
                      <span className="block text-sm font-bold text-[#181c20]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[#727785]">
                        {option.description}
                      </span>
                      {option.isPlanned && (
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
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

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset
              disabled={
                inviteMutation.isPending ||
                !canManageSchoolUsers ||
                !hasActiveInstitution
              }
              className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
            >
              <legend className="px-1 text-sm font-bold text-[#181c20]">
                Dados basicos
              </legend>

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
                className="w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
              <FieldError
                message={getFieldError(
                  fieldErrors,
                  'fullName',
                )}
              />

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
                className="w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
              <FieldError
                message={getFieldError(
                  fieldErrors,
                  'email',
                )}
              />
            </fieldset>

            <fieldset
              disabled
              className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
            >
              <legend className="px-1 text-sm font-bold text-[#181c20]">
                Vinculo escolar
              </legend>

              <label
                htmlFor="unified-invite-role"
                className="block text-sm font-medium text-[#414754]"
              >
                Papel na escola
              </label>
              <input
                id="unified-invite-role"
                type="text"
                readOnly
                value={selectedOption.rolePreview}
                className="w-full rounded-lg border border-[#dfe3e8] bg-gray-50 px-3 py-2 text-sm text-[#181c20]"
              />

              <label
                htmlFor="unified-invite-institution"
                className="block text-sm font-medium text-[#414754]"
              >
                Instituicao ativa
              </label>
              <input
                id="unified-invite-institution"
                type="text"
                readOnly
                value={
                  currentInstitutionName ??
                  'Nenhuma escola ativa'
                }
                className="w-full rounded-lg border border-[#dfe3e8] bg-gray-50 px-3 py-2 text-sm text-[#181c20]"
              />
              <FieldError
                message={getFieldError(
                  fieldErrors,
                  'institutionId',
                )}
              />
            </fieldset>
          </div>

          <fieldset
            disabled={
              inviteMutation.isPending ||
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
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-[#727785]">
                Professor nao recebe atribuicoes automaticamente neste fluxo.
              </p>
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
        </div>

        <aside className="space-y-4">
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitDisabled}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                submitDisabled
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-[#005bbf] text-white hover:bg-[#004a9f]'
              }`}
            >
              {inviteMutation.isPending ? (
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
                : 'Enviar convite'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={inviteMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-sm font-semibold text-[#414754] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RotateCcw
                className="h-4 w-4"
                aria-hidden="true"
              />
              Limpar formulario
            </button>

            {inviteMutation.isPending && (
              <p className="text-xs leading-relaxed text-[#727785]">
                Aguarde o retorno da funcao para evitar envio duplicado.
              </p>
            )}
          </div>
        </aside>
      </form>
    </section>
  );
}
