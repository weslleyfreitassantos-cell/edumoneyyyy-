import SchoolLogoLoadingAnimation, {
  TEC_ESCOLA_LOGO_URL,
  type SchoolLogoLoadingSize,
} from './branding/SchoolLogoLoadingAnimation';
import { useResolvedBrandingContext } from '../contexts/ResolvedBrandingContext';

export default function LoadingIndicator({
  label = 'Carregando...',
  size = 'regular',
}: {
  label?: string | null;
  size?: SchoolLogoLoadingSize;
}) {
  const branding = useResolvedBrandingContext();

  return (
    <SchoolLogoLoadingAnimation
      logoUrl={branding?.logoUrl}
      fallbackLogoUrl={
        branding?.scope === 'GLOBAL' ? TEC_ESCOLA_LOGO_URL : null
      }
      schoolName={branding?.displayName}
      primaryColor={branding?.primaryColor}
      label={label}
      size={size}
    />
  );
}
