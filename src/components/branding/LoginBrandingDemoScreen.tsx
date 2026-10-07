import {
  ArrowLeft,
  LogIn,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { CSSProperties } from 'react';

import { DEFAULT_LOGIN_BACKGROUND_IMAGE } from '../auth/AuthLayout';

export type LoginBrandingPreviewMode = 'desktop' | 'mobile';

interface LoginBrandingDemoScreenProps {
  mode: LoginBrandingPreviewMode;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  onClose: () => void;
}

function DemoLoginCard({
  displayName,
  primaryColor,
  secondaryColor,
  logoUrl,
}: Pick<LoginBrandingDemoScreenProps, 'displayName' | 'primaryColor' | 'secondaryColor' | 'logoUrl'>) {
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-[#c7d9f8] bg-white px-6 py-8 shadow-[0_18px_48px_rgba(10,30,100,0.16)] sm:px-8 sm:py-10">
      <div className="mb-5 flex flex-col items-center">
        <div className="flex min-h-[64px] items-center justify-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`Logo de ${displayName || 'identidade visual'}`}
              className="max-h-[80px] max-w-[210px] object-contain"
            />
          ) : (
            <div className="flex h-14 w-36 items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 text-xs font-semibold text-slate-400">
              Sua logo
            </div>
          )}
        </div>
        {displayName && (
          <p className="mt-2 text-center text-sm font-bold text-slate-800">
            {displayName}
          </p>
        )}
        <div
          className="mt-2 h-1 w-12 rounded-full"
          style={{
            backgroundImage: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          }}
          aria-hidden="true"
        />
        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-slate-900">
          Seja bem-vindo!
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Entre com suas credenciais para acessar a plataforma.
        </p>
      </div>

      <div className="space-y-4" aria-label="Formulário de login demonstrativo">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            E-mail institucional
          </span>
          <div className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white" aria-hidden="true" />
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Senha
          </span>
          <div className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white" aria-hidden="true" />
        </div>
        <div
          className="flex h-12 items-center justify-center rounded-xl text-sm font-semibold text-white"
          style={{
            backgroundImage: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          }}
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          ENTRAR
        </div>
        <p className="text-center text-xs text-slate-500">
          Esta é uma demonstração visual do login.
        </p>
      </div>
    </div>
  );
}

export function LoginBrandingDemoScreen({
  mode,
  displayName,
  primaryColor,
  secondaryColor,
  logoUrl,
  backgroundUrl,
  onClose,
}: LoginBrandingDemoScreenProps) {
  const isMobile = mode === 'mobile';
  const backgroundStyle = {
    backgroundImage: backgroundUrl
      ? `url(${JSON.stringify(backgroundUrl)})`
      : DEFAULT_LOGIN_BACKGROUND_IMAGE,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } as CSSProperties;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-branding-demo-title"
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-100 text-slate-900"
    >
      <div className="mx-auto flex min-h-full max-w-[1440px] flex-col p-4 sm:p-6">
        <header className="mb-4 flex flex-col items-stretch gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile ? (
              <Smartphone className="h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
            ) : (
              <Monitor className="h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <h1 id="login-branding-demo-title" className="truncate text-base font-bold sm:text-lg">
                Demonstração do login
              </h1>
              <p className="text-xs leading-5 text-slate-500 sm:text-sm">
                Prévia {isMobile ? 'celular' : 'desktop'} · sem salvar alterações
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#005bbf] hover:text-[#005bbf] focus:outline-none focus:ring-2 focus:ring-[#005bbf]/30 sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para personalização
          </button>
        </header>

        <main className="flex flex-1 items-center justify-center py-3 sm:py-6">
          <div
            className={isMobile
              ? 'w-full max-w-[390px] overflow-hidden rounded-[32px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl'
              : 'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'}
          >
            <div
              className={isMobile
                ? 'flex min-h-[720px] items-center justify-center p-4'
                : 'flex min-h-[min(760px,calc(100vh-150px))] items-center justify-center p-8 sm:p-12'}
              style={backgroundStyle}
            >
              <DemoLoginCard
                displayName={displayName}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                logoUrl={logoUrl}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
