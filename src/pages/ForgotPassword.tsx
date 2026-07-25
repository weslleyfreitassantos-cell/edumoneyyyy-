import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthLayout';
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
  const displayName =
    brandingQuery.data?.displayName ?? branding.displayName ?? 'EduManager Pro';

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
    <div className="space-y-1">
      <p className="font-medium text-slate-700 dark:text-slate-300">
        Educação que transforma. Tecnologia que aproxima.
     </p>
      <p className="text-slate-500 dark:text-slate-400">
        © 2026 {displayName}. Todos os direitos reservados.
     </p>
   </div>
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
        <div className="login-brand-block mb-3 flex flex-col items-center">
          <div className="flex items-center justify-center min-h-[36px]">
            {brandingQuery.isLoading ? (
              <Loader2
                className="h-5 w-5 animate-spin text-slate-400"
                aria-label="Carregando identidade visual"
              />
            ) : branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={`Logo de ${branding.displayName ?? 'identidade visual'}`}
                className="max-h-[190px] max-w-[320px] object-contain sm:max-h-[210px] sm:max-w-[360px] lg:max-h-[230px] lg:max-w-[400px]"
              />
            ) : (
              <div
                className="h-12 w-32 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/50"
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
              Recuperar senha
           </h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Informe seu e-mail institucional para receber as instruções de redefinição.
           </p>
         </div>
       </div>

        {feedback && (
          <div className="mb-3">
            <div
              role="alert"
              className={`rounded-xl border p-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {feedback.message}
           </div>
         </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-3"
        >
          <div className="space-y-1">
            <label
              htmlFor="password-recovery-email"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            >
              E-mail institucional
           </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
                className="h-[48px] w-full rounded-xl border border-slate-300 bg-white px-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-[#111c2e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-white/20 caret-blue-500 selection:bg-blue-500/30 dark:selection:bg-blue-400/30"
              />
           </div>
            {fieldError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldError}
             </p>
            )}
         </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-live="polite"
            className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-70"
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

          <div className="flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 underline-offset-4 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowLeft
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              Voltar para o login
           </Link>
         </div>
       </form>
     </div>
   </AuthShell>
  );
}
