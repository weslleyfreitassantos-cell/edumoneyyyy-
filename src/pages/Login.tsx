import {
  ArrowRight,
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

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
    <main className="flex min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d]">
      <section className="flex min-h-screen w-full flex-col bg-white px-4 py-6 sm:px-8 md:w-1/2 md:px-12 lg:w-[44%] lg:px-16 xl:px-24">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a8a] text-white shadow-sm">
            <GraduationCap
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <span className="text-xl font-bold text-[#00236f]">
            EduManager Pro
          </span>
        </header>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-8">
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
          </div>
        </div>

        <footer className="text-center text-xs leading-4 text-[#444651]">
          Precisa de ajuda? Contate o suporte técnico da sua instituição.
        </footer>
      </section>

      <aside className="relative hidden min-h-screen flex-1 overflow-hidden bg-[#00236f] text-white md:flex md:items-center md:justify-center">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-48 bg-[#1e3a8a]/70"
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto max-w-xl px-10 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
            <BookOpenCheck
              className="h-10 w-10"
              aria-hidden="true"
            />
          </div>
          <h2 className="text-[32px] font-bold leading-10">
            Gestão Escolar Inteligente
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-6 text-[#dce1ff]">
            Centralize operações acadêmicas, financeiras e administrativas em uma plataforma segura e moderna.
          </p>

          <div className="mt-10 grid gap-4 text-left lg:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase text-[#b6c4ff]">
                Governança
              </p>
              <p className="mt-2 text-sm leading-5 text-white/90">
                Perfis, permissões e instituições em um ambiente confiável.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase text-[#6ffbbe]">
                Operação
              </p>
              <p className="mt-2 text-sm leading-5 text-white/90">
                Dados escolares organizados para decisões rápidas.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
