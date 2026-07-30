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
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AuthAlert,
  AuthButton,
  AuthPageHeader,
  AuthPasswordInput,
  AuthShell,
  AuthStatusPanel,
  authPlainLinkClass,
  authPrimaryActionLinkClass,
  authSecondaryActionClass,
} from '../components/auth/AuthLayout';
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
        Educacao que transforma. Tecnologia que aproxima.
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        2026 {displayName}. Todos os direitos reservados.
      </p>
    </div>
  );

  const brandHeader = (
    <div className="mb-4 flex flex-col items-center">
      <div className="flex min-h-[36px] items-center justify-center">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`Logo de ${displayName}`}
            className="max-h-[120px] max-w-[250px] object-contain sm:max-h-[140px] sm:max-w-[290px]"
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
      <AuthShell
        heroVariant="default"
        layoutVariant="login"
        showBrand={false}
        footer={footer}
      >
        <AuthStatusPanel
          icon={Loader2}
          title="Validando link de recuperacao..."
          description="Aguarde enquanto confirmamos a sessao temporaria de redefinicao."
        />
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
        <AuthStatusPanel
          icon={CheckCircle2}
          variant="success"
          title="Senha atualizada com sucesso"
          description="Agora voce pode entrar usando sua nova senha."
        >
          <Link
            to="/login"
            className={authPrimaryActionLinkClass}
          >
            Ir para o login
          </Link>
        </AuthStatusPanel>
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
        <AuthStatusPanel
          icon={ShieldAlert}
          variant="error"
          title="Link de recuperacao invalido"
          description={
            pageError ??
            'Sessao de recuperacao ausente. Solicite um novo link.'
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/forgot-password"
              className={authPrimaryActionLinkClass}
            >
              Solicitar novo link
            </Link>
            <Link
              to="/login"
              className={authSecondaryActionClass}
            >
              Voltar ao login
            </Link>
          </div>
        </AuthStatusPanel>
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

        <AuthPageHeader
          icon={KeyRound}
          title="Definir nova senha"
          description="Use pelo menos 8 caracteres para atualizar sua senha com seguranca."
        />

        <div className="mb-6 rounded-lg border border-[#dce1ff] bg-[#f4f6ff] px-4 py-3 text-sm leading-5 text-[#264191] dark:border-[#334155] dark:bg-[#111c2e] dark:text-[#dbeafe]">
          Redefinindo senha para:{' '}
          <strong>{recoveryContext.email}</strong>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-5"
        >
          {formError && (
            <AuthAlert variant="error">{formError}</AuthAlert>
          )}

          <AuthPasswordInput
            id="recovery-password"
            label="Nova senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            isVisible={showPassword}
            onToggleVisibility={() =>
              setShowPassword((current) => !current)
            }
            showLabel="Mostrar nova senha"
            hideLabel="Ocultar nova senha"
          />

          <AuthPasswordInput
            id="recovery-password-confirmation"
            label="Confirmar nova senha"
            value={passwordConfirmation}
            onChange={(event) =>
              setPasswordConfirmation(event.target.value)
            }
            autoComplete="new-password"
            minLength={8}
            required
            isVisible={showPasswordConfirmation}
            onToggleVisibility={() =>
              setShowPasswordConfirmation((current) => !current)
            }
            showLabel="Mostrar confirmacao da senha"
            hideLabel="Ocultar confirmacao da senha"
          />

          <p className="rounded-lg bg-[#f3f4f5] px-3 py-2 text-xs leading-5 text-[#444651] dark:bg-[#111827] dark:text-[#cbd5e1]">
            Criterio de senha: minimo de 8 caracteres.
          </p>

          <AuthButton
            type="submit"
            loading={isSubmitting}
            icon={Save}
          >
            {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
          </AuthButton>
        </form>

        <div className="mt-6 border-t border-[#c5c5d3] pt-6 text-center dark:border-[#334155]">
          <Link
            to="/login"
            className={authPlainLinkClass}
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />
            Voltar para o login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
