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

interface AccountSettingsModalProps {
  currentName: string;
  email: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onUpdateName: (fullName: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onSuccess: (message: string) => void;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getOperationErrorMessage(
  error: unknown,
  operation: 'name' | 'password',
): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'SESSION_EXPIRED'
  ) {
    return 'Sua sessão expirou. Entre novamente.';
  }

  return operation === 'name'
    ? 'Não foi possível atualizar seu nome.'
    : 'Não foi possível alterar sua senha.';
}

export default function AccountSettingsModal({
  currentName,
  email,
  returnFocusRef,
  onClose,
  onUpdateName,
  onUpdatePassword,
  onSuccess,
}: AccountSettingsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const [fullName, setFullName] = useState(currentName);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

    if (!shouldUpdateName && !shouldUpdatePassword) {
      setError('Altere o nome ou informe uma nova senha.');
      return;
    }

    submittingRef.current = true;
    setIsSaving(true);
    let nameUpdated = false;

    try {
      if (shouldUpdateName) {
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
      onSuccess(
        shouldUpdateName && shouldUpdatePassword
          ? 'Dados da conta atualizados com sucesso.'
          : shouldUpdatePassword
            ? 'Senha alterada com sucesso.'
            : 'Nome atualizado com sucesso.',
      );
      onClose();
    } catch (nameError) {
      setError(getOperationErrorMessage(nameError, 'name'));
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
        className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-transparent bg-white p-5 shadow-xl dark:border-[#334155] dark:bg-[#182235]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id={titleId}
              className="text-xl font-bold text-[#181c20] dark:text-[#f8fafc]"
            >
              Minha conta
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-[#667085] dark:text-[#cbd5e1]"
            >
              Atualize seu nome ou defina uma nova senha.
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
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 text-sm font-bold text-white outline-none transition hover:bg-[#004a9f] focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:focus-visible:ring-offset-[#182235]"
            >
              {isSaving && (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
