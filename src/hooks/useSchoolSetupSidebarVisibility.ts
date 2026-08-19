import { useEffect, useState } from 'react';

import { schoolSetupService } from '../services/schoolSetupService';

export function useSchoolSetupSidebarVisibility(
  institutionId: string | null,
  enabled: boolean,
): boolean {
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!enabled || !institutionId) {
      setConfigured(false);
      return;
    }

    let isMounted = true;
    setConfigured(false);

    void schoolSetupService
      .getReadiness(institutionId)
      .then((readiness) => {
        if (isMounted) setConfigured(readiness.configured);
      })
      .catch(() => {
        if (isMounted) setConfigured(false);
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, institutionId]);

  return configured;
}
