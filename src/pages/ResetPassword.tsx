import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { validatePasswordConfirmation } from '../schemas/authSchemas';

const recoveryContextKey = 'password_recovery_context';
const recoveryContextTtlMs = 10 * 60 * 1000;

interface RecoveryContext {
  userId: string;
  email: string;
  verifiedAt: number;
  purpose: 'recovery';
}

type RecoveryConfirmation =
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: 'otp';
      tokenHash: string;
    };

function clearRecoveryTokensFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

async function signOutLocal(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Password recovery should not expose or fail on local sign-out errors.
  }
}

function clearRecoveryContext(): void {
  sessionStorage.removeItem(recoveryContextKey);
}

function saveRecoveryContext(context: RecoveryContext): void {
  sessionStorage.setItem(
    recoveryContextKey,
    JSON.stringify(context),
  );
}

function getRecoveryContext(): RecoveryContext | null {
  const data = sessionStorage.getItem(recoveryContextKey);

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as RecoveryContext;

    if (parsed.purpose !== 'recovery') {
      clearRecoveryContext();
      return null;
    }

    if (Date.now() - parsed.verifiedAt > recoveryContextTtlMs) {
      clearRecoveryContext();
      return null;
    }

    return parsed;
  } catch {
    clearRecoveryContext();
    return null;
  }
}

function getRecoveryConfirmationFromUrl(): RecoveryConfirmation | null {
  const hashParams = new URLSearchParams(
    window.location.hash.substring(1),
  );
  const searchParams = new URLSearchParams(window.location.search);

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const hashType = hashParams.get('type');
  const tokenHash = searchParams.get('token_hash');
  const queryType = searchParams.get('type');
  const hasHashMaterial =
    accessToken !== null ||
    refreshToken !== null ||
    hashType !== null;
  const hasQueryMaterial =
    tokenHash !== null || queryType !== null;

  if (!hasHashMaterial && !hasQueryMaterial) {
    return null;
  }

  if (hasHashMaterial && hasQueryMaterial) {
    throw new Error('Link de recuperacao invalido ou incompleto.');
  }

  if (hasQueryMaterial) {
    if (queryType !== 'recovery') {
      throw new Error('Tipo de link de recuperacao incorreto.');
    }

    if (!tokenHash) {
      throw new Error('Link de recuperacao invalido ou incompleto.');
    }

    return {
      kind: 'otp',
      tokenHash,
    };
  }

  if (hashType !== 'recovery') {
    throw new Error('Tipo de link de recuperacao incorreto.');
  }

  if (!accessToken || !refreshToken) {
    throw new Error('Link de recuperacao invalido ou incompleto.');
  }

  return {
    kind: 'session',
    accessToken,
    refreshToken,
  };
}

function getTemporaryErrorMessage(error: unknown): string {
  let message = '';

  if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    message = error.message.toLowerCase();
  }

  if (
    message.includes('weak') ||
    message.includes('password') ||
    message.includes('senha')
  ) {
    return 'A senha informada nao atende aos criterios minimos.';
  }

  if (message.includes('session') || message.includes('sessao')) {
    return 'Sessao de recuperacao expirada. Solicite um novo link.';
  }

  if (
    message.includes('rate') ||
    message.includes('limit') ||
    message.includes('too many')
  ) {
    return 'Muitas tentativas foram feitas. Aguarde alguns minutos e tente novamente.';
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('unavailable')
  ) {
    return 'O servico esta temporariamente indisponivel. Tente novamente em instantes.';
  }

  return 'Nao foi possivel concluir a operacao. Tente novamente.';
}

async function getValidatedRecoveryUser(): Promise<{
  id: string;
  email: string;
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new Error('Sessao de recuperacao ausente ou expirada.');
  }

  return {
    id: user.id,
    email: user.email,
  };
}

async function buildRecoveryContextFromCurrentUser(): Promise<RecoveryContext> {
  const user = await getValidatedRecoveryUser();

  const context: RecoveryContext = {
    userId: user.id,
    email: user.email,
    verifiedAt: Date.now(),
    purpose: 'recovery',
  };

  saveRecoveryContext(context);

  return context;
}

async function validateExistingRecoveryContext(
  context: RecoveryContext,
): Promise<RecoveryContext> {
  const user = await getValidatedRecoveryUser();

  if (user.id !== context.userId || user.email !== context.email) {
    throw new Error('Sessao de recuperacao ausente ou expirada.');
  }

  return context;
}

