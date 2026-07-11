import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    async function confirmInvite() {
      try {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (!tokenHash) {
          throw new Error('Link de convite inválido ou ausente.');
        }

        if (type !== 'invite') {
          throw new Error('Tipo de confirmação inválido.');
        }

        clearInviteContext();

        // Expel local session before verifying
        await supabase.auth.signOut({ scope: 'local' });

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'invite',
        });

        if (verifyError) {
          throw new Error('Convite inválido, expirado ou já utilizado.');
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

        navigate('/set-password', { replace: true });
      } catch (err) {
        // Expel any bad state again
        await supabase.auth.signOut({ scope: 'local' });
        clearInviteContext();

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
  }, [searchParams, navigate]);

  if (isProcessing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <div className="rounded-xl border bg-white p-8 text-sm text-gray-500 shadow-sm">
          Validando convite de acesso...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
        <section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Falha no Convite</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{error}</p>
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

  return null;
}
