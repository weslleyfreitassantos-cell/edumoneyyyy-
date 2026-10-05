import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { LoginBrandingPreviewMode } from '../components/branding/LoginBrandingDemoScreen';

interface ScrollPosition {
  left: number;
  top: number;
}

export function useLoginBrandingPreview() {
  const [previewMode, setPreviewMode] =
    useState<LoginBrandingPreviewMode | null>(null);
  const scrollPositionRef = useRef<ScrollPosition | null>(null);

  const openPreview = useCallback((mode: LoginBrandingPreviewMode) => {
    if (typeof window !== 'undefined') {
      scrollPositionRef.current = {
        left: window.scrollX,
        top: window.scrollY,
      };
    }

    setPreviewMode(mode);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewMode(null);
  }, []);

  useLayoutEffect(() => {
    if (previewMode !== null || !scrollPositionRef.current) {
      return;
    }

    const { left, top } = scrollPositionRef.current;
    const restoreScroll = () => {
      try {
        window.scrollTo({
          left,
          top,
          behavior: 'auto',
        });
      } catch {
        // jsdom does not implement scrolling; the browser path is restored normally.
      }
      scrollPositionRef.current = null;
    };

    restoreScroll();
  }, [previewMode]);

  return {
    previewMode,
    openPreview,
    closePreview,
  };
}
