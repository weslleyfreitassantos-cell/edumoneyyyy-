import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getInviteContext, clearInviteContext, type InviteContext } from './AuthConfirm';
import { validatePasswordConfirmation } from '../schemas/authSchemas';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Não foi possível definir a senha.';
}

export default function SetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      const { data: { user }, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error || !user || user.id !== context.userId || user.email !== context.email) {
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
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user || user.id !== inviteContext.userId || user.email !== inviteContext.email) {
        throw new Error('Identidade inválida para alteração de senha.');
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      clearInviteContext();
      await supabase.auth.signOut({ scope: 'local' });

      setSuccessMessage('Senha definida com sucesso. Faça o login com sua nova senha.');

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
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <div className="rounded-xl border bg-white p-8 text-sm text-gray-500 shadow-sm">
          Validando identidade do convite...
        </div>
      </main>
    );
  }

  if (!inviteContext && !successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Convite inválido, expirado ou pertencente a outro usuário
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Não é possível definir a senha usando esta sessão.
            Se necessário, solicite à administração um novo convite.
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

  if (successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 p-8 shadow-sm text-center">
          <h1 className="text-xl font-bold text-green-800">Sucesso</h1>
          <p className="mt-3 text-sm leading-relaxed text-green-700">{successMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Defina sua senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Crie a senha que será utilizada para acessar o EduManager Pro.
        </p>

        <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-600 border">
          Definindo senha para: <strong>{inviteContext?.email}</strong>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">Nova senha</label>
            <input
              id="new-password"
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
            <label htmlFor="password-confirmation" className="block text-sm font-medium text-gray-700">Confirme a senha</label>
            <input
              id="password-confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
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
            {isSubmitting ? 'Definindo senha...' : 'Definir senha e acessar'}
          </button>
        </form>
      </section>
    </main>
  );
}
