import { createContext, useContext, type ReactNode } from 'react';

import type { PublicBranding } from '../services/brandingService';

const ResolvedBrandingContext = createContext<PublicBranding | null>(null);

export function ResolvedBrandingProvider({
  branding,
  children,
}: {
  branding: PublicBranding | null;
  children: ReactNode;
}) {
  return (
    <ResolvedBrandingContext.Provider value={branding}>
      {children}
    </ResolvedBrandingContext.Provider>
  );
}

export function useResolvedBrandingContext() {
  return useContext(ResolvedBrandingContext);
}
