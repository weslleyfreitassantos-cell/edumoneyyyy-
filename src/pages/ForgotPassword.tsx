import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AuthAlert,
  AuthButton,
  AuthPageHeader,
  AuthShell,
  AuthTextInput,
  authPlainLinkClass,
} from '../components/auth/AuthLayout';
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
    <AuthShell heroVariant="video">
      <AuthPageHeader
        icon={KeyRound}
        title="Recuperar senha"
        description="Informe seu e-mail institucional para receber as instrucoes de redefinicao."
      />

      {feedback && (
        <div className="mb-6">
          <AuthAlert
            variant={
              feedback.type === 'success' ? 'success' : 'error'
            }
          >
            {feedback.message}
          </AuthAlert>
        </div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-5"
      >
        <AuthTextInput
          id="password-recovery-email"
          label="E-mail institucional"
          icon={Mail}
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldError(null);
          }}
          autoComplete="email"
          error={fieldError}
        />

        <AuthButton
          type="submit"
          loading={isSubmitting}
          icon={Send}
        >
          {isSubmitting
            ? 'Enviando...'
            : 'Enviar link de recuperacao'}
        </AuthButton>
      </form>

      <div className="mt-6 border-t border-[#c5c5d3] pt-6 text-center">
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
    </AuthShell>
  );
}
