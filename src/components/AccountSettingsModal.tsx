import {
  Eye,
  EyeOff,
  Loader2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { accountSettingsSchema } from '../schemas/profileSchemas';
import {
  selfRegistrationService,
  type SelfRegistrationData,
  type SelfRegistrationUpdate,
  type StudentSelfRegistration,
} from '../services/selfRegistrationService';
import type { User } from '../types';

interface AccountSettingsModalProps {
  currentName: string;
  email: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onUpdateName: (fullName: string) => Promise<void>;
  onUpdateSelfRegistration: (input: SelfRegistrationUpdate) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onSuccess: (message: string) => void;
  currentRole: User['role'];
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getOperationErrorMessage(
  error: unknown,
  operation: 'name' | 'password' | 'registration',
): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'SESSION_EXPIRED'
  ) {
    return 'Sua sessão expirou. Entre novamente.';
  }

  if (operation === 'registration') {
    return 'Não foi possível atualizar seu cadastro.';
  }

  return operation === 'name'
    ? 'Não foi possível atualizar seu nome.'
    : 'Não foi possível alterar sua senha.';
}

const inputClass =
  'mt-1 h-11 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 disabled:cursor-wait disabled:bg-[#f3f6fb] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]';

const textareaClass =
  'mt-1 min-h-20 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 disabled:cursor-wait disabled:bg-[#f3f6fb] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]';

function fieldLabel(text: string): string {
  return `block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]`;
}

