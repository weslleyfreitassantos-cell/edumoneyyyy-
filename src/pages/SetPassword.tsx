import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthAlert,
  AuthButton,
  AuthPageHeader,
  AuthPasswordInput,
  AuthShell,
  AuthStatusPanel,
  authPrimaryActionLinkClass,
} from '../components/auth/AuthLayout';
import { supabase } from '../lib/supabaseClient';
import {
  clearInviteContext,
  getInviteContext,
  type InviteContext,
} from './AuthConfirm';
import { validatePasswordConfirmation } from '../schemas/authSchemas';

function getErrorMessage(error: unknown): string {
  let message = '';

  if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    message = error.message.toLowerCase();
  }

  if (
    message.includes('weak') ||
    message.includes('password') ||
    message.includes('senha')
  ) {
    return 'A senha informada nao atende aos criterios minimos.';
  }

  if (
    message.includes('identidade') ||
    message.includes('session') ||
    message.includes('sessao')
  ) {
    return 'Sessao de convite expirada. Solicite um novo convite.';
  }

  if (
    message.includes('rate') ||
    message.includes('limit') ||
    message.includes('too many')
  ) {
    return 'Muitas tentativas foram feitas. Aguarde alguns minutos e tente novamente.';
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('unavailable')
  ) {
    return 'O servico esta temporariamente indisponivel. Tente novamente em instantes.';
  }

  return 'Nao foi possivel definir a senha. Tente novamente.';
}

export default function SetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [
    showPasswordConfirmation,
    setShowPasswordConfirmation,
  ] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [inviteContext, setInviteContext] =
    useState<InviteContext | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

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

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (
        error ||
        !user ||
        user.id !== context.userId ||
        user.email !== context.email
      ) {
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !user ||
        user.id !== inviteContext.userId ||
        user.email !== inviteContext.email
      ) {
        throw new Error(
          'Identidade inválida para alteração de senha.',
        );
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      clearInviteContext();
      await supabase.auth.signOut({ scope: 'local' });

      setSuccessMessage(
        'Senha definida com sucesso. Faça o login com sua nova senha.',
      );

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
      <AuthShell>
        <AuthStatusPanel
          icon={Loader2}
          title="Validando identidade do convite..."
          description="Aguarde enquanto confirmamos a sessao temporaria do convite."
        />
      </AuthShell>
    );
  }

  if (!inviteContext && !successMessage) {
    return (
      <AuthShell>
        <AuthStatusPanel
          icon={ShieldAlert}
          variant="error"
          title="Convite inválido, expirado ou pertencente a outro usuário"
          description="Não é possível definir a senha usando esta sessão. Se necessário, solicite à administração um novo convite."
        >
          <Link
            to="/login"
            className={authPrimaryActionLinkClass}
          >
            Ir para o login
          </Link>
        </AuthStatusPanel>
      </AuthShell>
    );
  }

  if (successMessage) {
    return (
      <AuthShell>
        <AuthStatusPanel
          icon={CheckCircle2}
          variant="success"
          title="Sucesso"
          description={successMessage}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthPageHeader
        icon={KeyRound}
        title="Defina sua senha"
        description="Crie a senha que sera utilizada para acessar o EduManager Pro."
      />

      <div className="mb-6 rounded-lg border border-[#dce1ff] bg-[#f4f6ff] px-4 py-3 text-sm leading-5 text-[#264191]">
        Definindo senha para:{' '}
        <strong>{inviteContext?.email}</strong>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5"
      >
        {errorMessage && (
          <AuthAlert variant="error">{errorMessage}</AuthAlert>
        )}

        <AuthPasswordInput
          id="new-password"
          label="Nova senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          isVisible={showPassword}
          onToggleVisibility={() =>
            setShowPassword((current) => !current)
          }
          showLabel="Mostrar senha"
          hideLabel="Ocultar senha"
        />

        <AuthPasswordInput
          id="password-confirmation"
          label="Confirme a senha"
          value={passwordConfirmation}
          onChange={(event) =>
            setPasswordConfirmation(event.target.value)
          }
          autoComplete="new-password"
          minLength={8}
          required
          isVisible={showPasswordConfirmation}
          onToggleVisibility={() =>
            setShowPasswordConfirmation((current) => !current)
          }
          showLabel="Mostrar confirmacao da senha"
          hideLabel="Ocultar confirmacao da senha"
        />

        <AuthButton
          type="submit"
          loading={isSubmitting}
          icon={Save}
        >
          {isSubmitting
            ? 'Definindo senha...'
            : 'Definir senha e acessar'}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
