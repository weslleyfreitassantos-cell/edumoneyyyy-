import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from '../components/auth/AuthLayout';
import { useResolvedBranding } from '../hooks/useBranding';
import { FALLBACK_BRANDING } from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';

function getLoginErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('credenciais invalidas')
  ) {
    return 'E-mail ou senha incorretos.';
  }

  if (
    message.includes('nao tem acesso') ||
    message.includes('no access') ||
    message.includes('accountaccessblocked')
  ) {
    return 'Voce nao tem acesso a esta plataforma. Procure a administracao da sua instituicao.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
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
    return 'Servico temporariamente indisponivel. Tente novamente em instantes.';
  }

  return 'Nao foi possivel entrar. Tente novamente.';
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const brandingQuery = useResolvedBranding();
  const branding =
    brandingQuery.data ?? FALLBACK_BRANDING;

  useEffect(() => {
    if (profile) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  useEffect(
    () => applyDocumentBranding(branding),
    [
      branding.displayName,
      branding.faviconUrl,
      branding.primaryColor,
      branding.secondaryColor,
    ],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <div className="space-y-1">
      <p className="font-medium text-slate-700 dark:text-slate-300">
        Educação que transforma. Tecnologia que aproxima.
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        © 2026 {branding.displayName ?? 'EduManager Pro'}. Todos os direitos reservados.
      </p>
    </div>
  );

  return (
    <AuthShell
      heroVariant="default"
      layoutVariant="login"
      showBrand={false}
      footer={footerContent}
    >
      <div
        style={
          {
            '--brand-primary': branding.primaryColor,
            '--brand-secondary': branding.secondaryColor,
          } as CSSProperties
        }
      >
        <div className="login-brand-block mb-3 flex flex-col items-center">
          <div className="flex items-center justify-center min-h-[36px]">
            {brandingQuery.isLoading ? (
              <Loader2
                className="h-6 w-6 animate-spin text-slate-400"
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
                className="h-14 w-36 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/50"
                aria-hidden="true"
              />
            )}
          </div>

          {branding.displayName && (
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 text-center">
              {branding.displayName}
            </p>
          )}

          <div
            className="mt-1 mx-auto h-[4px] w-12 rounded-full"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
            aria-hidden="true"
          />

          <div className="mt-2 text-center">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Seja bem-vindo!
            </h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Entre com suas credenciais para acessar a plataforma.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              E-mail institucional
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@instituicao.edu.br"
                className="h-[48px] w-full rounded-xl border border-slate-300 bg-white px-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-[#111c2e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-white/20 caret-blue-500 selection:bg-blue-500/30 dark:selection:bg-blue-400/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              Senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className="h-[48px] w-full rounded-xl border border-slate-300 bg-white px-11 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-[#111c2e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-white/20 caret-blue-500 selection:bg-blue-500/30 dark:selection:bg-blue-400/30"
              />
              <button
                type="button"
                aria-label={
                  showPassword
                    ? 'Ocultar senha'
                    : 'Mostrar senha'
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

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-blue-600 underline-offset-4 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Esqueci minha senha
            </Link>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-live="polite"
            className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
          >
            {loading ? (
              <Loader2
                className="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight
                className="h-5 w-5"
                aria-hidden="true"
              />
            )}
            {loading ? 'Entrando...' : 'Entrar no sistema'}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span>Ambiente seguro. Acesso restrito.</span>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