function StudentRegistrationFields({
  data,
  disabled,
  onChange,
}: {
  data: StudentSelfRegistration['student'];
  disabled: boolean;
  onChange: (next: StudentSelfRegistration['student']) => void;
}) {
  function updateStudent<K extends keyof StudentSelfRegistration['student']>(
    key: K,
    value: StudentSelfRegistration['student'][K],
  ): void {
    onChange({ ...data, [key]: value });
  }

  function updateAddress<K extends keyof StudentSelfRegistration['student']['address']>(
    key: K,
    value: StudentSelfRegistration['student']['address'][K],
  ): void {
    updateStudent('address', { ...data.address, [key]: value });
  }

  function updatePrevious<K extends keyof StudentSelfRegistration['student']['previousSchooling']>(
    key: K,
    value: StudentSelfRegistration['student']['previousSchooling'][K],
  ): void {
    updateStudent('previousSchooling', { ...data.previousSchooling, [key]: value });
  }

  function updateHealth<K extends keyof StudentSelfRegistration['student']['health']>(
    key: K,
    value: StudentSelfRegistration['student']['health'][K],
  ): void {
    updateStudent('health', { ...data.health, [key]: value });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#d8deea] p-4">
        <h3 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">
          Dados pessoais
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={fieldLabel('Data de nascimento')} htmlFor="self-birth-date">Data de nascimento</label>
            <input id="self-birth-date" type="date" value={data.birthDate} onChange={(event) => updateStudent('birthDate', event.target.value)} disabled={disabled} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('CPF')} htmlFor="self-cpf">CPF</label>
            <input id="self-cpf" value={data.cpf} onChange={(event) => updateStudent('cpf', event.target.value)} disabled={disabled} maxLength={14} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('Nome social')} htmlFor="self-social-name">Nome social</label>
            <input id="self-social-name" value={data.socialName} onChange={(event) => updateStudent('socialName', event.target.value)} disabled={disabled} maxLength={120} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('Sexo')} htmlFor="self-sex">Sexo</label>
            <input id="self-sex" value={data.sex} onChange={(event) => updateStudent('sex', event.target.value)} disabled={disabled} maxLength={40} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('Nacionalidade')} htmlFor="self-nationality">Nacionalidade</label>
            <input id="self-nationality" value={data.nationality} onChange={(event) => updateStudent('nationality', event.target.value)} disabled={disabled} maxLength={80} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('Naturalidade')} htmlFor="self-birthplace">Naturalidade</label>
            <input id="self-birthplace" value={data.birthplace} onChange={(event) => updateStudent('birthplace', event.target.value)} disabled={disabled} maxLength={120} className={inputClass} />
          </div>
          <div>
            <label className={fieldLabel('UF de nascimento')} htmlFor="self-birth-state">UF de nascimento</label>
            <input id="self-birth-state" value={data.birthState} onChange={(event) => updateStudent('birthState', event.target.value.toUpperCase())} disabled={disabled} maxLength={2} className={inputClass} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8deea] p-4">
        <h3 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">Documentos de identificação</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className={fieldLabel('RG')} htmlFor="self-rg">RG</label><input id="self-rg" value={data.rg} onChange={(event) => updateStudent('rg', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Órgão expedidor')} htmlFor="self-rg-authority">Órgão expedidor</label><input id="self-rg-authority" value={data.rgIssuingAuthority} onChange={(event) => updateStudent('rgIssuingAuthority', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('UF do RG')} htmlFor="self-rg-state">UF do RG</label><input id="self-rg-state" value={data.rgState} onChange={(event) => updateStudent('rgState', event.target.value.toUpperCase())} disabled={disabled} maxLength={2} className={inputClass} /></div>
          <div><label className={fieldLabel('Certidão de nascimento')} htmlFor="self-birth-certificate">Certidão de nascimento</label><input id="self-birth-certificate" value={data.birthCertificate} onChange={(event) => updateStudent('birthCertificate', event.target.value)} disabled={disabled} className={inputClass} /></div>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8deea] p-4">
        <h3 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">Endereço</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className={fieldLabel('CEP')} htmlFor="self-postal-code">CEP</label><input id="self-postal-code" value={data.address.postalCode} onChange={(event) => updateAddress('postalCode', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Logradouro')} htmlFor="self-street">Logradouro</label><input id="self-street" value={data.address.street} onChange={(event) => updateAddress('street', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Número')} htmlFor="self-address-number">Número</label><input id="self-address-number" value={data.address.number} onChange={(event) => updateAddress('number', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Complemento')} htmlFor="self-complement">Complemento</label><input id="self-complement" value={data.address.complement} onChange={(event) => updateAddress('complement', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Bairro')} htmlFor="self-neighborhood">Bairro</label><input id="self-neighborhood" value={data.address.neighborhood} onChange={(event) => updateAddress('neighborhood', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Cidade')} htmlFor="self-city">Cidade</label><input id="self-city" value={data.address.city} onChange={(event) => updateAddress('city', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('UF')} htmlFor="self-state">UF</label><input id="self-state" value={data.address.state} onChange={(event) => updateAddress('state', event.target.value.toUpperCase())} disabled={disabled} maxLength={2} className={inputClass} /></div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-[#414754] dark:text-[#cbd5e1]"><input type="checkbox" checked={data.address.ruralZone} onChange={(event) => updateAddress('ruralZone', event.target.checked)} disabled={disabled} /> Zona rural</label>
      </section>

      <section className="rounded-lg border border-[#d8deea] p-4">
        <h3 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">Informações escolares anteriores</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className={fieldLabel('Escola de origem')} htmlFor="self-origin-school">Escola de origem</label><input id="self-origin-school" value={data.previousSchooling.originSchool} onChange={(event) => updatePrevious('originSchool', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Rede de ensino')} htmlFor="self-origin-network">Rede de ensino</label><input id="self-origin-network" value={data.previousSchooling.originNetwork} onChange={(event) => updatePrevious('originNetwork', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Último ano/série')} htmlFor="self-last-grade">Último ano/série</label><input id="self-last-grade" value={data.previousSchooling.lastGrade} onChange={(event) => updatePrevious('lastGrade', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('Ano de origem')} htmlFor="self-origin-year">Ano de origem</label><input id="self-origin-year" inputMode="numeric" value={data.previousSchooling.originYear} onChange={(event) => updatePrevious('originYear', event.target.value.replace(/\D/g, '').slice(0, 4))} disabled={disabled} maxLength={4} className={inputClass} /></div>
          <div><label className={fieldLabel('Cidade de origem')} htmlFor="self-origin-city">Cidade de origem</label><input id="self-origin-city" value={data.previousSchooling.city} onChange={(event) => updatePrevious('city', event.target.value)} disabled={disabled} className={inputClass} /></div>
          <div><label className={fieldLabel('UF de origem')} htmlFor="self-origin-state">UF de origem</label><input id="self-origin-state" value={data.previousSchooling.state} onChange={(event) => updatePrevious('state', event.target.value.toUpperCase())} disabled={disabled} maxLength={2} className={inputClass} /></div>
        </div>
        <label className={fieldLabel('Observações')} htmlFor="self-school-observations">Observações</label>
        <textarea id="self-school-observations" value={data.previousSchooling.observations} onChange={(event) => updatePrevious('observations', event.target.value)} disabled={disabled} className={textareaClass} />
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#414754] dark:text-[#cbd5e1]"><label className="flex items-center gap-2"><input type="checkbox" checked={data.previousSchooling.historyDelivered} onChange={(event) => updatePrevious('historyDelivered', event.target.checked)} disabled={disabled} /> Histórico entregue</label><label className="flex items-center gap-2"><input type="checkbox" checked={data.previousSchooling.transferDeclaration} onChange={(event) => updatePrevious('transferDeclaration', event.target.checked)} disabled={disabled} /> Declaração de transferência entregue</label></div>
      </section>

      <section className="rounded-lg border border-[#d8deea] p-4">
        <h3 className="text-sm font-bold text-[#181c20] dark:text-[#f8fafc]">Saúde</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className={fieldLabel('Alergias')} htmlFor="self-allergies">Alergias</label><textarea id="self-allergies" value={data.health.allergies} onChange={(event) => updateHealth('allergies', event.target.value)} disabled={disabled} className={textareaClass} /></div>
          <div><label className={fieldLabel('Condições de saúde')} htmlFor="self-health-conditions">Condições de saúde</label><textarea id="self-health-conditions" value={data.health.healthConditions} onChange={(event) => updateHealth('healthConditions', event.target.value)} disabled={disabled} className={textareaClass} /></div>
          <div><label className={fieldLabel('Medicação de emergência')} htmlFor="self-emergency-medication">Medicação de emergência</label><textarea id="self-emergency-medication" value={data.health.emergencyMedication} onChange={(event) => updateHealth('emergencyMedication', event.target.value)} disabled={disabled} className={textareaClass} /></div>
          <div><label className={fieldLabel('Deficiência ou necessidade')} htmlFor="self-disability">Deficiência ou necessidade</label><textarea id="self-disability" value={data.health.disability} onChange={(event) => updateHealth('disability', event.target.value)} disabled={disabled} className={textareaClass} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#414754] dark:text-[#cbd5e1]"><label className="flex items-center gap-2"><input type="checkbox" checked={data.health.autism} onChange={(event) => updateHealth('autism', event.target.checked)} disabled={disabled} /> TEA</label><label className="flex items-center gap-2"><input type="checkbox" checked={data.health.giftedness} onChange={(event) => updateHealth('giftedness', event.target.checked)} disabled={disabled} /> Altas habilidades</label><label className="flex items-center gap-2"><input type="checkbox" checked={data.health.needsSpecialEducation} onChange={(event) => updateHealth('needsSpecialEducation', event.target.checked)} disabled={disabled} /> Atendimento educacional especializado</label></div>
      </section>
    </div>
  );
}

