import {
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

interface AuthShellProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  heroVariant?: 'video' | 'default';
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
  'Precisa de ajuda? Contate o suporte técnico da sua instituição.';

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
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f8f9fa] font-sans text-[#191c1d] lg:grid lg:grid-cols-2">
      <section className="flex min-h-screen w-full flex-col bg-white px-4 py-6 sm:px-8 md:px-12 lg:px-16 xl:px-24">
        <header>
          <AuthBrand />
        </header>

        <div className="flex flex-1 items-center py-10">
          <div
            className={`mx-auto w-full max-w-[420px] ${contentClassName}`}
          >
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

export function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a8a] text-white shadow-sm">
        <GraduationCap
          className="h-5 w-5"
          aria-hidden="true"
        />
      </div>
      <span className="text-xl font-bold text-[#00236f]">
        EduManager Pro
      </span>
    </div>
  );
}

export function AuthPageHeader({
  title,
  description,
  icon: Icon,
}: AuthPageHeaderProps) {
  return (
    <div className="mb-8">
      {Icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#dce1ff] text-[#00236f]">
          <Icon
            className="h-6 w-6"
            aria-hidden="true"
          />
        </div>
      )}
      <h1 className="text-[32px] font-bold leading-10 text-[#191c1d]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-base leading-6 text-[#444651]">
          {description}
        </p>
      )}
    </div>
  );
}

export function AuthAlert({
  children,
  variant,
}: AuthAlertProps) {
  const variantClass = {
    error:
      'border-[#ffdad6] bg-[#fff1ef] text-[#93000a]',
    success:
      'border-[#b7e4cf] bg-[#eefbf5] text-[#005236]',
    info:
      'border-[#dce1ff] bg-[#f4f6ff] text-[#264191]',
  }[variant];

  return (
    <div
      role="alert"
      className={`rounded-lg border px-3 py-2 text-sm leading-5 ${variantClass}`}
    >
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
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}
      >
        <Icon
          className={`h-6 w-6 ${isLoading ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
      </div>
      <h1 className="text-2xl font-bold leading-8 text-[#191c1d]">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-sm leading-6 text-[#444651]">
          {description}
        </p>
      )}
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
  const describedBy =
    [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]"
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]"
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          aria-invalid={ariaInvalid ?? Boolean(error)}
          aria-describedby={describedBy}
          className={`${authInputBaseClass} ${
            Icon ? 'px-10' : 'px-3'
          } ${className}`}
          {...inputProps}
        />
      </div>
      {error && (
        <p
          id={errorId}
          className="text-sm leading-5 text-[#93000a]"
        >
          {error}
        </p>
      )}
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
  const describedBy =
    [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase leading-4 text-[#444651]"
      >
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#757682]"
          aria-hidden="true"
        />
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
          {isVisible ? (
            <EyeOff
              className="h-5 w-5"
              aria-hidden="true"
            />
          ) : (
            <Eye
              className="h-5 w-5"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
      {error && (
        <p
          id={errorId}
          className="text-sm leading-5 text-[#93000a]"
        >
          {error}
        </p>
      )}
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
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
      ) : (
        Icon && (
          <Icon
            className="h-4 w-4"
            aria-hidden="true"
          />
        )
      )}
      {children}
    </button>
  );
}

export function AuthAside({
  variant = 'default',
}: {
  variant?: 'video' | 'default';
}) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);

  const handleTimeUpdate = (videoNum: 1 | 2) => (e: SyntheticEvent<HTMLVideoElement>) => {
    if (activeVideo !== videoNum) return;
    const video = e.currentTarget;
    if (!video.duration) return;
    
    // Crossfade threshold (e.g., 0.5s before end)
    const threshold = 0.5;
    if (video.duration - video.currentTime <= threshold) {
      const nextVideo = videoNum === 1 ? video2Ref.current : video1Ref.current;
      if (nextVideo) {
        nextVideo.currentTime = 0;
        nextVideo.play().catch(() => {});
        setActiveVideo(videoNum === 1 ? 2 : 1);
      }
    }
  };

  return (
    <aside className="relative hidden min-h-screen w-full overflow-hidden bg-[#00236f] text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
      {variant === 'video' ? (
        <>
          <div className="auth-hero-fallback" aria-hidden="true" />
          <video
            ref={video1Ref}
            className={`auth-hero-video transition-opacity duration-500 ${activeVideo === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            onTimeUpdate={handleTimeUpdate(1)}
          >
            <source src="/media/cinema-novo.mp4" type="video/mp4" />
          </video>
          <video
            ref={video2Ref}
            className={`auth-hero-video transition-opacity duration-500 ${activeVideo === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            onTimeUpdate={handleTimeUpdate(2)}
          >
            <source src="/media/cinema-novo.mp4" type="video/mp4" />
          </video>
          <div className="auth-hero-overlay opacity-60" aria-hidden="true" />

          {/* Footer content */}
          <div className="absolute bottom-[40px] left-0 right-0 z-20 flex items-center justify-center gap-3">
            <BookOpenCheck
              className="h-8 w-8 text-white drop-shadow-md"
              aria-hidden="true"
            />
            <h2 
              className="text-2xl font-bold text-white lg:text-3xl" 
              style={{ textShadow: '0 2px 12px rgba(0, 0, 0, 0.35)' }}
            >
              Gestão Escolar Inteligente
            </h2>
          </div>
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
              Gestão Escolar Inteligente
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-base leading-6 text-[#dce1ff]">
              Centralize operações acadêmicas, financeiras e administrativas em uma plataforma segura e moderna.
            </p>

            <div className="mt-10 grid gap-4 text-left lg:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase text-[#b6c4ff]">Governança</p>
                <p className="mt-2 text-sm leading-5 text-white/90">
                  Perfis, permissões e instituições em um ambiente confiável.
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase text-[#6ffbbe]">Operação</p>
                <p className="mt-2 text-sm leading-5 text-white/90">
                  Dados escolares organizados para decisões rápidas.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
