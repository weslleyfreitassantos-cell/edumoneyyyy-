import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
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
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthLayout';
import { useResolvedBranding } from '../hooks/useBranding';
import { supabase } from '../lib/supabaseClient';
import {
  clearInviteContext,
  getInviteContext,
  type InviteContext,
} from './AuthConfirm';
import { validatePasswordConfirmation } from '../schemas/authSchemas';
import { FALLBACK_BRANDING } from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';

function getErrorMessage(error: unknown): string {
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

  if (
    message.includes('identidade') ||
    message.includes('session') ||
    message.includes('sessao')
  ) {
    return 'Sessao de convite expirada. Solicite um novo convite.';
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

  return 'Nao foi possivel definir a senha. Tente novamente.';
}

export default function SetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [
    showPasswordConfirmation,
    setShowPasswordConfirmation,
  ] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [inviteContext, setInviteContext] =
    useState<InviteContext | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const brandingQuery = useResolvedBranding();
  const branding = brandingQuery.data ?? FALLBACK_BRANDING;
  const displayName =
    brandingQuery.data?.displayName ?? branding.displayName ?? 'EduManager Pro';

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
    let isMounted = true;

    async function validateSession() {
      const context = getInviteContext();

      if (!context) {
        if (isMounted) {
          setIsChecking(false);
          setInviteContext(null);
        }
        return;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (
        error ||
        !user ||
        user.id !== context.userId ||
        user.email !== context.email
      ) {
        clearInviteContext();
        await supabase.auth.signOut({ scope: 'local' });
        setInviteContext(null);
        setIsChecking(false);
        return;
      }

      setInviteContext(context);
      setIsChecking(false);
    }

    void validateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!inviteContext) return;

    const passwordError = validatePasswordConfirmation(
      password,
      passwordConfirmation,
    );

    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Re-validate just before update
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !user ||
        user.id !== inviteContext.userId ||
        user.email !== inviteContext.email
      ) {
        throw new Error(
          'Identidade inválida para alteração de senha.',
        );
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      clearInviteContext();
      await supabase.auth.signOut({ scope: 'local' });

      setSuccessMessage(
        'Senha definida com sucesso. Faça o login com sua nova senha.',
      );

      // Delay navigation slightly so user sees the message
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <AuthShell heroVariant="default" layoutVariant="login" showBrand={false} footer={footer}>
        <div style={brandStyle}>
          <div className="login-brand-block mb-3 flex flex-col items-center">
            <div className="flex min-h-[36px] items-center justify-center">
              <Loader2
                className="h-6 w-6 animate-spin text-slate-400"
                aria-label="Validando convite"
              />
            </div>
            <div className="mt-2 text-center">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Validando identidade do convite...
              </h1>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Aguarde enquanto confirmamos a sessão temporária do convite.
              </p>
            </div>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (!inviteContext && !successMessage) {
    return (
      <AuthShell heroVariant="default" layoutVariant="login" showBrand={false} footer={footer}>
        <div style={brandStyle}>
          {brandHeader}

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Convite inválido, expirado ou pertencente a outro usuário
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Não é possível definir a senha usando esta sessão. Se necessário, solicite à administração um novo convite.
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

  if (successMessage) {
    return (
      <AuthShell heroVariant="default" layoutVariant="login" showBrand={false} footer={footer}>
        <div style={brandStyle}>
          {brandHeader}

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Sucesso
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {successMessage}
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

  return (
    <AuthShell heroVariant="default" layoutVariant="login" showBrand={false} footer={footer}>
      <div style={brandStyle}>
        {brandHeader}

        <div className="mt-2 mb-3 text-center">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Defina sua senha
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Crie a senha que sera utilizada para acessar sua instituicao.
          </p>
        </div>

        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/70 p-2.5 text-center text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
          Definindo senha para:{' '}
          <strong className="font-semibold">{inviteContext?.email}</strong>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-3"
        >
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="new-password"
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
                id="new-password"
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
                  showPassword ? 'Ocultar senha' : 'Mostrar senha'
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
              htmlFor="password-confirmation"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              Confirme a senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="password-confirmation"
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
            {isSubmitting ? 'Definindo senha...' : 'Definir senha e acessar'}
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
