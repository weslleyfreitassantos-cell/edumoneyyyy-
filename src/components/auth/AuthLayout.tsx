import {
  BookOpenCheck,
  Eye,
  EyeOff,
  Globe2,
  GraduationCap,
  Lightbulb,
  Loader2,
  Lock,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useEffect, type ReactNode, type SyntheticEvent } from 'react';
import { useThemePreference } from '../../contexts/ThemeContext';

interface AuthShellProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  heroVariant?: 'video' | 'default';
  layoutVariant?: 'default' | 'login';
  showBrand?: boolean;
}

interface AuthPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

interface AuthAlertProps {
  children: ReactNode;
  variant: 'error' | 'success' | 'info';
}

interface AuthStatusPanelProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  variant?: 'error' | 'success' | 'info';
}

interface AuthTextInputProps {
  id: string;
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  type?: string;
  value?: string;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
  onChange?: (event: any) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | string;
}

interface AuthPasswordInputProps
  extends Omit<AuthTextInputProps, 'icon' | 'type'> {
  isVisible: boolean;
  onToggleVisibility: () => void;
  showLabel: string;
  hideLabel: string;
}

interface AuthButtonProps {
  children: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const defaultFooter =
  'Precisa de ajuda? Contate o suporte tecnico da sua instituicao.';

const authInputBaseClass =
  'h-12 w-full rounded-lg border border-[#c5c5d3] bg-white text-sm text-[#191c1d] outline-none transition placeholder:text-[#757682] focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20';

export const authPlainLinkClass =
  'inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#1e3a8a] underline-offset-4 transition hover:text-[#00236f] hover:underline focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30';

export const authSecondaryActionClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-5 text-sm font-semibold text-[#191c1d] shadow-sm transition hover:border-[#1e3a8a] hover:bg-[#f3f4f5] hover:text-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30';

export const authPrimaryActionLinkClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30';

export function AuthShell({
  children,
  contentClassName = '',
  footer = defaultFooter,
  heroVariant = 'default',
  layoutVariant = 'default',
  showBrand = true,
}: AuthShellProps) {
  const { theme } = useThemePreference();

  if (layoutVariant === 'login') {
    const showHero = heroVariant === 'video';
    const darkBg = 'bg-[#060d1f] text-[#e8eaf6]';
    const lightBg = 'bg-[#eef3fc] text-[#111]';
    const shellBg = theme === 'dark' ? darkBg : lightBg;

    if (!showHero) {
      return (
        <div className="relative min-h-dvh font-sans flex flex-col items-center justify-center px-4 py-8 text-[#111]" style={{ backgroundImage: 'image-set(url(/media/ff2-optimized.webp) type("image/webp"), url(/media/ff2.png) type("image/png"))', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#eef3fc' }}>
          <div className="w-full max-w-[420px]">
            <div className={`rounded-2xl border ${theme === 'dark' ? 'border-[#235bbe]/15 bg-[#0b1430]/95' : 'border-[#c7d9f8] bg-white'} px-6 py-8 shadow-sm sm:px-8 sm:py-10 ${contentClassName}`}>
              {children}
            </div>
          </div>
          {footer && (
            <footer className="mt-6 text-center text-xs leading-5 text-[#7c8ba8] dark:text-[#aeb8c8]">
              {footer}
            </footer>
          )}
        </div>
      );
    }

    const loginShellClasses = theme === 'dark'
      ? 'login-shell min-h-dvh bg-[#060d1f] font-sans text-[#e8eaf6] flex flex-col items-center justify-center p-0 lg:p-10'
      : 'login-shell min-h-dvh bg-[#eef3fc] font-sans text-[#111] flex flex-col items-center justify-center p-0 lg:p-10';
    const loginMainClasses = theme === 'dark'
      ? 'login-shell-main w-full max-w-[1100px] mx-auto flex flex-col lg:flex-row lg:rounded-[32px] lg:overflow-hidden lg:border lg:border-[#235bbe]/15 lg:bg-[#0b1430]/95 lg:shadow-[0_18px_48px_rgba(3,8,24,0.55)] lg:backdrop-blur-sm'
      : 'login-shell-main w-full max-w-[1100px] mx-auto flex flex-col lg:flex-row lg:rounded-[32px] lg:overflow-hidden lg:border-2 lg:border-[#c7d9f8] lg:bg-white lg:shadow-[0_18px_48px_rgba(10,30,100,0.13)]';
    return (
      <div className={loginShellClasses}>
        <main className={loginMainClasses}>
          <aside className="relative min-h-[280px] w-full lg:w-[calc(50%+5px)] lg:flex-none overflow-hidden">
            <AuthAside variant={heroVariant} layoutVariant="login" />
          </aside>
          <section className="relative z-20 flex min-w-0 flex-col items-center justify-center w-full lg:w-[calc(50%-5px)]">
            <LoginEducationDecor />
            <div className="relative z-20 w-full lg:max-w-[480px]">
              <div className={`login-card relative w-full rounded-[24px] lg:rounded-none ${theme === 'dark' ? 'bg-[#0b1430]/95' : 'bg-[#f5f8ff] border-2 border-[#c7d9f8]'} lg:border-none lg:bg-transparent px-7 py-9 shadow-[0_18px_48px_rgba(3,8,24,0.55)] lg:shadow-none backdrop-blur-sm lg:backdrop-blur-none sm:px-10 lg:px-12 lg:py-16 ${contentClassName}`}>
                <div className="relative z-10">
                  {children}
                </div>
              </div>
            </div>
          </section>
        </main>
        {footer && (
          <footer className="login-shell-footer mt-5 hidden shrink-0 flex-col items-center justify-center text-center text-xs leading-5 text-[#7c8ba8] lg:flex dark:text-[#aeb8c8]">
            {footer}
          </footer>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d] lg:grid lg:grid-cols-[55%_45%]">
      <section className="flex min-h-screen w-full flex-col bg-white px-4 py-6 sm:px-8 md:px-12 lg:px-16 xl:px-24">
        {showBrand && (
          <header>
            <AuthBrand />
          </header>
        )}
        <div className="flex flex-1 items-center py-10">
          <div className={`mx-auto w-full max-w-[420px] ${contentClassName}`}>
            {children}
          </div>
        </div>
        <footer className="text-center text-xs leading-4 text-[#444651]">
          {footer}
        </footer>
      </section>
      <AuthAside variant={heroVariant} />
    </main>
  );
}

function attemptVideoPlayback(video: HTMLVideoElement): void {
  try {
    const playResult = video.play();
    if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
      void playResult.catch(() => undefined);
    }
  } catch {
    // decorativo
  }
}

export function AuthAside({
  variant = 'default',
  layoutVariant = 'default',
}: {
  variant?: 'video' | 'default';
  layoutVariant?: 'default' | 'login';
}) {
  const { theme } = useThemePreference();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;

    const resumeVideo = () => {
      attemptVideoPlayback(video);
    };

    const startVideo = () => {
      if (video.currentTime < 1.5) {
        try {
          video.currentTime = 1.5;
        } catch {
          // O navegador pode bloquear seek antes dos metadados.
        }
      }
      resumeVideo();
    };

    const resumeWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        resumeVideo();
      }
    };

    if (video.readyState >= 1) {
      startVideo();
    } else {
      video.addEventListener('loadedmetadata', startVideo, { once: true });
    }

    video.addEventListener('canplay', resumeVideo);
    window.addEventListener('pageshow', resumeVideo);
    document.addEventListener('visibilitychange', resumeWhenVisible);
    document.addEventListener('pointerdown', resumeVideo, { once: true });
    document.addEventListener('touchstart', resumeVideo, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', startVideo);
      video.removeEventListener('canplay', resumeVideo);
      window.removeEventListener('pageshow', resumeVideo);
      document.removeEventListener('visibilitychange', resumeWhenVisible);
      document.removeEventListener('pointerdown', resumeVideo);
      document.removeEventListener('touchstart', resumeVideo);
    };
  }, []);

  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video.duration) return;
    if (video.duration - video.currentTime <= 0.3) {
      video.currentTime = 1.5;
      attemptVideoPlayback(video);
    }
  };

  const asideClassName =
    layoutVariant === 'login'
      ? theme === 'dark'
        ? 'absolute inset-0 z-0 h-full w-full overflow-hidden bg-[#082b67] text-white'
        : 'absolute inset-0 z-0 h-full w-full overflow-hidden bg-[#082b67] text-white'
      : 'relative hidden min-h-screen w-full overflow-hidden bg-[#00236f] text-white lg:flex lg:flex-col lg:items-center lg:justify-center';

  return (
    <aside className={asideClassName}>
      {variant === 'video' ? (
        <>
          <div className="auth-hero-fallback" aria-hidden="true" />
          <div className="auth-hero-video-layer">
              <video
                ref={videoRef}
                className="auth-hero-video opacity-100 z-20"
                autoPlay
                muted
                loop
                playsInline
                webkit-playsinline="true"
                preload="auto"
              aria-hidden="true"
              tabIndex={-1}
              onTimeUpdate={handleTimeUpdate}
            >
              <source src="/media/cinema-novo.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="auth-hero-overlay opacity-60" aria-hidden="true" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-0 h-48 bg-[#1e3a8a]/70" aria-hidden="true" />
          <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center px-10 text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur">
              <BookOpenCheck className="h-10 w-10" aria-hidden="true" />
            </div>
            <h2 className="text-[32px] font-bold leading-10">
              Gestao Escolar Inteligente
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-6 text-[#dce1ff]">
              Centralize operacoes academicas, financeiras e administrativas em uma plataforma segura e moderna.
            </p>
            <div className="mt-10 grid gap-4 text-left lg:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase text-[#b6c4ff]">Governanca</p>
                <p className="mt-2 text-sm leading-5 text-white/90">
                  Perfis, permissoes e instituicoes em um ambiente confiavel.
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase text-[#6ffbbe]">Operacao</p>
                <p className="mt-2 text-sm leading-5 text-white/90">
                  Dados escolares organizados para decisoes rapidas.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

export function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a8a] text-white shadow-sm">
        <GraduationCap className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="text-xl font-bold text-[#00236f]">EduManager Pro</span>
    </div>
  );
}

export function AuthPageHeader({ title, description, icon: Icon }: AuthPageHeaderProps) {
  return (
    <div className="mb-8">
      {Icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#dce1ff] text-[#00236f]">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h1 className="text-[32px] font-bold leading-10 text-[#191c1d]">{title}</h1>
      {description && (
        <p className="mt-2 text-base leading-6 text-[#444651]">{description}</p>
      )}
    </div>
  );
}

export function AuthAlert({ children, variant }: AuthAlertProps) {
  const variantClass = {
    error: 'border-[#ffdad6] bg-[#fff1ef] text-[#93000a]',
    success: 'border-[#b7e4cf] bg-[#eefbf5] text-[#005236]',
    info: 'border-[#dce1ff] bg-[#f4f6ff] text-[#264191]',
  }[variant];
  return (
    <div role="alert" className={`rounded-lg border px-3 py-2 text-sm leading-5 ${variantClass}`}>
      {children}
    </div>
  );
}

export function AuthStatusPanel({
  title,
  description,
  children,
  icon: Icon = BookOpenCheck,
  variant = 'info',
}: AuthStatusPanelProps) {
  const isLoading = Icon === Loader2;
  const iconClass = {
    error: 'bg-[#fff1ef] text-[#93000a]',
    success: 'bg-[#eefbf5] text-[#005236]',
    info: 'bg-[#dce1ff] text-[#00236f]',
  }[variant];
  return (
    <section
      role={isLoading ? 'status' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
      aria-busy={isLoading || undefined}
      className="rounded-lg border border-[#c5c5d3] bg-white p-6 shadow-sm"
    >
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className={`h-6 w-6 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold leading-8 text-[#191c1d]">{title}</h1>
      {description && <p className="mt-3 text-sm leading-6 text-[#444651]">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function AuthTextInput({
  id,
  label,
  icon: Icon,
  error,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...inputProps
}: AuthTextInputProps) {
  const errorId = `${id}-error`;
  const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]" aria-hidden="true" />}
        <input
          id={id}
          aria-invalid={ariaInvalid ?? Boolean(error)}
          aria-describedby={describedBy}
          className={`${authInputBaseClass} ${Icon ? 'px-10' : 'px-3'} ${className}`}
          {...inputProps}
        />
      </div>
      {error && <p id={errorId} className="text-sm leading-5 text-[#93000a]">{error}</p>}
    </div>
  );
}

export function AuthPasswordInput({
  id,
  label,
  error,
  isVisible,
  onToggleVisibility,
  showLabel,
  hideLabel,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...inputProps
}: AuthPasswordInputProps) {
  const errorId = `${id}-error`;
  const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]" aria-hidden="true" />
        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          aria-invalid={ariaInvalid ?? Boolean(error)}
          aria-describedby={describedBy}
          className={`${authInputBaseClass} px-10 pr-12 ${className}`}
          {...inputProps}
        />
        <button
          type="button"
          aria-label={isVisible ? hideLabel : showLabel}
          aria-pressed={isVisible}
          onClick={onToggleVisibility}
          className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#757682] transition hover:bg-[#f3f4f5] hover:text-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
        >
          {isVisible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={errorId} className="text-sm leading-5 text-[#93000a]">{error}</p>}
    </div>
  );
}

export function AuthButton({
  children,
  icon: Icon,
  loading = false,
  disabled,
  className = '',
  type = 'button',
}: AuthButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-live="polite"
      aria-busy={loading || undefined}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

function LoginEducationDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden" aria-hidden="true">
      <div className="absolute -left-20 top-14 h-72 w-72 rounded-full bg-[#dce9ff]/65 blur-3xl" />
      <div className="absolute left-[16%] top-[18%] h-28 w-28 rounded-full border border-[#075be8]/10" />
      <div className="absolute left-8 top-36 hidden h-32 w-32 opacity-[0.08] sm:block" style={{ backgroundImage: 'radial-gradient(circle, #075be8 1.2px, transparent 1.2px)', backgroundSize: '14px 14px' }} />
      <BookOpenCheck className="absolute left-[12%] top-[12%] h-14 w-14 rotate-[-10deg] text-[#075be8]/10" />
      <GraduationCap className="absolute bottom-[22%] left-[10%] h-16 w-16 rotate-6 text-[#082b67]/10" />
      <Pencil className="absolute bottom-[34%] right-[22%] hidden h-12 w-12 rotate-12 text-[#1c70f2]/10 sm:block" />
      <Globe2 className="absolute right-[12%] top-[26%] hidden h-14 w-14 text-[#075be8]/10 md:block" />
      <Lightbulb className="absolute bottom-[16%] right-[12%] hidden h-12 w-12 text-[#1c70f2]/10 lg:block" />
      <svg className="absolute inset-x-0 bottom-0 h-44 w-full text-[#dce9ff]" viewBox="0 0 900 220" preserveAspectRatio="none" focusable="false">
        <path d="M0 122C132 82 226 176 362 134C512 88 616 38 740 82C804 105 852 143 900 151V220H0V122Z" fill="currentColor" opacity="0.68" />
        <path d="M0 162C144 122 252 190 388 156C538 118 622 92 756 124C816 139 860 166 900 174V220H0V162Z" fill="#eef5ff" opacity="0.95" />
      </svg>
    </div>
  );
}











