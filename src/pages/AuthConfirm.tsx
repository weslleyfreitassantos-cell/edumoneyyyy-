import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthShell,
  AuthStatusPanel,
  authPrimaryActionLinkClass,
} from '../components/auth/AuthLayout';
import { supabase } from '../lib/supabaseClient';

export interface InviteContext {
  userId: string;
  email: string;
  verifiedAt: number;
  purpose: 'invite';
}

export function saveInviteContext(context: InviteContext): void {
  sessionStorage.setItem('invite_context', JSON.stringify(context));
}

export function getInviteContext(): InviteContext | null {
  const data = sessionStorage.getItem('invite_context');
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data) as InviteContext;
    if (parsed.purpose !== 'invite') return null;
    
    // Check if expired (10 minutes)
    if (Date.now() - parsed.verifiedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem('invite_context');
      return null;
    }
    
    return parsed;
  } catch {
    sessionStorage.removeItem('invite_context');
    return null;
  }
}

export function clearInviteContext(): void {
  sessionStorage.removeItem('invite_context');
}

function clearInviteTokensFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

type InviteConfirmation =
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: 'code';
      code: string;
    }
  | {
      kind: 'otp';
      tokenHash: string;
    };

function getInviteConfirmationFromUrl(): InviteConfirmation {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const searchParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const tokenHash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const type = hashParams.get('type') ?? searchParams.get('type');

  if ((!accessToken || !refreshToken) && !tokenHash && !code) {
    throw new Error('Link de convite inválido ou ausente.');
  }

  if (type && type !== 'invite') {
    throw new Error('Tipo de confirmação inválido.');
  }

  if (accessToken && refreshToken) {
    return {
      kind: 'session',
      accessToken,
      refreshToken,
    };
  }

  if (code) {
    return {
      kind: 'code',
      code,
    };
  }

  return {
    kind: 'otp',
    tokenHash: tokenHash!,
  };
}

export default function AuthConfirm() {
  const navigate = useNavigate();
  const processingRef = useRef(false);

  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    async function confirmInvite() {
      try {
        const confirmation = getInviteConfirmationFromUrl();

        clearInviteContext();

        // Expel local session before verifying
        await supabase.auth.signOut({ scope: 'local' });

        if (confirmation.kind === 'session') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: confirmation.accessToken,
            refresh_token: confirmation.refreshToken,
          });

          if (sessionError) {
            throw new Error('Convite inválido, expirado ou já utilizado.');
          }
        } else if (confirmation.kind === 'code') {
          const { error: codeError } =
            await supabase.auth.exchangeCodeForSession(
              confirmation.code,
            );

          if (codeError) {
            throw new Error('Convite inválido, expirado ou já utilizado.');
          }
        } else {
          const { error: verificationError } =
            await supabase.auth.verifyOtp({
              token_hash: confirmation.tokenHash,
              type: 'invite',
            });

          if (verificationError) {
            throw new Error('Convite inválido, expirado ou já utilizado.');
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user || !user.email) {
          throw new Error('Falha ao obter identidade do convite.');
        }

        saveInviteContext({
          userId: user.id,
          email: user.email,
          verifiedAt: Date.now(),
          purpose: 'invite',
        });

        // Clear tokens from the address bar securely
        clearInviteTokensFromUrl();

        navigate('/set-password', { replace: true });
      } catch (err) {
        // Expel any bad state again
        await supabase.auth.signOut({ scope: 'local' });
        clearInviteContext();
        clearInviteTokensFromUrl();

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Ocorreu um erro ao processar o convite.');
        }
      } finally {
        setIsProcessing(false);
      }
    }

    void confirmInvite();
  }, [navigate]);

  if (isProcessing) {
    return (
      <AuthShell>
        <AuthStatusPanel
          icon={Loader2}
          title="Validando convite de acesso..."
          description="Aguarde enquanto confirmamos a identidade do convite."
        />
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell>
        <AuthStatusPanel
          icon={ShieldAlert}
          variant="error"
          title="Falha no Convite"
          description={error}
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

  return null;
}