export default function AccountSettingsModal({
  currentName,
  email,
  returnFocusRef,
  onClose,
  onUpdateName,
  onUpdateSelfRegistration,
  onUpdatePassword,
  onSuccess,
  currentRole,
}: AccountSettingsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const [fullName, setFullName] = useState(currentName);
  const [phone, setPhone] = useState('');
  const [selfRegistration, setSelfRegistration] =
    useState<SelfRegistrationData | null>(null);
  const [isLoadingRegistration, setIsLoadingRegistration] =
    useState(currentRole === 'student' || currentRole === 'parent');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initialSelfRegistrationRef = useRef<string | null>(null);

  const isSelfRegistration =
    currentRole === 'student' || currentRole === 'parent';

  useEffect(() => {
    if (!isSelfRegistration) {
      return;
    }

    let cancelled = false;
    setIsLoadingRegistration(true);
    setError(null);

    void selfRegistrationService.getCurrent()
      .then((data) => {
        if (cancelled) return;

        const expectedRole = currentRole === 'student'
          ? 'STUDENT'
          : 'GUARDIAN';
        if (data.role !== expectedRole) {
          throw new Error('O perfil atual não corresponde ao cadastro.');
        }

        setSelfRegistration(data);
        setFullName(data.profile.fullName);
        setPhone(data.profile.phone);
        initialSelfRegistrationRef.current = JSON.stringify({
          profile: data.profile,
          student: data.role === 'STUDENT' ? data.student : null,
        });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar seu cadastro.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRegistration(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, isSelfRegistration]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const authenticatedContainer = document.getElementById(
      'app-authenticated-container',
    ) as (HTMLElement & { inert: boolean }) | null;
    const previousInert = authenticatedContainer?.inert ?? false;

    document.body.style.overflow = 'hidden';
    if (authenticatedContainer) {
      authenticatedContainer.inert = true;
    }
    nameInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (authenticatedContainer) {
        authenticatedContainer.inert = previousInert;
      }
      returnFocusRef.current?.focus();
    };
  }, [returnFocusRef]);

  function closeModal(): void {
    if (!submittingRef.current) {
      onClose();
    }
  }

  function handleDialogKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        focusableSelector,
      ),
    ) as HTMLElement[];

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement =
      focusableElements[focusableElements.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === firstElement
    ) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === lastElement
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    setError(null);

    if (isSelfRegistration && (isLoadingRegistration || !selfRegistration)) {
      setError('Aguarde o carregamento do seu cadastro para salvar.');
      return;
    }

    const result = accountSettingsSchema.safeParse({
      fullName,
      newPassword,
      passwordConfirmation,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Revise os dados informados.');
      return;
    }

    const normalizedName = result.data.fullName;
    const shouldUpdateName = normalizedName !== currentName.trim();
    const shouldUpdatePassword = result.data.newPassword.length > 0;
    const currentSelfRegistrationSnapshot = selfRegistration
      ? JSON.stringify({
          profile: {
            fullName: normalizedName,
            email: selfRegistration.profile.email,
            phone: phone.trim(),
          },
          student: selfRegistration.role === 'STUDENT'
            ? selfRegistration.student
            : null,
        })
      : null;
    const shouldUpdateSelfRegistration =
      isSelfRegistration &&
      Boolean(selfRegistration) &&
      currentSelfRegistrationSnapshot !== initialSelfRegistrationRef.current;

    if (!shouldUpdateName && !shouldUpdatePassword && !shouldUpdateSelfRegistration) {
      setError('Altere o nome ou informe uma nova senha.');
      return;
    }

    submittingRef.current = true;
    setIsSaving(true);
    let nameUpdated = false;

    try {
      if (shouldUpdateSelfRegistration && selfRegistration) {
        const input: SelfRegistrationUpdate = selfRegistration.role === 'STUDENT'
          ? {
              role: 'STUDENT',
              profile: { fullName: normalizedName, phone: phone.trim() },
              student: selfRegistration.student,
            }
          : {
              role: 'GUARDIAN',
              profile: { fullName: normalizedName, phone: phone.trim() },
            };

        await onUpdateSelfRegistration(input);
        nameUpdated = normalizedName !== currentName.trim();
      } else if (shouldUpdateName) {
        await onUpdateName(normalizedName);
        nameUpdated = true;
      }

      if (shouldUpdatePassword) {
        try {
          await onUpdatePassword(result.data.newPassword);
        } catch (passwordError) {
          setError(
            nameUpdated
              ? 'Seu nome foi atualizado, mas não foi possível alterar sua senha.'
              : getOperationErrorMessage(passwordError, 'password'),
          );
          return;
        }
      }

      setNewPassword('');
      setPasswordConfirmation('');
      const profileUpdated = isSelfRegistration
        ? shouldUpdateSelfRegistration
        : shouldUpdateName;
      onSuccess(
        profileUpdated && shouldUpdatePassword
          ? isSelfRegistration
            ? 'Cadastro e senha atualizados com sucesso.'
            : 'Dados da conta atualizados com sucesso.'
          : shouldUpdatePassword
            ? 'Senha alterada com sucesso.'
            : profileUpdated
            ? isSelfRegistration
              ? 'Cadastro atualizado com sucesso.'
                : 'Nome atualizado com sucesso.'
              : 'Nome atualizado com sucesso.',
      );
      onClose();
    } catch (updateError) {
      setError(
        getOperationErrorMessage(
          updateError,
          shouldUpdateSelfRegistration ? 'registration' : 'name',
        ),
      );
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6 dark:bg-black/60"
      role="presentation"
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-transparent bg-white p-5 shadow-xl dark:border-[#334155] dark:bg-[#182235] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id={titleId}
              className="text-xl font-bold text-[#181c20] dark:text-[#f8fafc]"
            >
              {isSelfRegistration ? 'Meu cadastro' : 'Minha conta'}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-[#667085] dark:text-[#cbd5e1]"
            >
              {isSelfRegistration
                ? 'Mantenha seus dados pessoais atualizados. Dados acadêmicos e vínculos são administrados pela escola.'
                : 'Atualize seu nome ou defina uma nova senha.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSaving}
            aria-label="Fechar Minha conta"
            title="Fechar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d8deea] text-[#414754] outline-none transition hover:bg-[#f3f6fb] focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-wait disabled:opacity-60 dark:border-[#475569] dark:text-[#cbd5e1] dark:hover:bg-[#243247] dark:hover:text-[#f8fafc]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div>
            <label
              htmlFor={`${titleId}-name`}
              className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
            >
              Nome
            </label>
            <input
              ref={nameInputRef}
              id={`${titleId}-name`}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isSaving}
              autoComplete="name"
              maxLength={120}
              required
              className="mt-1 h-11 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 disabled:cursor-wait disabled:bg-[#f3f6fb] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]"
            />
          </div>

          {isSelfRegistration && (
            <>
              <div>
                <label
                  htmlFor={`${titleId}-phone`}
                  className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
                >
                  Telefone
                </label>
                <input
                  id={`${titleId}-phone`}
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={isSaving || isLoadingRegistration}
                  autoComplete="tel"
                  maxLength={40}
                  className={inputClass}
                />
              </div>

              {isLoadingRegistration ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#c1c6d6] bg-[#f8faff] p-4 text-sm text-[#667085]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#005bbf]" aria-hidden="true" />
                  Carregando dados do cadastro...
                </div>
              ) : selfRegistration?.role === 'STUDENT' ? (
                <StudentRegistrationFields
                  data={selfRegistration.student}
                  disabled={isSaving}
                  onChange={(student) =>
                    setSelfRegistration({ ...selfRegistration, student })
                  }
                />
              ) : null}
            </>
          )}

          <div>
            <label
              htmlFor={`${titleId}-email`}
              className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
            >
              E-mail
            </label>
            <input
              id={`${titleId}-email`}
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className="mt-1 h-11 w-full cursor-not-allowed rounded-lg border border-[#d8deea] bg-[#f3f6fb] px-3 text-sm text-[#667085] outline-none dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]"
            />
          </div>

          <div>
            <label
              htmlFor={`${titleId}-password`}
              className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
            >
              Nova senha
            </label>
            <div className="relative mt-1">
              <input
                id={`${titleId}-password`}
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 pr-12 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 disabled:cursor-wait disabled:bg-[#f3f6fb] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={isSaving}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#667085] outline-none transition hover:bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-wait disabled:opacity-60 dark:text-[#94a3b8] dark:hover:bg-[#243247] dark:hover:text-[#e2e8f0]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor={`${titleId}-password-confirmation`}
              className="block text-xs font-bold text-[#414754] dark:text-[#cbd5e1]"
            >
              Confirmar nova senha
            </label>
            <input
              id={`${titleId}-password-confirmation`}
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              disabled={isSaving}
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-lg border border-[#c5cbd6] bg-white px-3 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 disabled:cursor-wait disabled:bg-[#f3f6fb] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#ffdad6] bg-[#fff1ef] px-3 py-2 text-sm text-[#93000a] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#c5cbd6] bg-white px-4 text-sm font-bold text-[#414754] outline-none transition hover:bg-[#f3f6fb] focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-wait disabled:opacity-60 dark:border-[#475569] dark:bg-[#182235] dark:text-[#e2e8f0] dark:hover:bg-[#243247]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoadingRegistration}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 text-sm font-bold text-white outline-none transition hover:bg-[#004a9f] focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:focus-visible:ring-offset-[#182235]"
            >
              {isSaving && (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {isSaving
                ? 'Salvando...'
                : isSelfRegistration
                  ? 'Salvar cadastro'
                  : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
