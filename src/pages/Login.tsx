import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Building2,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from '../components/auth/AuthLayout';
import { usePublicInstitutionBranding } from '../hooks/useInstitutionBranding';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const institutionSlug = searchParams.get('institution');
  
  const brandingQuery = usePublicInstitutionBranding(institutionSlug);

  useEffect(() => {
    if (profile) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

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
    <AuthShell heroVariant="video">
      <div className="mb-8">
        {institutionSlug && brandingQuery.isLoading ? (
          <div className="mb-6 flex h-16 w-32 items-center justify-center rounded-lg border border-[#c5c5d3] bg-[#f8f9fa]">
            <Loader2 className="h-5 w-5 animate-spin text-[#757682]" />
          </div>
        ) : brandingQuery.data ? (
          <div className="mb-6">
            {brandingQuery.data.logoUrl ? (
              <img
                src={brandingQuery.data.logoUrl}
                alt={`Logo da instituição ${brandingQuery.data.name}`}
                className="h-16 w-auto max-w-[240px] object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[#dce1ff] text-[#00236f]">
                <Building2 className="h-8 w-8" aria-hidden="true" />
              </div>
            )}
          </div>
        ) : null}

        <h1 className="text-[32px] font-bold leading-10 text-[#191c1d]">
          Bem-vindo ao EduManager Pro
        </h1>
        <p className="mt-2 text-base leading-6 text-[#444651]">
          Entre para acessar sua instituição.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]"
          >
            E-mail institucional
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]"
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
              className="h-12 w-full rounded-lg border border-[#c5c5d3] bg-white px-10 text-sm text-[#191c1d] outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]"
          >
            Senha
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]"
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
              placeholder="••••••••"
              className="h-12 w-full rounded-lg border border-[#c5c5d3] bg-white px-10 pr-12 text-sm text-[#191c1d] outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
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
              className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#757682] transition hover:bg-[#f3f4f5] hover:text-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
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
            className="text-xs font-semibold text-[#1e3a8a] underline-offset-4 transition hover:text-[#00236f] hover:underline focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          >
            Esqueci minha senha
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-[#ffdad6] bg-[#fff1ef] px-3 py-2 text-sm text-[#93000a]"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-live="polite"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-70"
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
    </AuthShell>
  );
}
