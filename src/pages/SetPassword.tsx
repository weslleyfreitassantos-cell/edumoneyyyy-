import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import { supabase } from '../lib/supabaseClient';

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível definir a senha.';
}

export default function SetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] =
    useState('');

  const [
    passwordConfirmation,
    setPasswordConfirmation,
  ] = useState('');

  const [isChecking, setIsChecking] =
    useState(true);

  const [hasSession, setHasSession] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession(): Promise<void> {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
      }

      setHasSession(Boolean(session));
      setIsChecking(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }

        setHasSession(Boolean(session));
        setIsChecking(false);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage(
        'A senha deve possuir pelo menos 8 caracteres.',
      );
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage(
        'As senhas informadas não são iguais.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw error;
      }

      navigate('/dashboard', {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <div className="rounded-xl border bg-white p-8 text-sm text-gray-500 shadow-sm">
          Validando convite...
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Convite inválido ou expirado
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Solicite à administração da instituição um novo convite.
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Defina sua senha
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Crie a senha que será utilizada para acessar o EduManager Pro.
        </p>

        <form
          onSubmit={(event) =>
            void handleSubmit(event)
          }
          className="mt-6 space-y-4"
        >
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700"
            >
              Nova senha
            </label>

            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="password-confirmation"
              className="block text-sm font-medium text-gray-700"
            >
              Confirme a senha
            </label>

            <input
              id="password-confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              minLength={8}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Definindo senha...'
              : 'Definir senha e acessar'}
          </button>
        </form>
      </section>
    </main>
  );
}