async function validateRecoveryFromCurrentLocation(): Promise<RecoveryContext> {
  const confirmation = getRecoveryConfirmationFromUrl();

  if (!confirmation) {
    const context = getRecoveryContext();

    if (!context) {
      throw new Error(
        'Sessao de recuperacao ausente. Solicite um novo link.',
      );
    }

    return validateExistingRecoveryContext(context);
  }

  clearRecoveryContext();
  await signOutLocal();

  if (confirmation.kind === 'session') {
    const { error } = await supabase.auth.setSession({
      access_token: confirmation.accessToken,
      refresh_token: confirmation.refreshToken,
    });

    if (error) {
      throw new Error(
        'Link de recuperacao invalido, expirado ou ja utilizado.',
      );
    }
  } else {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: confirmation.tokenHash,
      type: 'recovery',
    });

    if (error) {
      throw new Error(
        'Link de recuperacao invalido, expirado ou ja utilizado.',
      );
    }
  }

  return buildRecoveryContextFromCurrentUser();
}

export default function ResetPassword() {
  const recoveryValidationRef =
    useRef<Promise<RecoveryContext> | null>(null);
  const eventRecoveryAcceptedRef = useRef(false);
  const submittingRef = useRef(false);

  const [isChecking, setIsChecking] = useState(true);
  const [recoveryContext, setRecoveryContext] =
    useState<RecoveryContext | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    function acceptRecoveryUser(user: {
      id: string;
      email?: string | null;
    }): void {
      if (!user.email) {
        return;
      }

      const context: RecoveryContext = {
        userId: user.id,
        email: user.email,
        verifiedAt: Date.now(),
        purpose: 'recovery',
      };

      eventRecoveryAcceptedRef.current = true;
      recoveryValidationRef.current = Promise.resolve(context);
      saveRecoveryContext(context);

      if (active) {
        setRecoveryContext(context);
        setPageError(null);
        setIsChecking(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        clearRecoveryTokensFromUrl();
        acceptRecoveryUser(session.user);
      }
    });

    async function processRecovery(): Promise<void> {
      try {
        if (!recoveryValidationRef.current) {
          recoveryValidationRef.current =
            validateRecoveryFromCurrentLocation();
        }

        const context = await recoveryValidationRef.current;

        if (active) {
          setRecoveryContext(context);
          setPageError(null);
        }
      } catch (error) {
        clearRecoveryContext();
        await signOutLocal();

        if (active && !eventRecoveryAcceptedRef.current) {
          setRecoveryContext(null);
          setPageError(
            error instanceof Error
              ? error.message
              : 'Nao foi possivel validar o link de recuperacao.',
          );
        }
      } finally {
        clearRecoveryTokensFromUrl();

        if (active && !eventRecoveryAcceptedRef.current) {
          setIsChecking(false);
        }
      }
    }

    void processRecovery();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (submittingRef.current || !recoveryContext) {
      return;
    }

    setFormError(null);

    const passwordError = validatePasswordConfirmation(
      password,
      passwordConfirmation,
    );

    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const user = await getValidatedRecoveryUser();

      if (
        user.id !== recoveryContext.userId ||
        user.email !== recoveryContext.email
      ) {
        throw new Error('Sessao de recuperacao ausente ou expirada.');
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      clearRecoveryContext();
      setRecoveryContext(null);
      await signOutLocal();
      setSuccessMessage(
        'Senha atualizada com sucesso. Agora voce pode entrar usando sua nova senha.',
      );
    } catch (error) {
      setFormError(getTemporaryErrorMessage(error));
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <div className="rounded-xl border bg-white p-8 text-sm text-gray-500 shadow-sm">
          Validando link de recuperacao...
        </div>
      </main>
    );
  }

  if (successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-green-800">
            Senha atualizada com sucesso
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-green-700">
            Agora voce pode entrar usando sua nova senha.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8]"
          >
            Ir para o login
          </Link>
        </section>
      </main>
    );
  }

  if (pageError || !recoveryContext) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Link de recuperacao invalido
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {pageError ??
              'Sessao de recuperacao ausente. Solicite um novo link.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/forgot-password"
              className="inline-flex justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8]"
            >
              Solicitar novo link
            </Link>
            <Link
              to="/login"
              className="inline-flex justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Voltar ao login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Definir nova senha
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Use pelo menos 8 caracteres para atualizar sua senha.
        </p>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="mt-6 space-y-4"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="recovery-password"
              className="block text-sm font-medium text-gray-700"
            >
              Nova senha
            </label>
            <input
              id="recovery-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="recovery-password-confirmation"
              className="block text-sm font-medium text-gray-700"
            >
              Confirmar nova senha
            </label>
            <input
              id="recovery-password-confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(event.target.value)
              }
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <p className="text-xs leading-relaxed text-gray-500">
            Criterio de senha: minimo de 8 caracteres.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      </section>
    </main>
  );
}
