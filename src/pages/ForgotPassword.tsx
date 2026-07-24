import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Mail,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AuthAlert,
  AuthShell,
} from '../components/auth/AuthLayout';
import { useResolvedBranding } from '../hooks/useBranding';
import { FALLBACK_BRANDING } from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';
import { type CSSProperties, useEffect } from 'react';
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

  const brandingQuery = useResolvedBranding();
  const branding = brandingQuery.data ?? FALLBACK_BRANDING;
  const displayName = brandingQuery.data?.displayName ?? branding.displayName ?? 'EduManager Pro';

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
    <>
      <p>Educação que transforma. Tecnologia que aproxima.</p>
      <p>© 2026 {displayName}. Todos os direitos reservados.</p>
    </>
  );

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

        <h1 className="sr-only">Recuperar senha</h1>
        <p className="mt-7 text-center text-[25px] font-bold leading-[1.2] text-white dark:text-white">
          Recuperar senha
        </p>
        <p className="mt-2 mb-7 text-center text-[15px] leading-[1.6] text-[#9fb0cc] dark:text-[#aeb8c8]">
          Informe seu e-mail institucional para receber as instruções de redefinição.
        </p>

        {feedback && (
          <div className="mb-6">
            <div
              role="alert"
              className={`rounded-xl border px-3 py-2 text-sm ${
                feedback.type === 'success'
                  ? 'border-[#b7e4cf] bg-[#eefbf5] text-[#005236]'
                  : 'border-[#ffdad6] bg-[#fff1ef] text-[#93000a]'
              }`}
            >
              {feedback.message}
            </div>
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-[22px]"
        >
          <div className="space-y-2">
            <label
              htmlFor="password-recovery-email"
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
                id="password-recovery-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldError(null);
                }}
                autoComplete="email"
                placeholder="nome@instituicao.edu.br"
                className="h-[60px] w-full rounded-xl border border-[#2a3a66]/40 bg-[#0c1530]/80 px-12 text-sm text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)] outline-none transition placeholder:text-[#6b7a99] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/20"
              />
            </div>
            {fieldError && (
              <p className="text-sm leading-5 text-[#ffb4ab]">
                {fieldError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-live="polite"
            className="mt-[24px] inline-flex h-[64px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[17px] font-bold text-white shadow-[0_14px_26px_rgba(0,0,0,0.25)] transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/25 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))',
            }}
          >
            {isSubmitting ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Send
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            to="/login"
            style={{ color: 'var(--brand-primary)' }}
            className="inline-flex items-center gap-2 text-[14px] font-semibold underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />
            Voltar para o login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
