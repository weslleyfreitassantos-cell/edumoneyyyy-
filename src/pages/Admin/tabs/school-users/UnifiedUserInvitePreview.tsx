import {
  AlertTriangle,
  RotateCcw,
  Send,
  UserPlus,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import { hasEffectivePermission } from '../../../../lib/permissions';
import { unifiedUserInvitePreviewSchema } from '../../../../schemas/adminSchemas';
import {
  getUnifiedUserInviteOption,
  UNIFIED_USER_INVITE_OPTIONS,
  type UnifiedUserInviteAvailabilityStatus,
  type UnifiedUserInviteTarget,
} from './unifiedUserInviteModel';

interface UnifiedUserInvitePreviewProps {
  currentRole: string | null;
  profileRole: string | null | undefined;
  currentInstitutionName: string | null;
  hasActiveInstitution: boolean;
}

interface PreviewFormState {
  fullName: string;
  email: string;
  phone: string;
  createAccess: boolean;
  academicCode: string;
  teacherArea: string;
  linkedStudentName: string;
  relationship: string;
}

const initialFormState: PreviewFormState = {
  fullName: '',
  email: '',
  phone: '',
  createAccess: true,
  academicCode: '',
  teacherArea: '',
  linkedStudentName: '',
  relationship: '',
};

const availabilityLabels: Record<
  UnifiedUserInviteAvailabilityStatus,
  string
> = {
  available_now_visual_only:
    'Disponível apenas como prévia visual',
  planned_requires_database:
    'Depende de suporte no banco',
  planned_requires_edge_function:
    'Depende de Edge Function segura',
  planned_requires_migration_reconciliation:
    'Depende da reconciliação das migrations',
};

function getTargetNote(
  target: UnifiedUserInviteTarget,
): string {
  switch (target) {
    case 'STUDENT':
      return 'O vínculo acadêmico real depende de students e enrollments.';
    case 'TEACHER':
      return 'A alocação real depende de subject_offerings e assignments.';
    case 'GUARDIAN':
      return 'O vínculo real depende de guardianships.';
    case 'DIRECTOR':
      return 'DIRECTOR já existe como papel atual do banco, mas a criação real exigiria fluxo seguro de Auth e Edge Function.';
    case 'SCHOOL_ADMIN_PLANNED':
      return 'SCHOOL_ADMIN ainda não existe no banco e não pode ser ativado nesta etapa.';
    case 'SECRETARY_PLANNED':
      return 'SECRETARY ainda não existe no banco e não pode ser ativado nesta etapa.';
  }
}

export default function UnifiedUserInvitePreview({
  currentRole,
  profileRole,
  currentInstitutionName,
  hasActiveInstitution,
}: UnifiedUserInvitePreviewProps) {
  const [selectedTarget, setSelectedTarget] =
    useState<UnifiedUserInviteTarget>('STUDENT');
  const [form, setForm] =
    useState<PreviewFormState>(
      initialFormState,
    );

  const selectedOption =
    getUnifiedUserInviteOption(
      selectedTarget,
    );

  const canManageSchoolUsers =
    hasEffectivePermission({
      membershipRole: currentRole,
      profileRole,
      permission: 'manage_school_users',
    });

  const fieldsDisabled =
    !canManageSchoolUsers ||
    !hasActiveInstitution;

  const previewValidation = useMemo(
    () =>
      unifiedUserInvitePreviewSchema.safeParse({
        target_type: selectedTarget,
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
        create_access: form.createAccess,
        academic_code: form.academicCode,
        teacher_area: form.teacherArea,
        linked_student_name:
          form.linkedStudentName,
        relationship: form.relationship,
      }),
    [form, selectedTarget],
  );

  function updateForm(
    field: keyof PreviewFormState,
    value: string | boolean,
  ): void {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetPreview(): void {
    setSelectedTarget('STUDENT');
    setForm(initialFormState);
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
              Cadastro unificado de usuários
            </h3>
          </div>

          <p className="mt-1 text-sm text-[#727785]">
            Prévia do fluxo de cadastro e convite. Nenhum usuário será criado nesta etapa.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Prévia somente visual. Nenhum registro será criado.
        </div>
      </div>

      {!hasActiveInstitution && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
        >
          Selecione uma escola ativa para preparar o cadastro unificado.
        </div>
      )}

      {!canManageSchoolUsers && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Seu papel na escola ativa não permite gerenciar usuários.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-[#414754]">
              Tipo de usuário
            </p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {UNIFIED_USER_INVITE_OPTIONS.map(
                (option) => (
                  <button
                    key={option.target}
                    type="button"
                    disabled={fieldsDisabled}
                    onClick={() =>
                      setSelectedTarget(
                        option.target,
                      )
                    }
                    className={`min-h-[116px] rounded-lg border p-3 text-left transition-colors ${
                      selectedTarget ===
                      option.target
                        ? 'border-[#005bbf] bg-blue-50'
                        : 'border-[#dfe3e8] bg-white hover:bg-gray-50'
                    } ${
                      fieldsDisabled
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
                        Ainda não ativo no banco.
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset
              disabled={fieldsDisabled}
              className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
            >
              <legend className="px-1 text-sm font-bold text-[#181c20]">
                Dados básicos
              </legend>

              <label className="block text-sm font-medium text-[#414754]">
                Nome completo
                <input
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
              </label>

              <label className="block text-sm font-medium text-[#414754]">
                E-mail
                <input
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
              </label>

              <label className="block text-sm font-medium text-[#414754]">
                Telefone, opcional
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm(
                      'phone',
                      event.target.value,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </fieldset>

            <fieldset
              disabled={fieldsDisabled}
              className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
            >
              <legend className="px-1 text-sm font-bold text-[#181c20]">
                Acesso e vínculo escolar
              </legend>

              <label className="flex items-center gap-2 text-sm font-medium text-[#414754]">
                <input
                  type="checkbox"
                  checked={form.createAccess}
                  onChange={(event) =>
                    updateForm(
                      'createAccess',
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4 rounded border-[#dfe3e8]"
                />
                Criar acesso ao sistema?
              </label>

              <p className="text-xs leading-relaxed text-[#727785]">
                Login, senha e convite ainda serão homologados depois.
              </p>

              <label className="block text-sm font-medium text-[#414754]">
                Papel na escola
                <input
                  type="text"
                  readOnly
                  value={selectedOption.rolePreview}
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-gray-50 px-3 py-2 text-sm text-[#181c20]"
                />
              </label>

              <label className="block text-sm font-medium text-[#414754]">
                Instituição ativa
                <input
                  type="text"
                  readOnly
                  value={
                    currentInstitutionName ??
                    'Nenhuma escola ativa'
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-gray-50 px-3 py-2 text-sm text-[#181c20]"
                />
              </label>

              <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-[#727785]">
                Status previsto do vínculo: ativo somente após convite, validação segura e escrita controlada no backend.
              </p>
            </fieldset>
          </div>

          <fieldset
            disabled={fieldsDisabled}
            className="space-y-3 rounded-lg border border-[#dfe3e8] p-4"
          >
            <legend className="px-1 text-sm font-bold text-[#181c20]">
              Campos específicos
            </legend>

            {selectedTarget === 'STUDENT' && (
              <label className="block text-sm font-medium text-[#414754]">
                Matrícula/código acadêmico
                <input
                  type="text"
                  value={form.academicCode}
                  onChange={(event) =>
                    updateForm(
                      'academicCode',
                      event.target.value,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </label>
            )}

            {selectedTarget === 'TEACHER' && (
              <label className="block text-sm font-medium text-[#414754]">
                Área/disciplina de atuação
                <input
                  type="text"
                  value={form.teacherArea}
                  onChange={(event) =>
                    updateForm(
                      'teacherArea',
                      event.target.value,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                />
              </label>
            )}

            {selectedTarget === 'GUARDIAN' && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-[#414754]">
                  Nome do aluno vinculado
                  <input
                    type="text"
                    value={form.linkedStudentName}
                    onChange={(event) =>
                      updateForm(
                        'linkedStudentName',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block text-sm font-medium text-[#414754]">
                  Tipo de relação
                  <input
                    type="text"
                    placeholder="mãe, pai, responsável legal"
                    value={form.relationship}
                    onChange={(event) =>
                      updateForm(
                        'relationship',
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none placeholder:text-gray-400 focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            <p
              className={
                selectedOption.isPlanned
                  ? 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700'
                  : 'rounded-lg bg-blue-50 p-3 text-sm text-[#005bbf]'
              }
            >
              {getTargetNote(selectedTarget)}
            </p>
          </fieldset>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[#dfe3e8] p-4">
            <h4 className="text-sm font-bold text-[#181c20]">
              Prévia do que será criado no futuro
            </h4>

            <p className="mt-1 text-xs leading-relaxed text-[#727785]">
              Prévia somente visual. Nenhum registro será criado.
            </p>

            <ul className="mt-3 space-y-2 text-sm text-[#414754]">
              {selectedOption.futureRecords.map(
                (record) => (
                  <li
                    key={record}
                    className="rounded-lg bg-gray-50 px-3 py-2"
                  >
                    {record}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-[#dfe3e8] p-4">
            <h4 className="text-sm font-bold text-[#181c20]">
              Disponibilidade
            </h4>

            <ul className="mt-3 space-y-2 text-xs text-[#727785]">
              {selectedOption.availabilityStatuses.map(
                (status) => (
                  <li
                    key={status}
                    className="rounded-lg bg-gray-50 px-3 py-2"
                  >
                    {availabilityLabels[status]}
                  </li>
                ),
              )}
            </ul>
          </div>

          {!previewValidation.success && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Prévia local incompleta: informe pelo menos o nome completo e revise o e-mail, se preenchido.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled
              title="Envio será habilitado somente após reconciliação das migrations, roles planejadas e Edge Functions."
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
            >
              <Send
                className="h-4 w-4"
                aria-hidden="true"
              />
              Enviar convite
            </button>

            <button
              type="button"
              onClick={resetPreview}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-sm font-semibold text-[#414754] transition-colors hover:bg-gray-50"
            >
              <RotateCcw
                className="h-4 w-4"
                aria-hidden="true"
              />
              Limpar prévia
            </button>

            <p className="text-xs leading-relaxed text-[#727785]">
              Envio será habilitado somente após reconciliação das migrations, roles planejadas e Edge Functions.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
