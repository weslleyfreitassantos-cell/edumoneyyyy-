import type { ReactNode } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { ResolvedBrandingProvider } from '../contexts/ResolvedBrandingContext';
import {
  getHostBrandingFallback,
  useResolvedBranding,
} from '../hooks/useBranding';
import { resolveAppBranding } from '../services/appBranding';

export default function ResolvedAppBrandingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const institutionContext = useInstitution();
  const hostBrandingQuery = useResolvedBranding();
  const branding = resolveAppBranding({
    hostBranding: hostBrandingQuery.data ?? getHostBrandingFallback(),
    isAuthenticated: Boolean(profile),
    platformRole: profile?.platform_role ?? null,
    institution: institutionContext.currentInstitution,
    institutionLoading: institutionContext.isLoading,
  });

  return (
    <ResolvedBrandingProvider branding={branding}>
      {children}
    </ResolvedBrandingProvider>
  );
}
