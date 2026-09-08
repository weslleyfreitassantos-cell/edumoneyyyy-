import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthLayout';
import { useResolvedBranding } from '../hooks/useBranding';
import { supabase } from '../lib/supabaseClient';
import { validatePasswordConfirmation } from '../schemas/authSchemas';
import { FALLBACK_BRANDING } from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';

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

async function markClientAdminInvitationAccepted(): Promise<void> {
  if (typeof supabase.rpc !== 'function') {
    return;
  }

  try {
    await supabase.rpc('mark_client_admin_invitation_accepted');
  } catch {
    // Invitation state is auxiliary; do not block password recovery.
  }
}

async function buildRecoveryContextFromCurrentUser(): Promise<RecoveryContext> {
  const user = await getValidatedRecoveryUser();
  await markClientAdminInvitationAccepted();

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
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [
    showPasswordConfirmation,
    setShowPasswordConfirmation,
  ] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );
  const brandingQuery = useResolvedBranding();
  const branding = brandingQuery.data ?? FALLBACK_BRANDING;
  const displayName =
    brandingQuery.data?.displayName ??
    branding.displayName ??
    'EduManager Pro';

  useEffect(
    () => applyDocumentBranding(branding),
    [
      branding.displayName,
      branding.faviconUrl,
      branding.primaryColor,
      branding.secondaryColor,
    ],
  );

  const brandStyle: CSSProperties = {
    '--brand-primary': branding.primaryColor,
    '--brand-secondary': branding.secondaryColor,
  };

  const footer = (
    <div className="space-y-1">
      <p className="font-medium text-slate-700 dark:text-slate-300">
        Educação que transforma. Tecnologia que aproxima.
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        © 2026 {displayName}. Todos os direitos reservados.
      </p>
    </div>
  );

  const brandHeader = (
    <div className="login-brand-block mb-3 flex flex-col items-center">
      <div className="flex min-h-[36px] items-center justify-center">
        {brandingQuery.isLoading ? (
          <Loader2
            className="h-5 w-5 animate-spin text-slate-400"
            aria-label="Carregando identidade visual"
          />
        ) : branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`Logo de ${branding.displayName ?? 'identidade visual'}`}
            className="max-h-[140px] max-w-[270px] object-contain sm:max-h-[160px] sm:max-w-[310px]"
          />
        ) : (
          <div
            className="h-12 w-32 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/50"
            aria-hidden="true"
          />
        )}
      </div>

      {branding.displayName && (
        <p className="mt-1 text-center text-sm font-bold text-slate-800 dark:text-slate-100">
          {branding.displayName}
        </p>
      )}

      <div
        className="mx-auto mt-1 h-[4px] w-12 rounded-full"
        style={{
          backgroundImage:
            'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
        }}
        aria-hidden="true"
      />
    </div>
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
      <AuthShell
        heroVariant="default"
        layoutVariant="login"
        showBrand={false}
        footer={footer}
      >
        <div style={brandStyle}>
          <div className="login-brand-block mb-3 flex flex-col items-center">
            <div className="flex min-h-[36px] items-center justify-center">
              <Loader2
                className="h-6 w-6 animate-spin text-slate-400"
                aria-label="Validando link de recuperação"
              />
            </div>
            <div className="mt-2 text-center">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Validando link de recuperação...
              </h1>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Aguarde enquanto confirmamos a sessão temporária de redefinição.
              </p>
            </div>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (successMessage) {
    return (
      <AuthShell
        heroVariant="default"
        layoutVariant="login"
        showBrand={false}
        footer={footer}
      >
        <div style={brandStyle}>
          {brandHeader}

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Senha atualizada com sucesso
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Agora voce pode entrar usando sua nova senha.
            </p>
          </div>

          <Link
            to="/login"
            className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-600/20"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
          >
            Ir para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (pageError || !recoveryContext) {
    return (
      <AuthShell
        heroVariant="default"
        layoutVariant="login"
        showBrand={false}
        footer={footer}
      >
        <div style={brandStyle}>
          {brandHeader}

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Link de recuperação inválido
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {pageError ??
                'Sessao de recuperacao ausente. Solicite um novo link.'}
            </p>
          </div>

          <div className="space-y-2">
            <Link
              to="/forgot-password"
              className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-600/20"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
              }}
            >
              Solicitar novo link
            </Link>
            <Link
              to="/login"
              className="inline-flex h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heroVariant="default"
      layoutVariant="login"
      showBrand={false}
      footer={footer}
    >
      <div style={brandStyle}>
        {brandHeader}

        <div className="mt-2 mb-3 text-center">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Definir nova senha
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Use pelo menos 8 caracteres para atualizar sua senha com segurança.
          </p>
        </div>

        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/70 p-2.5 text-center text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
          Redefinindo senha para:{' '}
          <strong className="font-semibold">{recoveryContext.email}</strong>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-3"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="recovery-password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              Nova senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="recovery-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className="h-[48px] w-full rounded-xl border border-slate-300 bg-white px-11 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-[#111c2e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-white/20 caret-blue-500 selection:bg-blue-500/30 dark:selection:bg-blue-400/30"
              />
              <button
                type="button"
                aria-label={
                  showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'
                }
                aria-pressed={showPassword}
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="recovery-password-confirmation"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="recovery-password-confirmation"
                name="passwordConfirmation"
                type={showPasswordConfirmation ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                placeholder="********"
                className="h-[48px] w-full rounded-xl border border-slate-300 bg-white px-11 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-[#111c2e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-white/20 caret-blue-500 selection:bg-blue-500/30 dark:selection:bg-blue-400/30"
              />
              <button
                type="button"
                aria-label={
                  showPasswordConfirmation
                    ? 'Ocultar confirmacao da senha'
                    : 'Mostrar confirmacao da senha'
                }
                aria-pressed={showPasswordConfirmation}
                onClick={() =>
                  setShowPasswordConfirmation((current) => !current)
                }
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {showPasswordConfirmation ? (
                  <EyeOff
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>

          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            Criterio de senha: minimo de 8 caracteres.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-live="polite"
            className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
          >
            {isSubmitting ? (
              <Loader2
                className="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save
                className="h-5 w-5"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
          </button>

          <div className="flex justify-center pt-1">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 underline-offset-4 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowLeft
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              Voltar para o login
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
