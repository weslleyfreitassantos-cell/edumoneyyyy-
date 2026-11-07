import { useState, type CSSProperties } from 'react';
import { School } from 'lucide-react';

import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  sanitizeBrandColor,
} from '../../services/brandingValidation';

export type SchoolLogoLoadingSize = 'compact' | 'regular' | 'screen';

interface SchoolLogoLoadingAnimationProps {
  logoUrl?: string | null;
  schoolName?: string | null;
  primaryColor?: string | null;
  label?: string | null;
  size?: SchoolLogoLoadingSize;
}

const visualSizeClasses: Record<SchoolLogoLoadingSize, string> = {
  compact: 'h-14 w-14',
  regular: 'h-20 w-20',
  screen: 'h-28 w-28',
};

export default function SchoolLogoLoadingAnimation({
  logoUrl,
  schoolName,
  primaryColor,
  label = 'Carregando...',
  size = 'regular',
}: SchoolLogoLoadingAnimationProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);
  const color = sanitizeBrandColor(
    primaryColor ?? null,
    DEFAULT_BRAND_PRIMARY_COLOR,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Carregando identidade visual'}
      className="school-logo-loading flex flex-col items-center justify-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300"
      style={{ '--school-loader-color': color } as CSSProperties}
    >
      <div
        className={`school-logo-loading__visual ${visualSizeClasses[size]}`}
        aria-hidden={!showLogo}
      >
        <span className="school-logo-loading__halo" />
        <span className="school-logo-loading__orbit" />
        <span className="school-logo-loading__shell">
          {showLogo ? (
            <img
              src={logoUrl ?? undefined}
              alt={schoolName ? `Logo de ${schoolName}` : 'Logo da escola'}
              className="school-logo-loading__image"
              onError={() => setFailedLogoUrl(logoUrl ?? null)}
            />
          ) : (
            <School
              className="school-logo-loading__fallback"
              aria-hidden="true"
            />
          )}
        </span>
      </div>
      {label ? (
        <span className="inline-flex items-center gap-1.5" aria-hidden="true">
          {label}
          <span className="school-logo-loading__dots">
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : null}
    </div>
  );
}
