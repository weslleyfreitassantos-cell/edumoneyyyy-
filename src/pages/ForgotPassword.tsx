import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { authEmailSchema } from '../schemas/authSchemas';

const genericSuccessMessage =
  'Se o e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua senha.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
}

function getRecoveryRedirectUrl(): string {
  return `${window.location.origin}/auth/reset-password`;
}

function getRequestErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes('rate') ||
    message.includes('limit') ||
    message.includes('too many')
  ) {
    return 'Muitas solicitacoes foram feitas. Aguarde alguns minutos e tente novamente.';
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('unavailable')
  ) {
    return 'O servico esta temporariamente indisponivel. Tente novamente em instantes.';
  }

  return 'Nao foi possivel solicitar a recuperacao agora. Tente novamente em instantes.';
}

function isAccountDisclosureError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('not found') ||
    message.includes('not registered') ||
    message.includes('not exist') ||
    message.includes('nao cadastrado') ||
    message.includes('nao encontrado')
  );
}

export default function ForgotPassword() {
  const submittingRef = useRef(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    setFieldError(null);
    setFeedback(null);

    const parsedEmail = authEmailSchema.safeParse(email);

    if (!parsedEmail.success) {
      setFieldError(
        parsedEmail.error.issues[0]?.message ??
          'Informe um e-mail valido.',
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          parsedEmail.data,
          {
            redirectTo: getRecoveryRedirectUrl(),
          },
        );

      if (error) {
        throw error;
      }

      setFeedback({
        type: 'success',
        message: genericSuccessMessage,
      });
    } catch (error) {
      const accountDisclosureError = isAccountDisclosureError(error);

      setFeedback({
        type: accountDisclosureError ? 'success' : 'error',
        message: accountDisclosureError
          ? genericSuccessMessage
          : getRequestErrorMessage(error),
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            Recuperar senha
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Informe seu e-mail para receber as instrucoes de redefinicao.
          </p>
        </div>

        {feedback && (
          <div
            role="alert"
            className={`mt-6 rounded-lg border px-3 py-2 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="password-recovery-email"
              className="block text-sm font-medium text-gray-700"
            >
              E-mail
            </label>
            <input
              id="password-recovery-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(null);
              }}
              autoComplete="email"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={
                fieldError
                  ? 'password-recovery-email-error'
                  : undefined
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm outline-none focus:border-blue-500 focus:ring-blue-500"
            />
            {fieldError && (
              <p
                id="password-recovery-email-error"
                className="mt-1 text-sm text-red-700"
              >
                {fieldError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Enviando...'
              : 'Enviar link de recuperacao'}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 block text-center text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
