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
      logoUrl={branding?.logoUrl ?? '/icons/tecescola-512.png'}
      schoolName={branding?.displayName ?? 'Tec Escola'}
      primaryColor={branding?.primaryColor}
      label={label}
      size={size}
    />
  );
}
