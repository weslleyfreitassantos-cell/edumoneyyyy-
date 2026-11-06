import type { CSSProperties } from 'react';

import { useOptionalInstitution } from '../../contexts/InstitutionContext';
import { DEFAULT_BRAND_PRIMARY_COLOR, sanitizeBrandColor } from '../../services/brandingValidation';
import type { InstitutionSummary } from '../../services/institutionService';

type PrintInstitution = Pick<InstitutionSummary, 'name' | 'logo_url' | 'primary_color'>;

interface InstitutionPrintHeaderProps {
  institution?: PrintInstitution | null;
  institutionName?: string | null;
  logoUrl?: string | null;
  documentTitle?: string | null;
}

export function InstitutionPrintHeader({
  institution,
  institutionName,
  logoUrl,
  documentTitle,
}: InstitutionPrintHeaderProps) {
  const contextInstitution = useOptionalInstitution()?.currentInstitution ?? null;
  const source = institution === undefined ? contextInstitution : institution;
  const name = institutionName?.trim() || source?.name || 'Instituição de ensino';
  const resolvedLogoUrl = logoUrl === undefined ? source?.logo_url : logoUrl;
  const primaryColor = sanitizeBrandColor(
    source?.primary_color,
    DEFAULT_BRAND_PRIMARY_COLOR,
  );

  return (
    <header
      className="institution-print-header flex items-center gap-4 border-b-2 pb-3"
      style={{ '--institution-print-primary': primaryColor } as CSSProperties}
    >
      {resolvedLogoUrl ? (
        <img
          src={resolvedLogoUrl}
          alt={`Logo de ${name}`}
          className="h-14 w-20 shrink-0 object-contain"
          loading="eager"
          decoding="sync"
        />
      ) : null}
      <div className="min-w-0">
        <p className="institution-print-title text-lg font-bold">{name}</p>
        <p className="text-xs">Documento institucional</p>
        {documentTitle ? <h2 className="mt-2 text-2xl font-bold">{documentTitle}</h2> : null}
      </div>
    </header>
  );
}
