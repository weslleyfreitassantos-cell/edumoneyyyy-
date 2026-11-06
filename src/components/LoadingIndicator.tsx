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

  return (
    <SchoolLogoLoadingAnimation
      logoUrl={branding?.logoUrl}
      schoolName={branding?.displayName}
      primaryColor={branding?.primaryColor}
      label={label}
      size={size}
    />
  );
}
