import SchoolLogoLoadingAnimation, {
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
  const isGlobalBrand = branding?.scope === 'GLOBAL';

  return (
    <SchoolLogoLoadingAnimation
      logoUrl={
        branding?.logoUrl ?? (isGlobalBrand ? '/icons/tecescola-512.png' : null)
      }
      schoolName={
        branding?.displayName ?? (isGlobalBrand ? 'Tec Escola' : null)
      }
      primaryColor={branding?.primaryColor}
      label={label}
      size={size}
      showFallbackIcon={false}
    />
  );
}
