import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
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
import {
  FALLBACK_BRANDING,
} from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';

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

  const displayName =
    brandingQuery.data?.displayName ?? branding.displayName ?? 'EduManager Pro';

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
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha no login',
      );
    } finally {
      setLoading(false);
    }
  };

  const brandStyle: CSSProperties = {
    '--brand-primary': branding.primaryColor,
    '--brand-secondary': branding.secondaryColor,
  };

  const footer = (
    <>
      <p>Educação que transforma. Tecnologia que aproxima.</p>
      <p>© 2026 {displayName}. Todos os direitos reservados.</p>
    </>
  );

  return (
    <AuthShell
      heroVariant="video"
      layoutVariant="login"
      showBrand={false}
      footer={footer}
    >
      <div style={brandStyle}>
        <div className="login-brand-block flex flex-col items-center">
          <div className="flex items-center justify-center">
            {brandingQuery.isLoading ? (
              <Loader2
                className="h-6 w-6 animate-spin text-[#7c8ba8]"
                aria-label="Carregando identidade visual"
              />
            ) : branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={`Logo de ${branding.displayName ?? 'identidade visual'}`}
                className="max-h-[100px] max-w-[112px] object-contain sm:max-h-[112px]"
              />
            ) : (
              <div
                className="h-20 w-20 rounded-2xl border border-dashed border-[#3a5294]/50 bg-[#0f1a3a]/60"
                aria-hidden="true"
              />
            )}
          </div>
          <p className="mt-3 text-center text-[26px] font-bold leading-[1.2] text-white dark:text-white">
            {displayName}
          </p>
          <div
            className="mt-4 h-[5px] w-16 rounded-full"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
            aria-hidden="true"
          />
        </div>

        <h1 className="sr-only">Acessar sua conta</h1>
        <p className="mt-7 text-center text-[25px] font-bold leading-[1.2] text-white dark:text-white">
          Bem-vindo de volta!
        </p>
        <p className="mt-2 text-center text-[15px] leading-[1.6] text-[#9fb0cc] dark:text-[#aeb8c8]">
          Acesse sua conta institucional para continuar gerenciando a escola.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-[22px]"
        >
          <div className="space-y-2">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold uppercase tracking-wide text-[#9fb0cc] dark:text-[#aeb8c8]"
            >
              E-mail institucional
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9fb0cc] dark:text-[#aeb8c8]"
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
                className="h-[60px] w-full rounded-xl border border-[#2a3a66]/40 bg-[#0c1530]/80 px-12 text-sm text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)] outline-none transition placeholder:text-[#6b7a99] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold uppercase tracking-wide text-[#9fb0cc] dark:text-[#aeb8c8]"
            >
              Senha
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9fb0cc] dark:text-[#aeb8c8]"
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
                className="h-[60px] w-full rounded-xl border border-[#2a3a66]/40 bg-[#0c1530]/80 px-12 pr-12 text-sm text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)] outline-none transition placeholder:text-[#6b7a99] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/20"
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
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#9fb0cc] dark:text-[#aeb8c8] transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
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

          <div className="flex justify-end pt-[14px]">
            <Link
              to="/forgot-password"
              style={{ color: 'var(--brand-primary)' }}
              className="text-xs font-semibold underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            >
              Esqueci minha senha
            </Link>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#ffdad6] bg-[#fff1ef] px-3 py-2 text-sm text-[#93000a]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-live="polite"
            className="mt-[24px] inline-flex h-[64px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[17px] font-bold text-white shadow-[0_14px_26px_rgba(0,0,0,0.25)] transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/25 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
          >
            {loading ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
            {loading ? 'Entrando...' : 'Entrar no sistema'}
          </button>
        </form>

        <div className="mt-9 flex items-center justify-center gap-2 text-center text-[13px] leading-[1.5] text-[#9fb0cc] dark:text-[#aeb8c8]">
          <Shield className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Seus dados estão protegidos com segurança de nível institucional.</span>
        </div>
      </div>
    </AuthShell>
  );
}