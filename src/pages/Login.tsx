import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
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

  return (
    <AuthShell
      heroVariant="video"
      layoutVariant="login"
      showBrand={false}
    >
      <div
        style={
          {
            '--brand-primary': branding.primaryColor,
            '--brand-secondary': branding.secondaryColor,
          } as CSSProperties
        }
      >
      <div className="mb-8 flex h-[118px] items-center justify-center rounded-2xl border border-[#dce9ff] bg-gradient-to-br from-white to-[#f5f8ff] px-5">
        {brandingQuery.isLoading ? (
          <Loader2
            className="h-6 w-6 animate-spin text-[#657087]"
            aria-label="Carregando identidade visual"
          />
        ) : branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`Logo de ${branding.displayName ?? 'identidade visual'}`}
            className="max-h-[100px] max-w-[240px] object-contain"
          />
        ) : (
          <div
            className="h-16 w-40 rounded-2xl border border-dashed border-[#b9cff8] bg-[#f8fbff]"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mb-6">
        <h1 className="sr-only">Acessar sua conta</h1>
        <div
          className="mx-auto h-1.5 w-16 rounded-full"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold uppercase tracking-wide text-[#657087]"
          >
            E-mail institucional
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#657087]"
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
              className="min-h-14 w-full rounded-xl border border-[#284a82]/[0.16] bg-white/95 px-11 text-sm text-[#172033] shadow-[0_5px_16px_rgba(27,62,119,0.06)] outline-none transition placeholder:text-[#8a94a8] focus:border-[#075be8] focus:ring-4 focus:ring-[#075be8]/[0.13]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold uppercase tracking-wide text-[#657087]"
          >
            Senha
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#657087]"
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
              className="min-h-14 w-full rounded-xl border border-[#284a82]/[0.16] bg-white/95 px-11 pr-12 text-sm text-[#172033] shadow-[0_5px_16px_rgba(27,62,119,0.06)] outline-none transition placeholder:text-[#8a94a8] focus:border-[#075be8] focus:ring-4 focus:ring-[#075be8]/[0.13]"
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
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#657087] transition hover:bg-[#eef5ff] hover:text-[#075be8] focus:outline-none focus:ring-2 focus:ring-[#075be8]/30"
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
            className="text-xs font-semibold text-[#075be8] underline-offset-4 transition hover:text-[#082b67] hover:underline focus:outline-none focus:ring-2 focus:ring-[#075be8]/30"
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
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(7,91,232,0.24)] transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[#075be8]/25 disabled:cursor-not-allowed disabled:opacity-70"
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
      </div>
    </AuthShell>
  );
}
